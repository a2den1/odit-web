// Scroll reveal for the feature rows and the "why" cards.
const revealables = document.querySelectorAll('.feature, .why')
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue
      e.target.classList.add('in')
      io.unobserve(e.target)
    }
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.15 })
  revealables.forEach((el, i) => {
    if (el.classList.contains('why')) el.style.transitionDelay = (i % 3) * 70 + 'ms'
    io.observe(el)
  })
} else {
  revealables.forEach((el) => el.classList.add('in'))
}
