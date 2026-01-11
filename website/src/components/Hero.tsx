import { motion } from 'framer-motion'
import { Download, Github, Sparkles, ChevronDown } from 'lucide-react'
import PanelPreview from './PanelPreview'
import { useSiteSettings } from '../hooks/useSiteData'

export default function Hero() {
  const { data: settings } = useSiteSettings()
  
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      {/* 背景效果 */}
      <div className="absolute inset-0 bg-aurora" />
      
      {/* 动态光斑 - 使用 GPU 加速优化 */}
      <motion.div
        className="hidden sm:block absolute w-[360px] sm:w-[520px] md:w-[600px] h-[360px] sm:h-[520px] md:h-[600px] rounded-full bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 blur-3xl will-change-transform"
        animate={{
          x: [0, 80, -40, 0],
          y: [0, -40, 80, 0],
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: "linear",
        }}
        style={{ 
          left: '6%', 
          top: '14%',
          transform: 'translateZ(0)', // 强制 GPU 加速
        }}
      />
      <motion.div
        className="hidden sm:block absolute w-[260px] sm:w-[360px] md:w-[400px] h-[260px] sm:h-[360px] md:h-[400px] rounded-full bg-gradient-to-r from-purple-500/15 via-pink-500/15 to-orange-500/15 blur-3xl will-change-transform"
        animate={{
          x: [0, -60, 50, 0],
          y: [0, 60, -30, 0],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "linear",
        }}
        style={{ 
          right: '8%', 
          bottom: '30%',
          transform: 'translateZ(0)', // 强制 GPU 加速
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
            {/* 徽章 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-6"
            >
              <Sparkles size={16} className="text-yellow-400" />
              <span className="text-sm text-gray-300">{settings.hero_badge_text}</span>
            </motion.div>

            {/* 主标题 */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              <span className="text-white">掌握社区脉搏</span>
              <br />
              <span className="gradient-text-animated">记录成长轨迹</span>
            </h1>

            {/* 副标题 */}
            <p className="text-lg sm:text-xl text-gray-400 mb-8 max-w-xl mx-auto lg:mx-0">
              为 <span className="text-blue-400 font-medium">Linux.do</span> 与 <span className="text-purple-400 font-medium">IDCFlare</span> 打造的极致信任等级追踪与阅读增强工具
            </p>

            {/* CTA 按钮 */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <motion.a
                href="https://raw.githubusercontent.com/caigg188/LDStatusPro/main/LDStatusPro.user.js"
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="group relative px-8 py-4 rounded-xl bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 text-white font-semibold text-lg flex items-center justify-center gap-3 shadow-lg shadow-purple-500/25 overflow-hidden"
              >
                {/* 流光效果 */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                <Download size={22} />
                <span>{settings.install_button_text}</span>
              </motion.a>

              <motion.a
                href="https://github.com/caigg188/LDStatusPro"
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="px-8 py-4 rounded-xl border border-gray-600 text-gray-300 font-semibold text-lg flex items-center justify-center gap-3 hover:border-gray-500 hover:bg-white/5 transition-all"
              >
                <Github size={22} />
                <span>查看源码</span>
              </motion.a>
            </div>

            {/* 统计数据 */}
            <div className="flex items-center justify-center lg:justify-start gap-8 mt-10 pt-8 border-t border-gray-800">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">2</div>
                <div className="text-sm text-gray-500">支持站点</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">7</div>
                <div className="text-sm text-gray-500">阅读等级</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">365</div>
                <div className="text-sm text-gray-500">天数据同步</div>
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
            
            {/* 装饰性徽章 - CSS 动画更流畅 */}
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -top-4 -left-4 lg:left-0 text-4xl will-change-transform"
            >
              🌱
            </motion.div>
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
              className="absolute top-1/4 -right-4 lg:-right-8 text-4xl will-change-transform"
            >
              🔥
            </motion.div>
            <motion.div
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
              className="absolute bottom-1/4 -left-8 lg:-left-12 text-4xl will-change-transform"
            >
              🏆
            </motion.div>
            <motion.div
              animate={{ y: [0, -7, 0] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut", delay: 0.9 }}
              className="absolute -bottom-4 right-8 text-4xl will-change-transform"
            >
              👑
            </motion.div>
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
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
          className="flex flex-col items-center gap-2 text-gray-500 will-change-transform"
        >
          <span className="text-sm">向下滚动探索更多</span>
          <ChevronDown size={20} />
        </motion.div>
      </motion.div>
    </section>
  )
}
