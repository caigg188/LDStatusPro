import { useRef, useState, type KeyboardEvent } from 'react'
import { Menu, X } from 'lucide-react'
import GitHubStars from './GitHubStars'
import { Logo } from './Logo'
import { links } from '../config/links'

const navigation = [
  { label: '两款产品', href: '#products' },
  { label: '开始使用', href: '#install' },
  { label: '开源项目', href: '#updates' },
  { label: '常见问题', href: '#faq' }
]

export default function Header() {
  const [open, setOpen] = useState(false)
  const toggle = useRef<HTMLButtonElement>(null)

  function closeWithEscape(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape' && open) {
      setOpen(false)
      toggle.current?.focus()
    }
  }

  return (
    <header className="site-header" onKeyDown={closeWithEscape}>
      <div className="site-width header-inner">
        <a className="brand-name" href="#top" aria-label="LDSP 项目首页" onClick={() => setOpen(false)}>
          <Logo size={38} decorative />
          <span>
            LDSP<span className="brand-byline">社区开源工具</span>
          </span>
        </a>
        <nav className="desktop-nav" aria-label="主导航">
          {navigation.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
        <GitHubStars />
        <button
          className="menu-toggle"
          ref={toggle}
          aria-label={open ? '关闭导航' : '打开导航'}
          aria-expanded={open}
          aria-controls="mobile-navigation"
          onClick={() => setOpen(!open)}
        >
          {open ? <X size={23} aria-hidden="true" /> : <Menu size={23} aria-hidden="true" />}
        </button>
      </div>
      <nav id="mobile-navigation" className="mobile-nav site-width" aria-label="移动端主导航" hidden={!open}>
        {navigation.map((item) => (
          <a key={item.href} href={item.href} onClick={() => setOpen(false)}>
            {item.label}
          </a>
        ))}
        <a href={links.github} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
          查看源码
        </a>
      </nav>
    </header>
  )
}
