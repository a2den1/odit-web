/*
 * Bug report: text, version, attachments and an hCaptcha check, posted to
 * /api/report which forwards it all to the owner's Discord DMs. Large images
 * are shrunk here first so a few screenshots fit under the 3 MB limit.
 */
(() => {
  const $ = (s) => document.querySelector(s)
  const form = $('#form'), err = $('#err'), sendBtn = $('#send')
  const drop = $('#drop'), input = $('#file'), list = $('#files')
  const MAX_FILES = 6, MAX_TOTAL = 3 * 1024 * 1024
  const PRODUCT = location.pathname.startsWith('/3d') ? '3d' : 'odit'
  const files = []          // { name, type, blob, url }
  let token = '', widget = null

  const mb = (n) => n < 1024 * 1024 ? Math.max(1, Math.round(n / 1024)) + ' KB' : (n / 1048576).toFixed(1) + ' MB'
  const total = () => files.reduce((s, f) => s + f.blob.size, 0)
  const showErr = (t) => { err.textContent = t; err.hidden = !t }

  /* ------------------------------------------------ versions */
  const chips = $('#versions')
  const pick = (c) => { for (const x of chips.children) x.setAttribute('aria-pressed', String(x === c)) }
  chips.addEventListener('click', (e) => { const c = e.target.closest('.chip'); if (c) pick(c) })
  const ready = fetch('/api/releases?p=' + PRODUCT).then((r) => r.json()).catch(() => ({}))
  ready.then((j) => {
    const vs = (j.releases || []).map((r) => r.version)
    chips.insertAdjacentHTML('afterbegin', vs.map((v) => `<button type="button" class="chip" aria-pressed="false">${v}</button>`).join(''))
    if (chips.firstElementChild) pick(chips.firstElementChild)
  })

  /* ------------------------------------------------ attachments */
  async function shrink(file) {
    // stills only: keep GIFs (they may move) and anything already small
    if (!/^image\/(png|jpeg|webp|bmp)$/.test(file.type) || file.size < 700 * 1024) return file
    try {
      const bmp = await createImageBitmap(file)
      const k = Math.min(1, 1920 / Math.max(bmp.width, bmp.height))
      const c = document.createElement('canvas')
      c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k)
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
      const out = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85))
      return out && out.size < file.size ? new File([out], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file
    } catch { return file }
  }

  async function add(picked) {
    showErr('')
    for (const f of picked) {
      if (files.length >= MAX_FILES) { showErr(`첨부는 ${MAX_FILES}개까지예요`); break }
      const blob = await shrink(f)
      if (total() + blob.size > MAX_TOTAL) { showErr(`${f.name}은(는) 너무 커요. 모두 합쳐 3 MB까지 보낼 수 있어요`); continue }
      files.push({ name: blob.name || f.name, type: blob.type || f.type, blob, url: /^image\//.test(blob.type) ? URL.createObjectURL(blob) : '' })
    }
    render()
  }

  function render() {
    list.innerHTML = files.map((f, i) => `
      <li>
        ${f.url ? `<img src="${f.url}" alt="">` : '<span class="file-icon"><i class="fa-solid fa-file"></i></span>'}
        <span class="file-name">${f.name.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))}</span>
        <span class="file-size">${mb(f.blob.size)}</span>
        <button type="button" data-rm="${i}" aria-label="빼기"><i class="fa-solid fa-xmark"></i></button>
      </li>`).join('')
  }
  list.addEventListener('click', (e) => {
    const b = e.target.closest('[data-rm]')
    if (!b) return
    const [f] = files.splice(Number(b.dataset.rm), 1)
    if (f.url) URL.revokeObjectURL(f.url)
    render()
  })
  input.addEventListener('change', () => { add([...input.files]); input.value = '' })
  for (const ev of ['dragenter', 'dragover']) drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over') })
  for (const ev of ['dragleave', 'drop']) drop.addEventListener(ev, () => drop.classList.remove('over'))
  drop.addEventListener('drop', (e) => { e.preventDefault(); add([...e.dataTransfer.files]) })
  addEventListener('paste', (e) => {
    const pasted = [...(e.clipboardData?.files || [])]
    if (pasted.length) add(pasted)
  })

  /* ------------------------------------------------ captcha */
  window.__oditReportHc = async () => {
    const j = await ready
    const slot = $('#captcha')
    slot.innerHTML = '<div></div>'
    widget = window.hcaptcha.render(slot.firstChild, {
      sitekey: j.sitekey || '10000000-ffff-ffff-ffff-000000000001',
      theme: 'dark',
      callback: (t) => { token = t; showErr('') },
      'expired-callback': () => { token = '' },
    })
  }
  const s = document.createElement('script')
  s.src = 'https://js.hcaptcha.com/1/api.js?render=explicit&onload=__oditReportHc&hl=ko'
  s.async = true
  s.onerror = () => showErr('보안 확인을 불러오지 못했어요. 새로고침해 주세요.')
  document.head.appendChild(s)

  /* ------------------------------------------------ send */
  const b64 = (blob) => new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result).split(',')[1] || '')
    r.onerror = rej
    r.readAsDataURL(blob)
  })

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    if (!form.what.value.trim()) { showErr('어떤 문제인지 적어 주세요'); form.what.focus(); return }
    if (!token) { showErr('보안 확인을 먼저 해 주세요'); return }
    sendBtn.setAttribute('aria-disabled', 'true')
    sendBtn.querySelector('span').textContent = '보내는 중…'
    try {
      const body = {
        token,
        product: PRODUCT,
        what: form.what.value,
        steps: form.steps.value,
        version: chips.querySelector('[aria-pressed="true"]')?.textContent || '',
        website: form.website.value,
        files: await Promise.all(files.map(async (f) => ({ name: f.name, type: f.type, data: await b64(f.blob) }))),
      }
      const r = await fetch('/api/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || '보내지 못했어요')
      form.hidden = true
      $('#done').hidden = false
      window.scrollTo(0, 0)
    } catch (ex) {
      showErr(ex.message)
      token = ''
      try { window.hcaptcha.reset(widget) } catch {}
    } finally {
      sendBtn.removeAttribute('aria-disabled')
      sendBtn.querySelector('span').textContent = '보내기'
    }
  })

  $('#again').addEventListener('click', () => {
    form.reset()
    files.splice(0).forEach((f) => f.url && URL.revokeObjectURL(f.url))
    render()
    token = ''
    try { window.hcaptcha.reset(widget) } catch {}
    if (chips.firstElementChild) pick(chips.firstElementChild)
    $('#done').hidden = true
    form.hidden = false
  })

  // lets a local run exercise the send path without solving a real captcha
  if (location.hostname === 'localhost') window.__oditReport = { setToken: (t) => { token = t }, files }
})()
