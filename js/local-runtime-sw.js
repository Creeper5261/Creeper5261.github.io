const manifestUrl = '/runtime/manifest.json'
let cacheName = 's3-runtime-fallback'

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName)
    try {
      const response = await fetch(manifestUrl, { cache: 'no-store' })
      const manifest = await response.json()
      cacheName = `s3-runtime-${manifest.runtimeVersion}`
      const versionedCache = await caches.open(cacheName)
      await versionedCache.addAll(manifest.precache)
    } catch {
      await cache.addAll(['/lab/', '/tools/local-json/'])
    }
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    await self.clients.claim()
    const keys = await caches.keys()
    await Promise.all(keys.filter((key) => key.startsWith('s3-runtime-') && key !== cacheName).map((key) => caches.delete(key)))
  })())
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return
  event.respondWith((async () => {
    const cached = await caches.match(request)
    if (cached) return cached
    try {
      const response = await fetch(request)
      const pathname = new URL(request.url).pathname
      if (response.ok && (pathname.startsWith('/lab') || pathname.startsWith('/tools/local-json'))) {
        const cache = await caches.open(cacheName)
        await cache.put(request, response.clone())
      }
      return response
    } catch {
      const fallback = new URL(request.url).pathname.startsWith('/tools/local-json') ? '/tools/local-json/' : '/lab/'
      return caches.match(fallback)
    }
  })())
})
