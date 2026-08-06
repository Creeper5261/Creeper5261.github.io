function utf8ToBase64(value) {
  const bytes = new TextEncoder().encode(String(value ?? ''))
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  }
  return btoa(binary)
}

function base64ToUtf8(value) {
  const binary = atob(String(value ?? '').replace(/\s+/g, ''))
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
}

function unicodeEscape(value) {
  return [...String(value ?? '')].map((character) => {
    const code = character.codePointAt(0)
    return code > 0xffff ? `\\u{${code.toString(16)}}` : `\\u${code.toString(16).padStart(4, '0')}`
  }).join('')
}

function unicodeRestore(value) {
  return String(value ?? '').replace(/\\u\{([0-9a-fA-F]+)\}|\\u([0-9a-fA-F]{4})/g, (_, codePoint, codeUnit) => String.fromCodePoint(Number.parseInt(codePoint || codeUnit, 16)))
}

export function transformText(input, mode) {
  const value = String(input ?? '')
  switch (mode) {
    case 'json-format':
      return JSON.stringify(JSON.parse(value), null, 2)
    case 'base64-encode':
      return utf8ToBase64(value)
    case 'base64-decode':
      return base64ToUtf8(value)
    case 'url-encode':
      return encodeURIComponent(value)
    case 'url-decode':
      return decodeURIComponent(value)
    case 'unicode-escape':
      return unicodeEscape(value)
    case 'unicode-restore':
      return unicodeRestore(value)
    case 'mdx-source':
      return value
    default:
      throw new Error(`未知转换：${mode}`)
  }
}

export function transformResult(input, mode) {
  const output = transformText(input, mode)
  return { output, bytes: new TextEncoder().encode(output).byteLength }
}
