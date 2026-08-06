export async function hashTask(input) {
  const text = String(input ?? '')
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const output = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return { output, bytes: bytes.byteLength }
}
