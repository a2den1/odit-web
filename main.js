/*
 * Landing pages: headline entrances, scroll zoom, highlights carousel,
 * sticky story, tab viewer, before/after slider, numbers and "+" sheets.
 */
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches

/* ── headlines: split into lines (.line > .lin) and words (.w) — never letters ── */
function split(el) {
  const lines = [[]]
  for (const n of [...el.childNodes]) {
    if (n.nodeName === 'BR') lines.push([])
    else lines[lines.length - 1].push(n.textContent)
  }
  el.textContent = ''
  let w = 0
  lines.forEach((parts, li) => {
    const line = document.createElement('span')
    line.className = 'line'
    const inner = document.createElement('span')
    inner.className = 'lin'
    inner.style.setProperty('--l', li)
    parts.join('').trim().split(/\s+/).forEach((word, i) => {
      if (i) inner.append(' ')
      const s = document.createElement('span')
      s.className = 'w'
      s.textContent = word
      s.style.setProperty('--w', w++)
      inner.append(s)
    })
    line.append(inner)
    el.append(line)
  })
}

const heads = [...document.querySelectorAll('[data-anim]')]
const reveals = [...document.querySelectorAll('.reveal')]
if (reduce || !('IntersectionObserver' in window)) {
  heads.concat(reveals).forEach((el) => el.classList.add('in'))
} else {
  heads.forEach(split)
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) }
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.25 })
  heads.concat(reveals).forEach((el) => io.observe(el))
}

/* ── hero picture settles to full size as you scroll ── */
for (const z of document.querySelectorAll('[data-zoom]')) {
  const upd = () => {
    const r = z.getBoundingClientRect()
    const p = Math.min(1, Math.max(0, 1 - (r.top - innerHeight * 0.15) / (innerHeight * 0.55)))
    z.style.setProperty('--z', (reduce ? 1 : p).toFixed(3))
  }
  addEventListener('scroll', upd, { passive: true })
  addEventListener('resize', upd)
  upd()
}

/* ── carousel: snap, auto-advance with a filling dot, pause, arrows, swipe ── */
for (const car of document.querySelectorAll('[data-carousel]')) {
  const track = car.querySelector('.car-track')
  const slides = [...track.children]
  const dots = car.querySelector('.car-dots')
  const btn = car.querySelector('.car-play')
  const DUR = 5000
  let idx = 0, playing = !reduce, timer = null, visible = false
  dots.innerHTML = slides.map((_, i) => `<button type="button" aria-label="${i + 1}번째 보기"><i></i></button>`).join('')
  const dotEls = [...dots.children]
  const paint = () => {
    slides.forEach((s, i) => s.classList.toggle('on', i === idx))
    dotEls.forEach((d, i) => {
      d.classList.toggle('on', i === idx)
      const bar = d.firstChild
      bar.style.animation = 'none'
      void bar.offsetWidth
      bar.style.animation = i === idx && playing && visible ? `carFill ${DUR}ms linear forwards` : ''
      bar.style.width = i === idx && !(playing && visible) ? '100%' : ''
    })
  }
  const arm = () => { clearTimeout(timer); if (playing && visible) timer = setTimeout(() => go(idx + 1), DUR) }
  const go = (i) => {
    idx = (i + slides.length) % slides.length
    const s = slides[idx]
    track.scrollTo({ left: s.offsetLeft - (track.clientWidth - s.clientWidth) / 2, behavior: reduce ? 'auto' : 'smooth' })
    paint(); arm()
  }
  dotEls.forEach((d, i) => d.addEventListener('click', () => go(i)))
  car.querySelector('.car-prev')?.addEventListener('click', () => go(idx - 1))
  car.querySelector('.car-next')?.addEventListener('click', () => go(idx + 1))
  slides.forEach((s, i) => s.addEventListener('click', () => { if (i !== idx) go(i) }))
  const setBtn = () => {
    if (!btn) return
    btn.querySelector('i').className = playing ? 'fa-solid fa-pause' : 'fa-solid fa-play'
    btn.setAttribute('aria-label', playing ? '일시정지' : '재생')
  }
  btn?.addEventListener('click', () => { playing = !playing; setBtn(); paint(); arm() })
  setBtn()
  let settle = null
  track.addEventListener('scroll', () => {
    clearTimeout(settle)
    settle = setTimeout(() => {
      const mid = track.scrollLeft + track.clientWidth / 2
      let best = idx, bd = Infinity
      slides.forEach((s, i) => { const d = Math.abs(s.offsetLeft + s.clientWidth / 2 - mid); if (d < bd) { bd = d; best = i } })
      if (best !== idx) { idx = best; paint(); arm() }
    }, 120)
  }, { passive: true })
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; paint(); arm() }, { threshold: 0.35 }).observe(car)
  paint()
}

/* ── sticky story: the step in the middle of the screen picks the picture ── */
for (const story of document.querySelectorAll('[data-story]')) {
  const steps = [...story.querySelectorAll('.step')]
  const pics = [...story.querySelectorAll('.story-pic')]
  const set = (i) => {
    steps.forEach((s, k) => s.classList.toggle('on', k === i))
    pics.forEach((p, k) => p.classList.toggle('on', k === i))
    story.style.setProperty('--prog', ((i + 1) / steps.length).toFixed(3))
  }
  set(0)
  const so = new IntersectionObserver((es) => {
    for (const e of es) if (e.isIntersecting) set(steps.indexOf(e.target))
  }, { rootMargin: '-45% 0px -45% 0px' })
  steps.forEach((s) => so.observe(s))
}

/* ── tab viewer ── */
for (const v of document.querySelectorAll('[data-viewer]')) {
  const tabs = [...v.querySelectorAll('[data-show]')]
  const pics = [...v.querySelectorAll('.view-pic')]
  const pill = v.querySelector('.view-pill')
  let cur = 0
  const show = (i) => {
    cur = i
    tabs.forEach((t, k) => t.setAttribute('aria-selected', String(k === i)))
    pics.forEach((p, k) => p.classList.toggle('on', k === i))
    const t = tabs[i]
    if (pill && t) { pill.style.width = t.offsetWidth + 'px'; pill.style.transform = `translateX(${t.offsetLeft}px)` }
  }
  tabs.forEach((t, i) => t.addEventListener('click', () => show(i)))
  addEventListener('resize', () => show(cur))
  document.fonts?.ready.then(() => show(cur))
  show(0)
}

/* ── before / after slider ── */
for (const c of document.querySelectorAll('[data-compare]')) {
  const handle = c.querySelector('.cmp-handle')
  let pos = 50, touched = false
  const set = (p) => { pos = Math.min(100, Math.max(0, p)); c.style.setProperty('--pos', pos + '%'); handle.setAttribute('aria-valuenow', Math.round(pos)) }
  const fromX = (x) => { const r = c.getBoundingClientRect(); set(((x - r.left) / r.width) * 100) }
  c.addEventListener('pointerdown', (e) => { touched = true; c.setPointerCapture(e.pointerId); c.classList.add('drag'); fromX(e.clientX) })
  c.addEventListener('pointermove', (e) => { if (c.classList.contains('drag')) fromX(e.clientX) })
  for (const ev of ['pointerup', 'pointercancel']) c.addEventListener(ev, () => c.classList.remove('drag'))
  handle.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { touched = true; set(pos - 5); e.preventDefault() }
    if (e.key === 'ArrowRight') { touched = true; set(pos + 5); e.preventDefault() }
  })
  set(50)
  // one gentle sweep the first time it is seen, so it reads as draggable
  if (!reduce) new IntersectionObserver(([e], o) => {
    if (!e.isIntersecting) return
    o.disconnect()
    const t0 = performance.now()
    const tick = (now) => {
      if (touched) return
      const k = Math.min(1, (now - t0) / 1800)
      set(50 + Math.sin(k * Math.PI * 2) * 20 * (1 - k))
      if (k < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, { threshold: 0.6 }).observe(c)
}

/* ── numbers count up once ── */
const stats = document.querySelector('[data-stats]')
if (stats && 'IntersectionObserver' in window && !reduce) {
  const nums = [...stats.querySelectorAll('[data-count]')]
  nums.forEach((n) => { n.textContent = '0' })
  const so = new IntersectionObserver((es) => {
    if (!es.some((e) => e.isIntersecting)) return
    so.disconnect()
    const t0 = performance.now()
    const step = (now) => {
      const k = Math.min(1, (now - t0) / 1200)
      const e = 1 - Math.pow(1 - k, 3)
      nums.forEach((n) => { n.textContent = String(Math.round(Number(n.dataset.count) * e)) })
      if (k < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
    setTimeout(() => nums.forEach((n) => { n.textContent = n.dataset.count }), 1500)
  }, { threshold: 0.4 })
  so.observe(stats)
}

/* ── "+" cards open a sheet ── */
const sheet = document.querySelector('.sheet')
if (sheet) {
  const body = sheet.querySelector('.sheet-body')
  let opener = null
  const close = () => {
    sheet.classList.remove('in')
    document.documentElement.classList.remove('modal-open')
    setTimeout(() => { sheet.hidden = true; opener?.focus() }, 280)
  }
  for (const card of document.querySelectorAll('[data-plus]')) {
    card.addEventListener('click', () => {
      opener = card
      body.innerHTML = document.getElementById(card.dataset.plus).innerHTML
      sheet.hidden = false
      document.documentElement.classList.add('modal-open')
      void sheet.offsetWidth
      sheet.classList.add('in')
      sheet.querySelector('.sheet-x').focus()
    })
  }
  sheet.querySelector('.sheet-x').addEventListener('click', close)
  sheet.addEventListener('pointerdown', (e) => { if (e.target === sheet) close() })
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !sheet.hidden) close() })
}
