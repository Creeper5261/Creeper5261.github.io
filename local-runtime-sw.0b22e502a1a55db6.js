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
      // Documents stay network-first so page edits are not hidden by an old cache.
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
  const isDocument = request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')
  event.respondWith((async () => {
    if (isDocument) return fetch(request)
    const cached = await caches.match(request)
    if (cached) return cached
    try {
      const response = await fetch(request)
      const pathname = new URL(request.url).pathname
      if (response.ok && (pathname.startsWith('/lab') || pathname.startsWith('/tools/codec'))) {
        const cache = await caches.open(cacheName)
        await cache.put(request, response.clone())
      }
      return response
    } catch {
      return Response.error()
    }
  })())
})
