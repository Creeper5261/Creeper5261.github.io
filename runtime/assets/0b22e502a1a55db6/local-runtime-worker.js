import { hashTask } from './hash-task.js'
import { transformResult } from './codec-task.js'

function send(message) {
  self.postMessage(message)
}

function progress(id, value, label) {
  send({ type: 'progress', id, value, label })
}

function formatJson(id, input) {
  const text = String(input ?? '')
  progress(id, 0.1, '读取输入')
  const value = JSON.parse(text)
  progress(id, 0.65, '格式化 JSON')
  const output = JSON.stringify(value, null, 2)
  progress(id, 1, '完成')
  return { output, bytes: new TextEncoder().encode(output).byteLength }
}

function stateStep(id, state, action) {
  const items = Array.isArray(state?.items) ? [...state.items] : []
  progress(id, 0.25, '准备状态')
  if (action === 'enqueue') items.push(`项目 ${items.length + 1}`)
  if (action === 'dequeue') items.shift()
  progress(id, 0.75, '应用状态变更')
  progress(id, 1, '完成')
  return { items, action }
}

function transformText(id, input, mode) {
  progress(id, 0.25, '读取输入')
  const result = transformResult(input, mode)
  progress(id, 1, '完成')
  return result
}

async function hashSha256(id, input) {
  progress(id, 0.25, '读取输入')
  const result = await hashTask(input)
  progress(id, 1, '完成')
  return result
}

self.onmessage = async (event) => {
  const message = event.data ?? {}
  if (message.type === 'ping' && message.id) {
    send({ type: 'pong', id: message.id })
    return
  }
  if (message.type !== 'run' || !message.id) return

  try {
    const result = message.task === 'format-json'
      ? formatJson(message.id, message.input)
      : message.task === 'state-step'
        ? stateStep(message.id, message.state, message.action)
        : message.task === 'text-transform'
          ? transformText(message.id, message.input, message.mode)
        : message.task === 'hash-sha256'
          ? await hashSha256(message.id, message.input)
        : (() => { throw new Error(`未知任务：${message.task}`) })()
    send({ type: 'result', id: message.id, result })
  } catch (error) {
    send({ type: 'error', id: message.id, name: error.name, message: error.message })
  }
}
