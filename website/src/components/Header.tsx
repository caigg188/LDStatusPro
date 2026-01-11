import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Menu, X, Github } from 'lucide-react'
import { Logo } from './Logo'

const navItems = [
  { label: '功能', href: '#features' },
  { label: '等级', href: '#levels' },
  { label: '安装', href: '#install' },
  { label: '更新', href: '#updates' },
  { label: '问答', href: '#faq' },
]

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled 
          ? 'py-3 bg-[rgba(12,12,20,0.95)] backdrop-blur-xl' 
          : 'bg-transparent py-5'
      }`}
      style={{
        boxShadow: isScrolled ? '0 1px 0 0 rgba(255,255,255,0.05), 0 4px 20px rgba(0,0,0,0.3)' : 'none'
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <a href="#" className="flex items-center gap-2.5 group">
            <Logo size={40} animated={false} className="group-hover:drop-shadow-[0_0_8px_rgba(139,92,246,0.5)] transition-all" />
            <span className="font-bold text-xl text-white">
              LDStatus <span className="gradient-text">Pro</span>
            </span>
          </a>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-gray-300 hover:text-white transition-colors relative group"
              >
                {item.label}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500 group-hover:w-full transition-all duration-300" />
              </a>
            ))}
          </nav>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-4">
            <a
              href="https://github.com/caigg188/LDStatusPro"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
            >
              <Github size={20} />
              <span>GitHub</span>
            </a>
            <a
              href="https://raw.githubusercontent.com/caigg188/LDStatusPro/main/LDStatusPro.user.js"
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2.5 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 text-white font-medium hover:shadow-lg hover:shadow-purple-500/30 hover:-translate-y-0.5 transition-all"
            >
              立即安装
            </a>
          </div>

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
            className="md:hidden mt-4 pb-4"
          >
            <nav className="flex flex-col gap-4" aria-label="移动导航">
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="text-gray-300 hover:text-white transition-colors py-2"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {item.label}
                </a>
              ))}
              <a
                href="https://raw.githubusercontent.com/caigg188/LDStatusPro/main/LDStatusPro.user.js"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 px-5 py-3 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 text-white font-medium text-center"
              >
                立即安装
              </a>
            </nav>
          </motion.div>
        )}
      </div>
    </motion.header>
  )
}
