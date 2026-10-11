import type { ReactNode } from 'react'

export default function Reveal({
  children,
  className = '',
  delay = 0
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  return (
    <div
      className={className}
      data-reveal=""
      data-delay={delay}
    >
      {children}
    </div>
  )
}
