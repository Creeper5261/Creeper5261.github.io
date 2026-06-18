import { getClientIp, getTencentLocation } from './location.mjs'

const QWEATHER_NOW_ENDPOINT = 'https://devapi.qweather.com/v7/weather/now'
const DEFAULT_LOCATION = {
  name: '北邮沙河',
  coordinates: '116.290663,40.158009'
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': status === 200 ? 'public, max-age=600, s-maxage=600' : 'no-store'
    }
  })
}

function readQweatherKey(env = process.env) {
  return env.PUBLIC_QWEATHER_KEY || env.QWEATHER_KEY || ''
}

export function normalizeWeather(payload, location = DEFAULT_LOCATION.name) {
  if (!payload || payload.code !== '200' || !payload.now) return null

  return {
    temp: payload.now.temp || '',
    text: payload.now.text || '',
    icon: payload.now.icon || '',
    windDir: payload.now.windDir || '',
    humidity: payload.now.humidity || '',
    updateTime: payload.updateTime || '',
    location
  }
}

function locationFromTencentResult(result) {
  const location = result?.location
  if (!location || typeof location.lng !== 'number' || typeof location.lat !== 'number') {
    return null
  }

  const adInfo = result.ad_info || {}
  const name = [adInfo.city, adInfo.district].filter(Boolean).join(' ') || adInfo.province || adInfo.nation || DEFAULT_LOCATION.name

  return {
    name,
    coordinates: `${location.lng},${location.lat}`
  }
}

export async function resolveWeatherLocation({
  env = process.env,
  fetchImpl = fetch,
  request
} = {}) {
  if (!request) return DEFAULT_LOCATION

  const locationResult = await getTencentLocation({
    env,
    fetchImpl,
    ip: getClientIp(request)
  })

  if (!locationResult.ok) return DEFAULT_LOCATION

  return locationFromTencentResult(locationResult.data.result) || DEFAULT_LOCATION
}

export async function getWeather({
  env = process.env,
  fetchImpl = fetch,
  location = DEFAULT_LOCATION
} = {}) {
  const key = readQweatherKey(env)
  if (!key) {
    return { ok: false, status: 503, reason: 'missing_qweather_key' }
  }

  const url = new URL(QWEATHER_NOW_ENDPOINT)
  url.searchParams.set('location', location.coordinates)
  url.searchParams.set('key', key)
  url.searchParams.set('lang', 'zh')
  url.searchParams.set('unit', 'm')

  try {
    const response = await fetchImpl(url)
    if (!response.ok) {
      return { ok: false, status: 502, reason: 'qweather_http_error' }
    }

    const payload = await response.json()
    const weather = normalizeWeather(payload, location.name)
    if (!weather) {
      return { ok: false, status: 502, reason: 'qweather_rejected' }
    }

    return { ok: true, status: 200, data: weather }
  } catch {
    return { ok: false, status: 502, reason: 'qweather_unavailable' }
  }
}

export async function handleWeatherRequest(request, options = {}) {
  const location = options.location || await resolveWeatherLocation({
    ...options,
    request
  })
  const result = await getWeather({ ...options, location })

  if (!result.ok) {
    return json({ error: result.reason }, result.status)
  }

  return json({ weather: result.data })
}

export function GET(request) {
  return handleWeatherRequest(request)
}

export default {
  fetch: handleWeatherRequest
}
