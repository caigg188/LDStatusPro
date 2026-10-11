type Brand = 'ldsp' | 'plugin' | 'store' | 'jacky'

interface LogoProps {
  variant?: Brand
  size?: number
  className?: string
  inverted?: boolean
  decorative?: boolean
}

const names: Record<Brand, string> = {
  ldsp: 'LDSP',
  plugin: 'LDStatusPro',
  store: 'LD 士多',
  jacky: 'Jacky'
}

export function Logo({ variant = 'ldsp', size = 48, className = '', inverted = false, decorative = false }: LogoProps) {
  return (
    <img
      src={`/brand/${variant}-mark${inverted ? '-white' : ''}.svg`}
      width={size}
      height={size}
      alt={decorative ? '' : `${names[variant]} Logo`}
      aria-hidden={decorative || undefined}
      className={`brand-logo ${className}`}
      draggable={false}
    />
  )
}

export default Logo
