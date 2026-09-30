/*
 * Help centre: every <article data-page> in help.html is one page. The
 * sidebar, search, "on this page" outline and prev/next links are built here.
 * Pages are addressed as /help#page or /help#page/section.
 */
(() => {
  const $ = (s, r = document) => r.querySelector(s)
  const pages = [...document.querySelectorAll('article[data-page]')]
  const nav = $('#nav'), toc = $('#toc'), pager = $('#pager'), q = $('#q')
  const side = $('#side'), menu = $('#menu'), main = $('#main')
  const byId = Object.fromEntries(pages.map((p) => [p.dataset.page, p]))
  let current = null
  let spy = null

  /* ---------------------------------------------------- sidebar */
  const groups = []
  for (const p of pages) {
    let g = groups.find((x) => x.name === p.dataset.group)
    if (!g) groups.push(g = { name: p.dataset.group, pages: [] })
    g.pages.push(p)
  }
  nav.innerHTML = groups.map((g) => `
    <div class="nav-group">
      <p class="nav-title">${g.name}</p>
      ${g.pages.map((p) => `<a href="#${p.dataset.page}" data-to="${p.dataset.page}"><i class="fa-solid ${p.dataset.icon || 'fa-file-lines'}"></i><span>${p.dataset.title}</span></a>`).join('')}
    </div>`).join('') + '<p class="nav-empty" hidden>찾는 내용이 없어요</p>'

  /* ---------------------------------------------------- headings get anchors */
  for (const p of pages) {
    for (const h of p.querySelectorAll('h2[id]')) {
      h.id = `${p.dataset.page}--${h.id}`
      const a = document.createElement('a')
      a.className = 'anchor'
      a.href = `#${p.dataset.page}/${h.id.split('--')[1]}`
      a.setAttribute('aria-label', '이 제목 링크')
      a.innerHTML = '<i class="fa-solid fa-link"></i>'
      h.append(a)
    }
  }

  /* ---------------------------------------------------- showing a page */
  function show(id, section, push) {
    const page = byId[id] || pages[0]
    if (current !== page) {
      pages.forEach((p) => { p.hidden = p !== page })
      current = page
      document.title = `${page.dataset.title} · ODIT 도움말`
      for (const a of nav.querySelectorAll('a')) a.toggleAttribute('aria-current', a.dataset.to === page.dataset.page)
      buildToc(page)
      buildPager(page)
    }
    if (push) history.pushState(null, '', `#${page.dataset.page}${section ? '/' + section : ''}`)
    const target = section && document.getElementById(`${page.dataset.page}--${section}`)
    if (target) target.scrollIntoView({ block: 'start' })
    else window.scrollTo(0, 0)
    closeMenu()
  }

  // a heading's own words, without the link icon appended to it
  const headingText = (h) => [...h.childNodes].filter((n) => !(n.classList && n.classList.contains('anchor'))).map((n) => n.textContent).join('').trim()
  const esc = (t) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

  function buildToc(page) {
    const hs = [...page.querySelectorAll('h2[id]')]
    toc.innerHTML = hs.length ? `<p class="toc-title">이 페이지</p>` + hs.map((h) =>
      `<a href="#${page.dataset.page}/${h.id.split('--')[1]}" data-h="${h.id}">${esc(headingText(h))}</a>`).join('') : ''
    spy?.disconnect()
    if (!hs.length) return
    const links = [...toc.querySelectorAll('a')]
    const mark = (id) => links.forEach((l) => l.classList.toggle('on', l.dataset.h === id))
    mark(hs[0].id)
    spy = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (vis[0]) mark(vis[0].target.id)
    }, { rootMargin: '-70px 0px -65% 0px' })
    hs.forEach((h) => spy.observe(h))
  }

  function buildPager(page) {
    const i = pages.indexOf(page)
    const prev = pages[i - 1], next = pages[i + 1]
    const card = (p, dir) => p ? `<a class="pager-card ${dir}" href="#${p.dataset.page}">
        <span class="pager-dir">${dir === 'prev' ? '<i class="fa-solid fa-arrow-left"></i> 이전' : '다음 <i class="fa-solid fa-arrow-right"></i>'}</span>
        <span class="pager-title">${p.dataset.title}</span></a>` : '<span></span>'
    pager.innerHTML = card(prev, 'prev') + card(next, 'next')
  }

  const fromHash = () => {
    const [id, section] = decodeURIComponent(location.hash.slice(1)).split('/')
    show(id, section, false)
  }
  addEventListener('hashchange', fromHash)
  fromHash()

  /* ---------------------------------------------------- search */
  const text = Object.fromEntries(pages.map((p) => [p.dataset.page, (p.dataset.title + ' ' + p.textContent).toLowerCase()]))
  q.addEventListener('input', () => {
    const term = q.value.trim().toLowerCase()
    let any = false
    for (const g of nav.querySelectorAll('.nav-group')) {
      let shown = 0
      for (const a of g.querySelectorAll('a')) {
        const hit = !term || text[a.dataset.to].includes(term)
        a.hidden = !hit
        if (hit) shown++
      }
      g.hidden = !shown
      any ||= shown > 0
    }
    nav.querySelector('.nav-empty').hidden = any
  })
  q.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const first = [...nav.querySelectorAll('a')].find((a) => !a.hidden && !a.closest('[hidden]'))
      if (first) location.hash = first.dataset.to
    }
    if (e.key === 'Escape') { q.value = ''; q.dispatchEvent(new Event('input')); q.blur() }
  })
  addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      openMenu()
      q.focus()
      q.select()
    }
  })

  /* ---------------------------------------------------- phone drawer */
  function openMenu() { if (innerWidth <= 900) { side.classList.add('open'); menu.setAttribute('aria-expanded', 'true') } }
  function closeMenu() { side.classList.remove('open'); menu.setAttribute('aria-expanded', 'false') }
  menu.addEventListener('click', () => side.classList.contains('open') ? closeMenu() : openMenu())
  main.addEventListener('click', () => closeMenu())
})()
