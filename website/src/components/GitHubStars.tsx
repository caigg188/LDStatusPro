import { useEffect, useState } from 'react'
import { Github, Star } from 'lucide-react'
import { links } from '../config/links'

const cacheKey = 'ldsp-github-stars-v1'
const maxAge = 10 * 60 * 1000

function readCache(): number | null {
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null')
    return cached &&
      Number.isSafeInteger(cached.count) &&
      cached.count >= 0 &&
      Number.isFinite(cached.at) &&
      Date.now() - cached.at >= 0 &&
      Date.now() - cached.at < maxAge
      ? cached.count
      : null
  } catch {
    return null
  }
}

export default function GitHubStars() {
  const [count, setCount] = useState<number | null>(readCache)
  useEffect(() => {
    if (readCache() !== null) return
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 6000)
    fetch('https://api.github.com/repos/caigg188/LDStatusPro', { signal: controller.signal, credentials: 'omit' })
      .then((response) => {
        if (!response.ok) throw new Error('GitHub unavailable')
        return response.json()
      })
      .then((data) => {
        if (controller.signal.aborted || !Number.isSafeInteger(data.stargazers_count) || data.stargazers_count < 0)
          return
        setCount(data.stargazers_count)
        try {
          localStorage.setItem(cacheKey, JSON.stringify({ count: data.stargazers_count, at: Date.now() }))
        } catch {
          /* Storage is optional. */
        }
      })
      .catch(() => {
        /* Keep a working Star link when GitHub is unavailable. */
      })
      .finally(() => window.clearTimeout(timeout))
    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [])
  return (
    <a
      className="github-stars"
      href={links.github}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={
        count === null ? '在 GitHub 为 LDStatusPro 点 Star' : `GitHub · ${count.toLocaleString('en-US')} Stars`
      }
    >
      <Github size={17} aria-hidden="true" />
      <span className="star-label">Star</span>
      <span className="star-count">
        <Star size={13} aria-hidden="true" />
        {count === null ? '—' : count.toLocaleString('en-US')}
      </span>
    </a>
  )
}
