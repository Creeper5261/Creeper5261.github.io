const TENCENT_LOCATION_ENDPOINT = 'https://apis.map.qq.com/ws/location/v1/ip'

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

export function getClientIp(request) {
  return firstHeaderValue(request.headers.get('x-forwarded-for'))
    || firstHeaderValue(request.headers.get('x-real-ip'))
    || firstHeaderValue(request.headers.get('x-vercel-forwarded-for'))
    || ''
}

function readTencentKey(env = process.env) {
  return env.PUBLIC_TENCENT_MAP_KEY || env.TENCENT_MAP_KEY || ''
}

export async function getTencentLocation({
  env = process.env,
  fetchImpl = fetch,
  ip = ''
} = {}) {
  const key = readTencentKey(env)
  if (!key) {
    return { ok: false, status: 503, reason: 'missing_tencent_map_key' }
  }

  const url = new URL(TENCENT_LOCATION_ENDPOINT)
  url.searchParams.set('key', key)
  url.searchParams.set('output', 'json')
  if (ip) url.searchParams.set('ip', ip)

  try {
    const response = await fetchImpl(url)
    if (!response.ok) {
      return { ok: false, status: 502, reason: 'tencent_location_http_error' }
    }

    const payload = await response.json()
    if (payload.status !== 0 || !payload.result) {
      return { ok: false, status: 502, reason: 'tencent_location_rejected' }
    }

    return { ok: true, status: 200, data: { result: payload.result } }
  } catch {
    return { ok: false, status: 502, reason: 'tencent_location_unavailable' }
  }
}

export async function handleLocationRequest(request, options = {}) {
  const result = await getTencentLocation({
    ...options,
    ip: getClientIp(request)
  })

  if (!result.ok) {
    return json({ error: result.reason }, result.status)
  }

  return json(result.data)
}

export function GET(request) {
  return handleLocationRequest(request)
}

export default {
  fetch: handleLocationRequest
}
