/*
 * Every headline has its own entrance, matching what its section is about
 * (data-anim). Headlines are split into lines → words → letters so CSS can
 * stagger them; pictures all share the same plain fade-up (.reveal).
 */
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches

function split(el) {
  const lines = [[]]
  for (const n of [...el.childNodes]) {
    if (n.nodeName === 'BR') lines.push([])
    else lines[lines.length - 1].push(n.textContent)
  }
  el.textContent = ''
  let i = 0
  lines.forEach((parts, li) => {
    const text = parts.join('').trim()
    const line = document.createElement('span')
    line.className = 'line'
    line.style.setProperty('--l', li)
    line.dataset.t = text
    const len = [...text.replace(/\s/g, '')].length || 1
    let x = 0
    text.split(/\s+/).forEach((word, wi) => {
      if (wi) line.append(' ')
      const w = document.createElement('span')
      w.className = 'w'
      w.style.setProperty('--w', wi + li * 4)
      for (const c of word) {
        const ch = document.createElement('span')
        ch.className = 'ch'
        ch.textContent = c
        ch.dataset.c = c
        ch.style.setProperty('--i', i++)
        ch.style.setProperty('--x', (x++ / len).toFixed(3))
        ch.style.setProperty('--r', Math.random().toFixed(3))
        w.append(ch)
      }
      line.append(w)
    })
    el.append(line)
  })
  el.style.setProperty('--n', i)
}

// numbers and operators churn, then each letter settles — for the "수식" card
function calc(el) {
  const glyphs = '0123456789+−×÷={}∑√'
  const chars = [...el.querySelectorAll('.ch')]
  const t0 = performance.now()
  const step = (now) => {
    let busy = false
    chars.forEach((ch, k) => {
      const settle = 260 + k * 55
      if (now - t0 < settle) {
        busy = true
        ch.textContent = glyphs[(Math.random() * glyphs.length) | 0]
        ch.classList.add('churn')
      } else if (ch.classList.contains('churn')) {
        ch.textContent = ch.dataset.c
        ch.classList.remove('churn')
      }
    })
    if (busy) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
  // frames can stall in a background tab; never leave the headline scrambled
  setTimeout(() => chars.forEach((ch) => { ch.textContent = ch.dataset.c; ch.classList.remove('churn') }), 260 + chars.length * 55 + 400)
}

function play(el) {
  if (el.dataset.anim === 'play') {
    const bar = document.createElement('span')
    bar.className = 'playbar'
    bar.addEventListener('animationend', () => bar.remove())
    el.append(bar)
  }
  el.classList.add('in')
  if (el.dataset.anim === 'calc') calc(el)
}

const heads = document.querySelectorAll('[data-anim]')
const reveals = document.querySelectorAll('.reveal')

if (reduce || !('IntersectionObserver' in window)) {
  reveals.forEach((el) => el.classList.add('in'))
  heads.forEach((el) => el.classList.add('in', 'still'))
} else {
  heads.forEach((el) => { if (el.dataset.anim !== 'mask' && el.dataset.anim !== 'ghost') split(el) })
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue
      io.unobserve(e.target)
      if (e.target.matches('[data-anim]')) play(e.target)
      else e.target.classList.add('in')
    }
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.2 })
  heads.forEach((el) => io.observe(el))
  reveals.forEach((el) => io.observe(el))
}

// Hero screenshot lies back and straightens up as the page scrolls.
const tilt = document.querySelector('[data-tilt]')
if (tilt && !reduce) {
  const upd = () => {
    const r = tilt.getBoundingClientRect()
    const p = Math.min(1, Math.max(0, (r.top - innerHeight * 0.15) / (innerHeight * 0.55)))
    tilt.style.setProperty('--t', p.toFixed(3))
  }
  addEventListener('scroll', upd, { passive: true })
  addEventListener('resize', upd)
  upd()
} else if (tilt) tilt.style.setProperty('--t', 0)

// Numbers count up the first time they come into view.
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
    setTimeout(() => nums.forEach((n) => { n.textContent = n.dataset.count }), 1600)
  }, { threshold: 0.4 })
  so.observe(stats)
}

/* ════════════════ v4 interactive sections ════════════════ */

// Hero frame grows to the edges as you scroll past it.
for (const z of document.querySelectorAll('[data-zoom]')) {
  const upd = () => {
    const r = z.getBoundingClientRect()
    const p = Math.min(1, Math.max(0, 1 - (r.top - innerHeight * 0.1) / (innerHeight * 0.6)))
    z.style.setProperty('--z', (reduce ? 1 : p).toFixed(3))
  }
  addEventListener('scroll', upd, { passive: true }); addEventListener('resize', upd); upd()
}

// Carousel: snap scrolling, dots that fill while a slide is shown, pause, arrows.
for (const car of document.querySelectorAll('[data-carousel]')) {
  const track = car.querySelector('.car-track')
  const slides = [...track.children]
  const dots = car.querySelector('.car-dots')
  const btn = car.querySelector('.car-play')
  const DUR = 5000
  let idx = 0, playing = !reduce, timer = null, start = 0
  dots.innerHTML = slides.map((_, i) => `<button type="button" aria-label="${i + 1}번째"><i></i></button>`).join('')
  const dotEls = [...dots.children]
  const paint = () => dotEls.forEach((d, i) => {
    d.classList.toggle('on', i === idx)
    d.firstChild.style.animation = 'none'; void d.offsetWidth
    d.firstChild.style.animation = i === idx && playing ? `carFill ${DUR}ms linear forwards` : ''
  })
  const go = (i, smooth = true) => {
    idx = (i + slides.length) % slides.length
    track.scrollTo({ left: slides[idx].offsetLeft - track.offsetLeft - (track.clientWidth - slides[idx].clientWidth) / 2, behavior: smooth ? 'smooth' : 'auto' })
    paint(); arm()
  }
  const arm = () => { clearTimeout(timer); if (playing) timer = setTimeout(() => go(idx + 1), DUR) }
  dotEls.forEach((d, i) => d.addEventListener('click', () => go(i)))
  car.querySelector('.car-prev')?.addEventListener('click', () => go(idx - 1))
  car.querySelector('.car-next')?.addEventListener('click', () => go(idx + 1))
  btn?.addEventListener('click', () => {
    playing = !playing
    btn.querySelector('i').className = playing ? 'fa-solid fa-pause' : 'fa-solid fa-play'
    btn.setAttribute('aria-label', playing ? '일시정지' : '재생')
    paint(); arm()
  })
  if (btn && !playing) btn.querySelector('i').className = 'fa-solid fa-play'
  // follow manual swipes
  let st = null
  track.addEventListener('scroll', () => {
    clearTimeout(st)
    st = setTimeout(() => {
      const c = track.scrollLeft + track.clientWidth / 2
      let best = 0, bd = Infinity
      slides.forEach((s, i) => { const d = Math.abs(s.offsetLeft - track.offsetLeft + s.clientWidth / 2 - c); if (d < bd) { bd = d; best = i } })
      if (best !== idx) { idx = best; paint(); arm() }
    }, 120)
  }, { passive: true })
  // only run while on screen
  new IntersectionObserver(([e]) => { if (e.isIntersecting) { paint(); arm() } else clearTimeout(timer) }, { threshold: 0.3 }).observe(car)
  slides.forEach((s, i) => s.addEventListener('click', () => { if (i !== idx) go(i) }))
}

// Sticky story: the step in the middle of the screen picks the picture.
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

// Tab viewer: one big picture, buttons choose which.
for (const v of document.querySelectorAll('[data-viewer]')) {
  const tabs = [...v.querySelectorAll('[data-show]')]
  const pics = [...v.querySelectorAll('.view-pic')]
  const pill = v.querySelector('.view-pill')
  const show = (i) => {
    tabs.forEach((t, k) => t.setAttribute('aria-selected', String(k === i)))
    pics.forEach((p, k) => p.classList.toggle('on', k === i))
    const t = tabs[i]
    if (pill && t) { pill.style.width = t.offsetWidth + 'px'; pill.style.transform = `translateX(${t.offsetLeft}px)` }
  }
  tabs.forEach((t, i) => t.addEventListener('click', () => show(i)))
  addEventListener('resize', () => show(tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true')))
  requestAnimationFrame(() => show(0))
}

// Before / after: drag anywhere on the picture, or use the keyboard on the handle.
for (const c of document.querySelectorAll('[data-compare]')) {
  const handle = c.querySelector('.cmp-handle')
  let pos = 50
  const set = (p) => { pos = Math.min(100, Math.max(0, p)); c.style.setProperty('--pos', pos + '%'); handle.setAttribute('aria-valuenow', Math.round(pos)) }
  const fromX = (x) => { const r = c.getBoundingClientRect(); set(((x - r.left) / r.width) * 100) }
  c.addEventListener('pointerdown', (e) => { c.setPointerCapture(e.pointerId); c.classList.add('drag'); fromX(e.clientX) })
  c.addEventListener('pointermove', (e) => { if (c.classList.contains('drag')) fromX(e.clientX) })
  c.addEventListener('pointerup', () => c.classList.remove('drag'))
  c.addEventListener('pointercancel', () => c.classList.remove('drag'))
  handle.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { set(pos - 5); e.preventDefault() }
    if (e.key === 'ArrowRight') { set(pos + 5); e.preventDefault() }
  })
  // a gentle sweep the first time it comes into view, so it reads as draggable
  if (!reduce) new IntersectionObserver(([e], o) => {
    if (!e.isIntersecting) return
    o.disconnect()
    const t0 = performance.now()
    const tick = (now) => {
      if (c.classList.contains('drag')) return
      const k = Math.min(1, (now - t0) / 1800)
      set(50 + Math.sin(k * Math.PI * 2) * 22 * (1 - k))
      if (k < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, { threshold: 0.6 }).observe(c)
  set(50)
}

// "+" cards open a larger look in a sheet.
const sheet = document.querySelector('.sheet')
if (sheet) {
  const body = sheet.querySelector('.sheet-body')
  const close = () => { sheet.classList.remove('in'); document.documentElement.classList.remove('modal-open'); setTimeout(() => { sheet.hidden = true }, 250) }
  for (const card of document.querySelectorAll('[data-plus]')) {
    card.addEventListener('click', () => {
      const tpl = document.getElementById(card.dataset.plus)
      body.innerHTML = tpl.innerHTML
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
