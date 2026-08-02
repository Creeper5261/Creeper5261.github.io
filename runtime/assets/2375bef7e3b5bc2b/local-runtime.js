const DB_NAME = 'dat-local-runtime'
const DB_VERSION = 1
const MAX_TASK_BYTES = 2 * 1024 * 1024

export function detectCapabilities() {
  return {
    worker: typeof Worker !== 'undefined',
    dragDrop: typeof DataTransfer !== 'undefined',
    indexedDB: typeof indexedDB !== 'undefined',
    opfs: typeof navigator !== 'undefined' && typeof navigator.storage?.getDirectory === 'function',
    serviceWorker: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
    wasm: typeof WebAssembly !== 'undefined',
    fileSystemAccess: typeof window !== 'undefined' && 'showOpenFilePicker' in window
  }
}

function memoryStore() {
  const values = new Map()
  return {
    async get(key) { return values.get(key) },
    async set(key, value) { values.set(key, value); return value },
    async remove(key) { values.delete(key) },
    async clear() { values.clear() },
    mode: 'memory'
  }
}

function indexedStore(scope) {
  let database
  const open = () => {
    if (database) return database
    database = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      request.onupgradeneeded = () => request.result.createObjectStore('values')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    return database
  }
  const transaction = async (mode, action) => {
    const db = await open()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('values', mode)
      const request = action(tx.objectStore('values'))
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }
  const key = (name) => `${scope}:${name}`
  return {
    async get(name) { return transaction('readonly', (store) => store.get(key(name))) },
    async set(name, value) { await transaction('readwrite', (store) => store.put(value, key(name))); return value },
    async remove(name) { await transaction('readwrite', (store) => store.delete(key(name))) },
    async clear() {
      const db = await open()
      const keys = await new Promise((resolve, reject) => {
        const request = db.transaction('values', 'readonly').objectStore('values').getAllKeys()
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      await Promise.all(keys.filter((name) => String(name).startsWith(`${scope}:`)).map((name) => transaction('readwrite', (store) => store.delete(name))))
    },
    mode: 'indexeddb'
  }
}

export function createLocalStore(scope = 'default') {
  if (typeof indexedDB === 'undefined') return memoryStore()
  const persistent = indexedStore(scope)
  const fallback = memoryStore()
  return {
    mode: 'indexeddb',
    async get(key) { try { return await persistent.get(key) } catch { return fallback.get(key) } },
    async set(key, value) { try { return await persistent.set(key, value) } catch { return fallback.set(key, value) } },
    async remove(key) { try { return await persistent.remove(key) } catch { return fallback.remove(key) } },
    async clear() { try { await persistent.clear() } catch { await fallback.clear() } }
  }
}

export async function saveToOpfs(name, blob) {
  if (typeof navigator === 'undefined' || typeof navigator.storage?.getDirectory !== 'function') {
    throw new Error('当前浏览器不支持 OPFS')
  }
  const root = await navigator.storage.getDirectory()
  const handle = await root.getFileHandle(name, { create: true })
  const writable = await handle.createWritable()
  await writable.write(blob)
  await writable.close()
  return name
}

function fallbackTask(task, payload) {
  if (task === 'format-json') {
    const output = JSON.stringify(JSON.parse(String(payload.input ?? '')), null, 2)
    return { output, bytes: new TextEncoder().encode(output).byteLength }
  }
  if (task === 'state-step') {
    const items = Array.isArray(payload.state?.items) ? [...payload.state.items] : []
    if (payload.action === 'enqueue') items.push(`项目 ${items.length + 1}`)
    if (payload.action === 'dequeue') items.shift()
    return { items, action: payload.action }
  }
  throw new Error(`未知任务：${task}`)
}

export function createTaskRunner({ workerUrl = '/js/local-runtime-worker.js', maxBytes = MAX_TASK_BYTES } = {}) {
  let worker
  let nextId = 0
  const pending = new Map()
  const ensureWorker = () => {
    if (worker || typeof Worker === 'undefined') return worker
    worker = new Worker(workerUrl, { type: 'module' })
    worker.onmessage = (event) => {
      const message = event.data ?? {}
      const task = pending.get(message.id)
      if (!task) return
      if (message.type === 'progress') task.onProgress?.(message.value, message.label)
      if (message.type === 'result') { pending.delete(message.id); task.resolve(message.result) }
      if (message.type === 'error') {
        pending.delete(message.id)
        const error = new Error(message.message)
        error.name = message.name || 'TaskError'
        task.reject(error)
      }
    }
    worker.onerror = () => {
      for (const task of pending.values()) task.reject(new Error('Worker 运行失败，可使用主线程降级'))
      pending.clear()
      worker?.terminate()
      worker = undefined
    }
    return worker
  }
  const terminateWorker = (abortedId) => {
    const activeWorker = worker
    worker = undefined
    activeWorker?.terminate()
    for (const [id, task] of pending) {
      pending.delete(id)
      if (abortedId == null || id === abortedId) task.reject(new DOMException('任务已取消', 'AbortError'))
      else task.reject(new Error('Worker 因另一任务取消而重启，请重试'))
    }
  }
  return {
    maxBytes,
    run(task, payload, { signal, onProgress, fallback, forceMainThread = false } = {}) {
      const inputBytes = payload?.input == null ? 0 : new TextEncoder().encode(String(payload.input)).byteLength
      if (inputBytes > maxBytes) {
        const error = new Error(`输入超过 ${Math.round(maxBytes / 1024 / 1024)} MB 限制`)
        error.name = 'TaskLimitError'
        error.code = 'TASK_INPUT_TOO_LARGE'
        return Promise.reject(error)
      }
      const instance = forceMainThread ? undefined : ensureWorker()
      if (!instance || forceMainThread) {
        try { return Promise.resolve(fallback ? fallback(payload) : fallbackTask(task, payload)) } catch (error) { return Promise.reject(error) }
      }
      const id = `task-${++nextId}`
      return new Promise((resolve, reject) => {
        if (signal?.aborted) return reject(new DOMException('任务已取消', 'AbortError'))
        const abort = () => terminateWorker(id)
        signal?.addEventListener('abort', abort, { once: true })
        pending.set(id, {
          resolve: (value) => { signal?.removeEventListener('abort', abort); resolve(value) },
          reject: (error) => { signal?.removeEventListener('abort', abort); reject(error) },
          onProgress
        })
        instance.postMessage({ type: 'run', id, task, ...payload })
      })
    },
    cancelAll() { terminateWorker() },
    dispose() { worker?.terminate(); worker = undefined; pending.clear() }
  }
}

export async function registerRuntimeServiceWorker(scriptUrl = '/local-runtime-sw.js') {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) return { registered: false, reason: 'unsupported' }
  try {
    await navigator.serviceWorker.register(scriptUrl, { scope: '/lab/' })
    return { registered: true }
  } catch (error) {
    return { registered: false, reason: error.message }
  }
}
