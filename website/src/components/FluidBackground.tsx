import { Component, lazy, Suspense, useCallback, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Pause, Play } from 'lucide-react'
import identity from '../../brand/identity.json'

const LiquidEther = lazy(() => import('./backgrounds/LiquidEther'))

class BackgroundBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? null : this.props.children }
}

function useMediaQuery(query: string) {
  const subscribe = useCallback((notify: () => void) => {
    const media = window.matchMedia(query)
    media.addEventListener('change', notify)
    return () => media.removeEventListener('change', notify)
  }, [query])
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches)
}

export default function FluidBackground() {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const compact = useMediaQuery('(max-width: 800px)')
  const [paused, setPaused] = useState(false)

  return (
    <>
      <div className="hero-fluid" aria-hidden="true">
        {!reducedMotion && !paused && (
          <BackgroundBoundary>
            <Suspense fallback={null}>
              <LiquidEther
                colors={[identity.colors.suite, identity.colors.plugin]}
                mouseForce={18}
                cursorSize={compact ? 90 : 150}
                resolution={compact ? 0.3 : 0.45}
                maxDevicePixelRatio={compact ? 1 : 1.5}
                maxFps={compact ? 30 : 60}
                persistence={0.65}
                autoSpeed={0.3}
                autoIntensity={1.5}
                autoResumeDelay={2000}
                clickBurst={false}
                lightMode
              />
            </Suspense>
          </BackgroundBoundary>
        )}
      </div>
      {!reducedMotion && (
        <button
          className="fluid-toggle"
          type="button"
          aria-pressed={!paused}
          aria-label="背景动效"
          onClick={() => setPaused(value => !value)}
        >
          {paused ? <Play size={13} aria-hidden="true" /> : <Pause size={13} aria-hidden="true" />}
          <span>{paused ? '播放背景' : '暂停背景'}</span>
        </button>
      )}
    </>
  )
}
