import type { RefObject } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(ScrollTrigger, useGSAP)

/** One scoped choreography; native scrolling and static screenshots stay intact. */
export function useHomepageMotion(scope: RefObject<HTMLDivElement | null>) {
  useGSAP((_, contextSafe) => {
    const root = scope.current
    if (!root || !contextSafe) return
    const media = gsap.matchMedia()

    media.add({
      desktop: '(min-width: 801px)',
      mobile: '(max-width: 800px)',
      reduced: '(prefers-reduced-motion: reduce)'
    }, (context) => {
      const { desktop, reduced } = context.conditions!
      if (reduced) return
      const select = gsap.utils.selector(root)

      gsap.timeline({ defaults: { ease: 'power3.out', clearProps: 'transform,opacity' } })
        .from(select('.hero-copy .eyebrow'), { opacity: 0, y: 12, duration: 0.6 })
        .from(select('[data-hero-line]'), { yPercent: 105, duration: 1.05, stagger: 0.12 }, 0.12)
        .from(select('.hero-description'), { opacity: 0, y: 16, duration: 0.8 }, 0.42)
        .from(select('.hero-actions > a'), { opacity: 0, y: 12, duration: 0.65, stagger: 0.08 }, 0.58)
        .from(select('.hero-scene'), { opacity: 0, duration: 1 }, 0.6)

      // Scrub only the presentation wrappers, never the image or its pixels.
      gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: select('.hero-scene')[0], start: 'top 95%', end: 'top 22%', scrub: 0.5 }
      })
        .from(select('.hero-store-window'), { y: desktop ? 78 : 28, scale: desktop ? 0.94 : 0.98 }, 0)
        .from(select('.hero-plugin-window'), { y: desktop ? 112 : 36, x: desktop ? 32 : 10 }, 0)
        .from(select('.scene-word'), { y: desktop ? 34 : 12, opacity: 0.35 }, 0)

      // Build triggers in document order. Once revealed, copy remains readable.
      select('[data-reveal], .plugin-showcase, .store-gallery').forEach((element: HTMLElement) => {
        if (element.classList.contains('plugin-showcase')) {
          gsap.timeline({
            defaults: { ease: 'none' },
            scrollTrigger: { trigger: element, start: 'top 85%', end: 'top 24%', scrub: 0.45 }
          })
            .from(select('.plugin-primary .panel-drift'), { x: desktop ? -42 : -12, y: 40 }, 0)
            .from(select('.plugin-secondary .panel-drift'), { x: desktop ? 70 : 20, y: -24, opacity: 0.3 }, 0)
          return
        }
        if (element.classList.contains('store-gallery')) {
          gsap.from(element.querySelector('.store-figure'), {
            y: desktop ? 64 : 24,
            scale: desktop ? 0.95 : 0.985,
            ease: 'none',
            scrollTrigger: { trigger: element, start: 'top 90%', end: 'top 26%', scrub: 0.45 }
          })
          return
        }
        gsap.from(element, {
          y: desktop ? 28 : 16,
          opacity: 0,
          duration: 0.85,
          delay: Number(element.dataset.delay ?? 0),
          ease: 'power3.out',
          scrollTrigger: { trigger: element, start: 'top 91%', once: true },
          clearProps: 'transform,opacity'
        })
      })

      // Keyboard focus must not wait for an entrance animation to finish.
      const showFocusedCopy = contextSafe((event: FocusEvent) => {
        const element = (event.target as HTMLElement).closest<HTMLElement>('[data-reveal]')
        if (!element) return
        gsap.killTweensOf(element)
        gsap.set(element, { clearProps: 'transform,opacity' })
      })
      root.addEventListener('focusin', showFocusedCopy)
      let active = true
      const refresh = () => { if (active) ScrollTrigger.refresh() }
      void document.fonts.ready.then(refresh)

      return () => {
        active = false
        root.removeEventListener('focusin', showFocusedCopy)
      }
    })

    return () => media.revert()
  }, { scope })
}
