import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Menu, X, Github, Star } from 'lucide-react'
import { Logo } from './Logo'

const navItems = [
  { label: '功能', href: '#features' },
  { label: '等级', href: '#levels' },
  { label: '安装', href: '#install' },
  { label: '更新', href: '#updates' },
  { label: '问答', href: '#faq' },
]

// 格式化数字（1000+ 显示为 1k+）
function formatStarCount(count: number): string {
  if (count >= 1000) {
    return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  }
  return count.toString()
}

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [starCount, setStarCount] = useState<number | null>(null)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // 获取 GitHub Star 数量
  useEffect(() => {
    const fetchStarCount = async () => {
      try {
        // 先尝试从缓存读取
        const cached = localStorage.getItem('github_star_count')
        const cachedTime = localStorage.getItem('github_star_count_time')
        const now = Date.now()
        
        // 缓存 10 分钟有效
        if (cached && cachedTime && now - parseInt(cachedTime) < 10 * 60 * 1000) {
          setStarCount(parseInt(cached))
          return
        }
        
        const response = await fetch('https://api.github.com/repos/caigg188/LDStatusPro')
        if (response.ok) {
          const data = await response.json()
          const count = data.stargazers_count || 0
          setStarCount(count)
          localStorage.setItem('github_star_count', count.toString())
          localStorage.setItem('github_star_count_time', now.toString())
        }
      } catch (error) {
        console.warn('Failed to fetch GitHub star count:', error)
      }
    }
    
    fetchStarCount()
  }, [])

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        isScrolled 
          ? 'py-3' 
          : 'py-5'
      }`}
      style={{
        background: isScrolled 
          ? 'rgba(122,156,173,0.75)'
          : 'rgba(122,156,173,0.95)',
        backdropFilter: isScrolled ? 'blur(20px) saturate(180%)' : 'none',
        WebkitBackdropFilter: isScrolled ? 'blur(20px) saturate(180%)' : 'none',
        boxShadow: isScrolled 
          ? '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(122,156,173,0.2)' 
          : 'none',
        borderBottom: isScrolled ? '1px solid rgba(255,255,255,0.2)' : '1px solid transparent'
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <a href="#" className="flex items-center gap-2.5 group">
            <div className="p-1.5 rounded-xl bg-white/95 group-hover:bg-white group-hover:shadow-lg group-hover:shadow-white/30 transition-all">
              <Logo size={32} animated={false} />
            </div>
            <span className="font-bold text-xl">
              <span className="text-white">LDStatus</span> <span className="text-[#c5e1a5]">Pro</span>
            </span>
          </a>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-white/80 hover:text-white transition-colors relative group font-medium"
              >
                {item.label}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-white/80 group-hover:w-full transition-all duration-300 rounded-full" />
              </a>
            ))}
          </nav>

          {/* GitHub Button */}
          <a
            href="https://github.com/caigg188/LDStatusPro"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:flex items-center gap-2 h-10 px-4 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/20 transition-all duration-300"
          >
            <Github size={18} className="text-white" />
            <span className="text-white font-medium">GitHub</span>
            {starCount !== null && (
              <span className="flex items-center gap-1 ml-0.5 px-2 py-0.5 bg-white/20 rounded-full text-xs font-semibold text-white">
                <Star size={12} className="fill-yellow-300 text-yellow-300" />
                {formatStarCount(starCount)}
              </span>
            )}
          </a>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-white p-2"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-menu"
            aria-label={isMobileMenuOpen ? '关闭菜单' : '打开菜单'}
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <motion.div
            id="mobile-menu"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden mt-4 pb-4 border-t border-white/20 pt-4"
          >
            <nav className="flex flex-col gap-4" aria-label="移动导航">
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="text-white/85 hover:text-white transition-colors py-2 font-medium"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {item.label}
                </a>
              ))}
              <a
                href="https://github.com/caigg188/LDStatusPro"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 mt-2 px-4 py-3 rounded-full bg-white/15 border border-white/20 font-medium"
              >
                <Github size={18} className="text-white" />
                <span className="text-white">GitHub</span>
                {starCount !== null && (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-white/20 rounded-full text-xs font-semibold text-white">
                    <Star size={12} className="fill-yellow-300 text-yellow-300" />
                    {formatStarCount(starCount)}
                  </span>
                )}
              </a>
            </nav>
          </motion.div>
        )}
      </div>
    </motion.header>
  )
}
