// One continuous foreground second. Callers own the observer lifecycle.
export function observeDuoVisibility(element, onVisible, { document: doc = document, Observer = IntersectionObserver, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  let timer = null, intersecting = false, done = false
  const cancel = () => { if (timer !== null) clearTimer(timer); timer = null }
  const update = () => {
    cancel()
    if (done || !intersecting || doc.visibilityState !== 'visible') return
    timer = setTimer(() => {
      timer = null
      if (done || !intersecting || doc.visibilityState !== 'visible') return
      done = true; observer.disconnect(); doc.removeEventListener('visibilitychange', update); onVisible()
    }, 1000)
  }
  const observer = new Observer(entries => {
    // A delivery can contain several queued crossings for the same element.
    // Only its final state can start or continue the visibility interval.
    let latest
    for (const entry of entries) if (entry.target === element) latest = entry
    if (!latest) return
    intersecting = latest.isIntersecting && latest.intersectionRatio >= 0.5
    update()
  }, { threshold: [0.5] })
  doc.addEventListener('visibilitychange', update)
  observer.observe(element)
  return () => { done = true; cancel(); observer.disconnect(); doc.removeEventListener('visibilitychange', update) }
}
