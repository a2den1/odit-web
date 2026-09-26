/*
 * Downloads: every [data-download] button ("latest" or a release asset id)
 * goes through an hCaptcha check, starts the file, then asks for the survey.
 * The release list comes from /api/releases, which also fills version/size
 * labels and, on /download, the full list of releases.
 */
(() => {
  const $ = (sel, root = document) => root.querySelector(sel)
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)]
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  const mb = (n) => (n / 1048576 >= 10 ? Math.round(n / 1048576) : (n / 1048576).toFixed(1)) + ' MB'
  const day = (iso) => { try { return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }) } catch { return '' } }
  const installerOf = (r) => r.assets.find((a) => /setup.*\.exe$/i.test(a.name)) || r.assets.find((a) => /\.exe$/i.test(a.name))

  const state = { sitekey: '', releases: [], latest: null }

  const ready = fetch('/api/releases')
    .then((r) => r.json())
    .then((j) => {
      state.sitekey = j.sitekey || ''
      state.releases = j.releases || []
      state.latest = state.releases.find((r) => !r.prerelease && installerOf(r)) || null
    })
    .catch(() => {})

  /* ------------------------------------------------------ labels */
  ready.then(() => {
    const L = state.latest
    const inst = L && installerOf(L)
    for (const m of $$('[data-download-meta]')) {
      m.textContent = inst ? `v${L.version} · ${mb(inst.size)} · Windows 10 · 11 (64비트)` : 'Windows 10 · 11 (64비트)'
    }
    if (!inst) {
      for (const b of $$('[data-download="latest"]')) {
        b.setAttribute('aria-disabled', 'true')
        const s = $('span', b)
        if (s) s.textContent = '다운로드 준비 중'
      }
    }
    renderPage()
  })

  /* ------------------------------------------------------ /download page */
  function notesHtml(md) {
    const out = []
    let list = false
    for (const raw of String(md || '').split(/\r?\n/)) {
      const line = raw.trim()
      const bullet = line.match(/^[-*]\s+(.*)$/)
      if (bullet) {
        if (!list) { out.push('<ul>'); list = true }
        out.push(`<li>${esc(bullet[1])}</li>`)
        continue
      }
      if (list) { out.push('</ul>'); list = false }
      if (!line) continue
      const h = line.match(/^#{1,6}\s+(.*)$/)
      out.push(h ? `<h4>${esc(h[1])}</h4>` : `<p>${esc(line)}</p>`)
    }
    if (list) out.push('</ul>')
    return out.join('')
  }

  function assetButtons(r, big) {
    return r.assets.map((a) => {
      const exe = /\.exe$/i.test(a.name)
      return `<button class="${big && exe ? 'btn' : 'btn btn-quiet'}" data-download="${a.id}" data-label="${esc(r.version)}">
        <i class="${exe ? 'fa-brands fa-windows' : 'fa-solid fa-file-arrow-down'}"></i>
        <span>${exe ? (big ? '다운로드' : '설치 파일') : esc(a.name)}</span><small>${mb(a.size)}</small>
      </button>`
    }).join('')
  }

  function renderPage() {
    const root = $('#releases')
    if (!root) return
    if (!state.releases.length) {
      root.innerHTML = `<div class="rel-empty"><i class="fa-solid fa-box-open"></i><p>아직 올라온 릴리스가 없습니다</p></div>`
      return
    }
    const L = state.latest || state.releases[0]
    const rest = state.releases.filter((r) => r !== L)
    root.innerHTML = `
      <article class="rel-hero">
        <div class="rel-hero-head">
          <img src="/assets/logo.svg" alt="" width="64" height="64">
          <div>
            <h2>ODIT ${esc(L.version)}${L.prerelease ? ' <span class="tag">미리보기</span>' : ''}</h2>
            <p>${day(L.date)} · Windows 10 · 11 (64비트)</p>
          </div>
        </div>
        <div class="rel-actions">${assetButtons(L, true)}</div>
        ${L.notes ? `<div class="rel-notes">${notesHtml(L.notes)}</div>` : ''}
      </article>
      ${rest.length ? `<h3 class="rel-sub">이전 버전</h3>
      <div class="rel-list">${rest.map((r) => `
        <article class="rel-row">
          <div class="rel-row-head">
            <strong>${esc(r.version)}</strong>${r.prerelease ? '<span class="tag">미리보기</span>' : ''}
            <span class="rel-date">${day(r.date)}</span>
          </div>
          ${r.notes ? `<details class="rel-more"><summary>변경 사항</summary><div class="rel-notes">${notesHtml(r.notes)}</div></details>` : ''}
          <div class="rel-actions">${assetButtons(r, false)}</div>
        </article>`).join('')}</div>` : ''}`
  }

  /* ------------------------------------------------------ modal shell */
  let modal = null
  function openModal(html) {
    closeModal()
    modal = document.createElement('div')
    modal.className = 'modal-back'
    modal.innerHTML = `<div class="modal" role="dialog" aria-modal="true">
      <button class="modal-x" type="button" aria-label="닫기"><i class="fa-solid fa-xmark"></i></button>
      <div class="modal-body">${html}</div></div>`
    document.body.appendChild(modal)
    document.documentElement.classList.add('modal-open')
    modal.addEventListener('pointerdown', (e) => { if (e.target === modal) closeModal() })
    $('.modal-x', modal).addEventListener('click', closeModal)
    requestAnimationFrame(() => modal && modal.classList.add('in'))
    return $('.modal-body', modal)
  }
  function closeModal() {
    if (!modal) return
    const m = modal
    modal = null
    m.classList.remove('in')
    document.documentElement.classList.remove('modal-open')
    setTimeout(() => m.remove(), 220)
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal() })

  /* ------------------------------------------------------ hCaptcha */
  let hcLoad = null
  function loadHcaptcha() {
    if (window.hcaptcha) return Promise.resolve()
    if (hcLoad) return hcLoad
    hcLoad = new Promise((resolve, reject) => {
      window.__oditHc = resolve
      const s = document.createElement('script')
      s.src = 'https://js.hcaptcha.com/1/api.js?render=explicit&onload=__oditHc&hl=ko'
      s.async = true
      s.onerror = () => { hcLoad = null; reject(new Error('hcaptcha')) }
      document.head.appendChild(s)
    })
    return hcLoad
  }

  async function startDownload(assetId, label) {
    const body = openModal(`
      <h2 class="modal-title">${label ? `ODIT ${esc(label)} 다운로드` : 'ODIT 다운로드'}</h2>
      <p class="modal-sub">사람인지 확인하면 바로 받아집니다.</p>
      <div class="captcha-slot"><i class="fa-solid fa-spinner fa-spin"></i></div>
      <p class="modal-err" hidden></p>`)
    const slot = $('.captcha-slot', body)
    const err = $('.modal-err', body)
    const showErr = (t) => { err.textContent = t; err.hidden = false }

    try {
      await ready
      await loadHcaptcha()
    } catch {
      slot.innerHTML = ''
      return showErr('보안 확인을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
    }
    if (!body.isConnected) return
    slot.innerHTML = '<div></div>'
    const wid = window.hcaptcha.render(slot.firstChild, {
      sitekey: state.sitekey,
      theme: 'dark',
      callback: async (token) => {
        err.hidden = true
        try {
          const r = await fetch('/api/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, assetId }),
          })
          const j = await r.json()
          if (!r.ok) throw new Error(j.error || '다운로드에 실패했습니다')
          const a = document.createElement('a')
          a.href = j.url
          a.rel = 'noopener'
          document.body.appendChild(a)
          a.click()
          a.remove()
          setTimeout(() => openSurvey(j), 500)
        } catch (e) {
          showErr(e.message)
          try { window.hcaptcha.reset(wid) } catch {}
        }
      },
      'error-callback': () => showErr('보안 확인 중 오류가 났습니다. 다시 시도해 주세요.'),
    })
  }

  /* ------------------------------------------------------ survey */
  const FOUND = ['유튜브', '디스코드', '인스타그램', '틱톡', '지인 추천', '검색', '기타']
  const EDITORS = ['캡컷', '프리미어 프로', '다빈치 리졸브', '브루', '블로', '처음이에요']
  const chips = (name, list) => `<div class="chips" data-name="${name}">${list.map((v) =>
    `<button type="button" class="chip" aria-pressed="false">${v}</button>`).join('')}</div>`

  function openSurvey(dl) {
    const body = openModal(`
      <div class="dl-started"><i class="fa-solid fa-circle-check"></i><span>${esc(dl.name)} 다운로드를 시작했어요</span></div>
      <h2 class="modal-title">설문에 참여해주세요!</h2>
      <form class="survey" novalidate>
        <label class="field"><span>ODIT를 어디서 알게 되셨나요?</span>${chips('found', FOUND)}</label>
        <label class="field"><span>원래 쓰던 편집기</span>${chips('editor', EDITORS)}</label>
        <label class="field"><span>SNS 링크</span><input name="sns" type="url" maxlength="300" placeholder="유튜브 · 인스타그램 · 틱톡 주소" autocomplete="url"></label>
        <label class="field"><span>피드백</span><textarea name="feedback" rows="4" maxlength="1800" placeholder="바라는 기능, 불편한 점, 하고 싶은 말"></textarea></label>
        <label class="field"><span>디스코드 아이디</span><input name="discord" maxlength="60" placeholder="답장 받을 아이디 (선택)" autocomplete="off"></label>
        <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
        <p class="modal-err" hidden></p>
        <div class="modal-foot">
          <button type="button" class="btn btn-quiet" data-skip>다음에</button>
          <button type="submit" class="btn"><span>보내기</span></button>
        </div>
      </form>`)

    for (const group of $$('.chips', body)) {
      group.addEventListener('click', (e) => {
        const c = e.target.closest('.chip')
        if (!c) return
        e.preventDefault()
        const on = c.getAttribute('aria-pressed') !== 'true'
        for (const x of $$('.chip', group)) x.setAttribute('aria-pressed', 'false')
        c.setAttribute('aria-pressed', String(on))
      })
    }
    $('[data-skip]', body).addEventListener('click', closeModal)

    const form = $('form', body)
    const err = $('.modal-err', body)
    form.addEventListener('submit', async (e) => {
      e.preventDefault()
      const pick = (n) => $(`.chips[data-name="${n}"] .chip[aria-pressed="true"]`, form)?.textContent || ''
      const data = {
        ticket: dl.ticket,
        found: pick('found'),
        editor: pick('editor'),
        sns: form.sns.value,
        feedback: form.feedback.value,
        discord: form.discord.value,
        website: form.website.value,
      }
      if (!data.found && !data.editor && !data.sns.trim() && !data.feedback.trim()) {
        err.textContent = '하나 이상 적어 주세요'
        err.hidden = false
        return
      }
      const submit = $('button[type="submit"]', form)
      submit.setAttribute('aria-disabled', 'true')
      try {
        const r = await fetch('/api/survey', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        const j = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(j.error || '보내지 못했어요')
        body.innerHTML = `<div class="thanks"><i class="fa-solid fa-heart"></i><h2 class="modal-title">고마워요!</h2><p class="modal-sub">보내주신 의견은 ODIT를 만드는 데 그대로 쓰입니다.</p><button class="btn" type="button">닫기</button></div>`
        $('.thanks .btn', body).addEventListener('click', closeModal)
      } catch (ex) {
        err.textContent = ex.message
        err.hidden = false
        submit.removeAttribute('aria-disabled')
      }
    })
  }

  // lets a local run open the survey without going through a real download
  if (location.hostname === 'localhost') window.__odit = { openSurvey, state }

  /* ------------------------------------------------------ wiring */
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-download]')
    if (!b || b.getAttribute('aria-disabled') === 'true') return
    e.preventDefault()
    startDownload(b.getAttribute('data-download'), b.getAttribute('data-label') || (state.latest && b.dataset.download === 'latest' ? state.latest.version : ''))
  })
})()
