const QWEATHER_NOW_ENDPOINT = 'https://devapi.qweather.com/v7/weather/now'
const DEFAULT_LOCATION = {
  name: '长春',
  coordinates: '125.28845,43.83327'
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

export async function handleWeatherRequest(_request, options = {}) {
  const result = await getWeather(options)

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
