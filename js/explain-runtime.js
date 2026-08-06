const status = document.querySelector('#load-status')
const units = [...document.querySelectorAll('.explain-unit')]

const render = (card, index) => {
  const steps = [...card.querySelectorAll('.step')]
  steps.forEach((step, stepIndex) => {
    step.hidden = stepIndex !== index
    step.dataset.current = stepIndex === index ? 'true' : 'false'
  })
  const title = steps[index]?.querySelector('strong')?.textContent || '当前步骤'
  const unitStatus = card.querySelector('.unit-status')
  if (unitStatus) unitStatus.textContent = `第 ${index + 1}/${steps.length} 步：${title}`
  card.dataset.stepIndex = String(index)
}

for (const card of units) {
  card.dataset.stepIndex = '0'
  const advance = card.querySelector('[data-action="advance"]')
  const reset = card.querySelector('[data-action="reset"]')
  advance?.addEventListener('click', () => {
    const total = card.querySelectorAll('.step').length
    render(card, (Number(card.dataset.stepIndex) + 1) % total)
  })
  reset?.addEventListener('click', () => render(card, 0))
}

const url = document.body.dataset.explainUrl
if (url && status) {
  try {
    const response = await fetch(url, { cache: 'force-cache' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const payload = await response.json()
    const freshUnits = Array.isArray(payload.units) ? payload.units : []
    if (freshUnits.length < units.length) throw new Error('schema payload mismatch')
    status.textContent = `已校验版本化 explain JSON；${freshUnits.length} 个单元共用同一 schema。`
  } catch (error) {
    status.classList.add('error')
    status.textContent = `版本化 explain JSON 不可用，继续使用预渲染静态回退：${error.message}`
  }
}
