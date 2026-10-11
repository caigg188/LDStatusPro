import type { CSSProperties, ReactNode } from 'react'

export default function SegmentedControl<T extends string>({
  label, className = '', options, value, onChange
}: {
  label: string
  className?: string
  options: { value: T; label: string; icon?: ReactNode }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div
      className={`segmented-control ${className}`}
      role="group"
      aria-label={label}
      style={{ '--choice-index': options.findIndex((option) => option.value === value) } as CSSProperties}
    >
      <span className="choice-indicator" aria-hidden="true" />
      {options.map((option) => (
        <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)}>
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  )
}
