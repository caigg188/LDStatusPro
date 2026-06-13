import { motion } from 'framer-motion'
import { Download, Github, Sparkles, ChevronDown } from 'lucide-react'
import PanelPreview from './PanelPreview'

// 固定配置
const PLUGIN_VERSION = 'v3.5.4'

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20 bg-[#f8f7f5]">
      {/* 背景效果 - 莫兰迪柔和光斑 */}
      <div className="absolute inset-0 bg-aurora" />
      
      {/* 动态光斑 - CSS动画替代JS动画，更流畅 */}
      <div
        className="hidden sm:block absolute w-[360px] sm:w-[520px] md:w-[600px] h-[360px] sm:h-[520px] md:h-[600px] rounded-full blur-3xl will-change-transform animate-float gpu-accelerate"
        style={{ 
          left: '6%', 
          top: '14%',
          background: 'radial-gradient(circle, rgba(139,164,184,0.2) 0%, rgba(157,149,171,0.15) 50%, transparent 70%)',
          animationDuration: '15s',
        }}
      />
      <div
        className="hidden sm:block absolute w-[260px] sm:w-[360px] md:w-[400px] h-[260px] sm:h-[360px] md:h-[400px] rounded-full blur-3xl will-change-transform animate-float gpu-accelerate"
        style={{ 
          right: '8%', 
          bottom: '30%',
          background: 'radial-gradient(circle, rgba(157,149,171,0.18) 0%, rgba(196,166,160,0.12) 50%, transparent 70%)',
          animationDuration: '12s',
          animationDelay: '-3s',
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* 左侧文案 */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
            className="text-center lg:text-left select-none"
          >
            {/* 徽章 - 液态玻璃效果 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-6"
            >
              <Sparkles size={16} className="text-[#c9a87c]" />
              <span className="text-sm text-[#6b6b6b]">{PLUGIN_VERSION} 全新发布</span>
            </motion.div>

            {/* 主标题 */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              <span className="text-[#3d3d3d]">掌握社区脉搏</span>
              <br />
              <span className="gradient-text-animated">记录成长轨迹</span>
            </h1>

            {/* 副标题 */}
            <p className="text-lg sm:text-xl text-[#6b6b6b] mb-8 max-w-xl mx-auto lg:mx-0">
              为 <span className="text-[#7a9cad] font-medium">Linux.do</span> 与 <span className="text-[#9d95ab] font-medium">IDCFlare</span> 打造的极致信任等级追踪与阅读增强工具。
            </p>
            
            {/* 特性标签 */}
            <div className="flex flex-wrap gap-4 justify-center lg:justify-start mb-8">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                whileHover={{ scale: 1.05, y: -2 }}
                className="group relative px-5 py-2.5 rounded-2xl bg-gradient-to-br from-[#7a9cad]/20 to-[#7a9cad]/5 backdrop-blur-sm border border-[#7a9cad]/30 cursor-default overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-[#7a9cad]/0 via-[#7a9cad]/10 to-[#7a9cad]/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                <span className="relative flex items-center gap-2 text-[#5a8599] font-semibold">
                  <span className="text-lg">✨</span> 好用
                </span>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                whileHover={{ scale: 1.05, y: -2 }}
                className="group relative px-5 py-2.5 rounded-2xl bg-gradient-to-br from-[#8faa9d]/20 to-[#8faa9d]/5 backdrop-blur-sm border border-[#8faa9d]/30 cursor-default overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-[#8faa9d]/0 via-[#8faa9d]/10 to-[#8faa9d]/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                <span className="relative flex items-center gap-2 text-[#5a8a6d] font-semibold">
                  <span className="text-lg">📖</span> 开源
                </span>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                whileHover={{ scale: 1.05, y: -2 }}
                className="group relative px-5 py-2.5 rounded-2xl bg-gradient-to-br from-[#c4a6a0]/20 to-[#c4a6a0]/5 backdrop-blur-sm border border-[#c4a6a0]/30 cursor-default overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-[#c4a6a0]/0 via-[#c4a6a0]/10 to-[#c4a6a0]/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                <span className="relative flex items-center gap-2 text-[#a08078] font-semibold">
                  <span className="text-lg">💝</span> 公益
                </span>
              </motion.div>
            </div>

            {/* CTA 按钮 */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <motion.a
                href="https://raw.githubusercontent.com/caigg188/LDStatusPro/main/LDStatusPro.user.js"
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="group relative px-8 py-4 rounded-2xl bg-[#7a9cad] hover:bg-[#6b8d9e] text-white font-semibold text-lg flex items-center justify-center gap-3 shadow-lg shadow-[#7a9cad]/25 overflow-hidden transition-colors"
              >
                {/* 流光效果 */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                <Download size={22} />
                <span>立即安装 {PLUGIN_VERSION}</span>
              </motion.a>

              <motion.a
                href="https://github.com/caigg188/LDStatusPro"
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="px-8 py-4 rounded-2xl border border-[#d4d2cf] text-[#6b6b6b] font-semibold text-lg flex items-center justify-center gap-3 hover:border-[#9d95ab] hover:bg-white/50 transition-all glass"
              >
                <Github size={22} />
                <span>查看源码</span>
              </motion.a>
            </div>

            {/* 统计数据 */}
            <div className="flex items-center justify-center lg:justify-start gap-8 mt-10 pt-8 border-t border-[#e5e3e0]">
              <div className="text-center">
                <div className="text-2xl font-bold text-[#3d3d3d]">2</div>
                <div className="text-sm text-[#9a9a9a]">支持站点</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-[#3d3d3d]">7</div>
                <div className="text-sm text-[#9a9a9a]">阅读等级</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-[#3d3d3d]">365</div>
                <div className="text-sm text-[#9a9a9a]">天数据同步</div>
              </div>
            </div>
          </motion.div>

          {/* 右侧面板预览 */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="relative flex justify-center"
          >
            <PanelPreview />
            
            {/* 装饰性徽章 - 使用 CSS 动画优化性能 */}
            <div 
              className="absolute -top-4 -left-4 lg:left-0 text-4xl" 
              style={{ 
                animation: 'float 5s cubic-bezier(0.37, 0, 0.63, 1) infinite',
                transform: 'translateZ(0)',
                willChange: 'transform'
              }}
            >
              🌱
            </div>
            <div 
              className="absolute top-1/4 -right-4 lg:-right-8 text-4xl" 
              style={{ 
                animation: 'float 5.5s cubic-bezier(0.37, 0, 0.63, 1) infinite',
                animationDelay: '-1.2s',
                transform: 'translateZ(0)',
                willChange: 'transform'
              }}
            >
              🔥
            </div>
            <div 
              className="absolute bottom-1/4 -left-8 lg:-left-12 text-4xl" 
              style={{ 
                animation: 'float 5.2s cubic-bezier(0.37, 0, 0.63, 1) infinite',
                animationDelay: '-2.5s',
                transform: 'translateZ(0)',
                willChange: 'transform'
              }}
            >
              🏆
            </div>
            <div 
              className="absolute -bottom-4 right-8 text-4xl" 
              style={{ 
                animation: 'float 5.8s cubic-bezier(0.37, 0, 0.63, 1) infinite',
                animationDelay: '-3.8s',
                transform: 'translateZ(0)',
                willChange: 'transform'
              }}
            >
              👑
            </div>
          </motion.div>
        </div>
      </div>

      {/* 滚动提示 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <div className="flex flex-col items-center gap-2 text-[#9a9a9a] animate-float gpu-accelerate" style={{ animationDuration: '2s' }}>
          <span className="text-sm">向下滚动探索更多</span>
          <ChevronDown size={20} />
        </div>
      </motion.div>
    </section>
  )
}
