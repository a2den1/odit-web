// The playhead along the top edge: page scroll read as a timecode at 30 fps,
// as if the page were a 40-second sequence being scrubbed.
const head = document.querySelector('.playhead')
const tc = document.querySelector('.playhead-tc')
const pad = (n) => String(n).padStart(2, '0')
function scrub() {
  const max = document.documentElement.scrollHeight - innerHeight
  const p = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0
  head.style.setProperty('--p', p)
  const frames = Math.round(p * 40 * 30)
  const s = Math.floor(frames / 30)
  tc.textContent = `00:00:${pad(s)}:${pad(frames % 30)}`
}
if (head) {
  addEventListener('scroll', scrub, { passive: true })
  addEventListener('resize', scrub)
  scrub()
}

// Scenes fade in as they arrive.
const scenes = document.querySelectorAll('.scene')
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) }
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 })
  scenes.forEach((s) => io.observe(s))
} else {
  scenes.forEach((s) => s.classList.add('in'))
}
