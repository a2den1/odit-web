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
