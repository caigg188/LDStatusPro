import { Github, Heart, ExternalLink } from 'lucide-react'
import { Logo } from './Logo'

export default function Footer() {
  return (
    <footer className="py-12 border-t border-[#e5e3e0] bg-[#f8f7f5]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <Logo size={40} animated={false} />
            <div>
              <div className="font-bold text-[#3d3d3d]">
                LDStatus <span className="gradient-text">Pro</span>
              </div>
              <div className="text-xs text-[#9a9a9a]">v3.3.2</div>
            </div>
          </div>

          {/* 链接 */}
          <div className="flex items-center gap-6 flex-wrap justify-center">
            <a
              href="https://github.com/caigg188/LDStatusPro"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-[#6b6b6b] hover:text-[#3d3d3d] transition-colors"
            >
              <Github size={18} />
              <span>GitHub</span>
            </a>
            <a
              href="https://github.com/caigg188/LDStatusPro/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-[#6b6b6b] hover:text-[#3d3d3d] transition-colors"
            >
              <ExternalLink size={18} />
              <span>反馈问题</span>
            </a>
            <a
              href="https://linux.do"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-[#6b6b6b] hover:text-[#3d3d3d] transition-colors"
            >
              <img src="https://linux.do/uploads/default/optimized/4X/6/a/6/6a6affc7b1ce8140279e959d32671304db06d5ab_2_180x180.png" alt="Linux.do" className="w-5 h-5 rounded" />
              <span>Linux.do</span>
            </a>
            <a
              href="https://idcflare.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-[#6b6b6b] hover:text-[#3d3d3d] transition-colors"
            >
              <img src="https://idcflare.com/uploads/default/optimized/1X/8746f94a48ddc8140e8c7a52084742f38d3f5085_2_180x180.png" alt="IDCFlare" className="w-5 h-5 rounded" />
              <span>IDCFlare</span>
            </a>
          </div>

          {/* 版权 - 使用CSS动画替代JS*/}
          <div className="flex items-center gap-1 text-[#9a9a9a] text-sm animate-pulse" style={{ animationDuration: '3s' }}>
            <span>Made with</span>
            <Heart size={14} className="text-[#c4a6a0] fill-[#c4a6a0]" />
            <span>for the Community</span>
          </div>
        </div>

        {/* 底部版权 */}
        <div className="mt-8 pt-6 border-t border-[#e5e3e0] text-center text-[#9a9a9a] text-sm">
          <p>© {new Date().getFullYear()} LDStatus Pro. MIT License.</p>
          <p className="mt-1">
            本项目与 Linux.do 及 IDCFlare 官方无关联
          </p>
        </div>
      </div>
    </footer>
  )
}
