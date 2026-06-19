import crypto from 'node:crypto'

const SITE_PV_KEY = 'stats:site:pv'
const SITE_UV_KEY = 'stats:site:uv'
const PAGE_KEY_PREFIX = 'stats:page:'

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  })
}

function firstHeaderValue(value) {
  return value ? value.split(',')[0].trim() : ''
}

function getClientIp(request) {
  return firstHeaderValue(request.headers.get('x-forwarded-for'))
    || firstHeaderValue(request.headers.get('x-real-ip'))
    || firstHeaderValue(request.headers.get('x-vercel-forwarded-for'))
    || ''
}

function readStorageConfig(env = process.env) {
  return {
    url: env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL || '',
    token: env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN || ''
  }
}

function readHashSalt(env = process.env) {
  return env.STATS_HASH_SALT || env.STATS_BACKUP_TOKEN || ''
}

function createUpstashRedis({ env = process.env, fetchImpl = fetch } = {}) {
  const config = readStorageConfig(env)
  if (!config.url || !config.token) return null

  return {
    async command(command, ...args) {
      const response = await fetchImpl(`${config.url.replace(/\/$/, '')}/pipeline`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${config.token}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify([[command, ...args]])
      })

      if (!response.ok) throw new Error('stats_storage_http_error')
      const payload = await response.json()
      if (!Array.isArray(payload) || payload[0]?.error) throw new Error('stats_storage_rejected')
      return payload[0]?.result ?? null
    }
  }
}

export function normalizePathname(pathname = '/') {
  if (typeof pathname !== 'string' || (!pathname.startsWith('/') && !/^https?:\/\//i.test(pathname))) {
    return '/'
  }

  try {
    const url = new URL(pathname, 'https://example.test')
    return url.pathname || '/'
  } catch {
    return '/'
  }
}

export async function createVisitorHash(request, {
  env = process.env,
  visitorId = ''
} = {}) {
  const salt = readHashSalt(env)
  const ip = getClientIp(request)
  const userAgent = request.headers.get('user-agent') || ''
  const acceptLanguage = request.headers.get('accept-language') || ''

  return crypto
    .createHash('sha256')
    .update([salt, visitorId, ip, userAgent, acceptLanguage].join('\n'))
    .digest('hex')
}

async function readJsonBody(request) {
  try {
    return await request.json()
  } catch {
    return {}
  }
}

function pageKey(pathname) {
  return `${PAGE_KEY_PREFIX}${pathname}`
}

async function readStats(redis, pathname) {
  const [siteUv, sitePv, pagePv] = await Promise.all([
    redis.command('SCARD', SITE_UV_KEY),
    redis.command('GET', SITE_PV_KEY),
    redis.command('GET', pageKey(pathname))
  ])

  return {
    site_uv: Number(siteUv || 0),
    site_pv: Number(sitePv || 0),
    page_pv: Number(pagePv || 0),
    path: pathname,
    ok: true
  }
}

async function recordVisit(request, redis, env) {
  const body = await readJsonBody(request)
  const pathname = normalizePathname(body.path || new URL(request.url).searchParams.get('path') || '/')
  const visitorHash = await createVisitorHash(request, {
    env,
    visitorId: String(body.visitorId || '')
  })

  await redis.command('SADD', SITE_UV_KEY, visitorHash)
  await redis.command('INCR', SITE_PV_KEY)
  await redis.command('INCR', pageKey(pathname))

  return readStats(redis, pathname)
}

async function exportStats(redis) {
  const [siteUv, sitePv, pageKeys] = await Promise.all([
    redis.command('SCARD', SITE_UV_KEY),
    redis.command('GET', SITE_PV_KEY),
    redis.command('KEYS', `${PAGE_KEY_PREFIX}*`)
  ])
  const pageValues = pageKeys.length ? await redis.command('MGET', ...pageKeys) : []
  const pages = {}

  for (const [index, key] of pageKeys.entries()) {
    pages[key.slice(PAGE_KEY_PREFIX.length)] = Number(pageValues[index] || 0)
  }

  return {
    exportedAt: new Date().toISOString(),
    site: {
      uv: Number(siteUv || 0),
      pv: Number(sitePv || 0)
    },
    pages
  }
}

function isAuthorizedExport(request, env) {
  const token = env.STATS_BACKUP_TOKEN || ''
  if (!token) return false

  const url = new URL(request.url)
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || ''
  return url.searchParams.get('token') === token || bearer === token
}

export async function handleStatsRequest(request, {
  env = process.env,
  fetchImpl = fetch,
  redis = createUpstashRedis({ env, fetchImpl })
} = {}) {
  if (!redis) return json({ ok: false, error: 'stats_storage_unconfigured' }, 503)

  const url = new URL(request.url)

  try {
    if (url.searchParams.get('export') === '1') {
      if (!isAuthorizedExport(request, env)) return json({ ok: false, error: 'stats_export_unauthorized' }, 401)
      return json(await exportStats(redis))
    }

    if (request.method === 'POST') {
      return json(await recordVisit(request, redis, env))
    }

    const pathname = normalizePathname(url.searchParams.get('path') || '/')
    return json(await readStats(redis, pathname))
  } catch {
    return json({ ok: false, error: 'stats_storage_unavailable' }, 502)
  }
}

export function GET(request) {
  return handleStatsRequest(request)
}

export function POST(request) {
  return handleStatsRequest(request)
}

export default {
  fetch: handleStatsRequest
}
