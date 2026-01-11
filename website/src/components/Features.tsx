import { motion, useInView } from 'framer-motion'
import { useRef, useEffect, useState } from 'react'
import { Cloud, Trophy, Shield, Globe, Zap, BarChart3 } from 'lucide-react'

// 进度环动画组件
function AnimatedProgressRing() {
  const [progress, setProgress] = useState(0)
  const circumference = 2 * Math.PI * 40 // r=40
  
  useEffect(() => {
    // 循环动画：0 -> 100 -> 停顿 -> 0 -> 100
    const animateProgress = async () => {
      while (true) {
        // 从0到100
        for (let i = 0; i <= 100; i += 1) {
          setProgress(i)
          await new Promise(r => setTimeout(r, 30))
        }
        // 停顿
        await new Promise(r => setTimeout(r, 800))
        // 快速重置
        setProgress(0)
        await new Promise(r => setTimeout(r, 300))
      }
    }
    animateProgress()
  }, [])

  const offset = circumference - (progress / 100) * circumference

  return (
    <div className="relative w-24 h-24">
      {/* 背景环 */}
      <svg className="w-full h-full absolute inset-0 -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
        <circle 
          cx="50" cy="50" r="40" fill="none" 
          stroke="url(#blueGradient)" 
          strokeWidth="8" 
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ 
            filter: `drop-shadow(0 0 ${4 + progress * 0.08}px rgba(59,130,246,${0.4 + progress * 0.006}))`,
            transition: 'stroke-dashoffset 0.03s linear'
          }}
        />
        <defs>
          <linearGradient id="blueGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
        </defs>
      </svg>
      
      {/* 中心数字 */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span 
          className="text-xl font-bold text-white tabular-nums"
          style={{ 
            textShadow: progress === 100 ? '0 0 10px rgba(59,130,246,0.8)' : 'none',
            transform: progress === 100 ? 'scale(1.1)' : 'scale(1)',
            transition: 'transform 0.2s, text-shadow 0.2s'
          }}
        >
          {progress}%
        </span>
      </div>
    </div>
  )
}

const features = [
  {
    title: '信任等级追踪',
    description: '实时监控升级进度，直观的环形进度条，多维度统计分析，达成目标时触发礼炮撒花动画！',
    icon: <BarChart3 className="w-7 h-7" />,
    color: 'from-blue-500 to-cyan-500',
    bgColor: 'from-blue-500/20 to-cyan-500/20',
    visual: (
      <div className="relative w-full h-32 flex items-center justify-center">
        {/* 环形进度条动画 */}
        <AnimatedProgressRing />
        
        {/* 撒花效果 */}
        {['🎉', '✨', '🎊', '⭐'].map((emoji, i) => (
          <motion.span
            key={i}
            className="absolute text-2xl pointer-events-none"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ 
              opacity: [0, 1, 0],
              scale: [0, 1.2, 0],
              x: [0, (i % 2 === 0 ? 1 : -1) * 40],
              y: [0, -30 - i * 10]
            }}
            transition={{ 
              duration: 2,
              repeat: Infinity,
              delay: i * 0.5,
              repeatDelay: 2
            }}
          >
            {emoji}
          </motion.span>
        ))}
      </div>
    )
  },
  {
    title: '云端同步',
    description: '多设备无缝同步，365天历史数据恢复，数据永不丢失',
    icon: <Cloud className="w-7 h-7" />,
    color: 'from-purple-500 to-pink-500',
    bgColor: 'from-purple-500/20 to-pink-500/20',
    visual: (
      <div className="relative w-full h-24 flex items-center justify-center">
        {/* 设备图示 */}
        <motion.div 
          className="flex items-center gap-8"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
        >
          <div className="text-3xl">💻</div>
          <motion.div
            className="h-0.5 w-16 bg-gradient-to-r from-purple-500 to-pink-500"
            animate={{ scaleX: [0, 1, 0], opacity: [0, 1, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <Cloud className="w-8 h-8 text-purple-400" />
          <motion.div
            className="h-0.5 w-16 bg-gradient-to-r from-pink-500 to-purple-500"
            animate={{ scaleX: [0, 1, 0], opacity: [0, 1, 0] }}
            transition={{ duration: 2, repeat: Infinity, delay: 1 }}
          />
          <div className="text-3xl">📱</div>
        </motion.div>
      </div>
    )
  },
  {
    title: '阅读排行榜',
    description: '日/周/月三榜争霸，与社区大佬一较高下',
    icon: <Trophy className="w-7 h-7" />,
    color: 'from-yellow-500 to-orange-500',
    bgColor: 'from-yellow-500/20 to-orange-500/20',
    visual: (
      <div className="flex items-end justify-center gap-3 h-28 mt-4">
        <motion.div
          className="flex flex-col items-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <span className="text-2xl mb-1">🥈</span>
          <div className="w-10 h-12 rounded-t-lg bg-gradient-to-t from-gray-400/30 to-gray-300/30" />
        </motion.div>
        <motion.div
          className="flex flex-col items-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <span className="text-3xl mb-1">🥇</span>
          <div className="w-12 h-20 rounded-t-lg bg-gradient-to-t from-yellow-500/40 to-yellow-400/40" />
        </motion.div>
        <motion.div
          className="flex flex-col items-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <span className="text-xl mb-1">🥉</span>
          <div className="w-10 h-8 rounded-t-lg bg-gradient-to-t from-orange-600/30 to-orange-500/30" />
        </motion.div>
      </div>
    )
  },
  {
    title: '多站点支持',
    description: 'Linux.do 与 IDCFlare 双站点完整支持',
    icon: <Globe className="w-7 h-7" />,
    color: 'from-green-500 to-emerald-500',
    bgColor: 'from-green-500/20 to-emerald-500/20',
    visual: (
      <div className="flex items-center justify-center gap-6 h-20">
        <motion.div 
          className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500/30 to-blue-600/30 flex items-center justify-center border border-blue-500/30 overflow-hidden"
          whileHover={{ scale: 1.1, rotate: 5 }}
        >
          <img src="https://linux.do/uploads/default/optimized/4X/6/a/6/6a6affc7b1ce8140279e959d32671304db06d5ab_2_180x180.png" alt="Linux.do" className="w-10 h-10 rounded-lg" />
        </motion.div>
        <motion.div 
          className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500/30 to-purple-600/30 flex items-center justify-center border border-purple-500/30 overflow-hidden"
          whileHover={{ scale: 1.1, rotate: -5 }}
        >
          <img src="https://idcflare.com/uploads/default/optimized/1X/8746f94a48ddc8140e8c7a52084742f38d3f5085_2_180x180.png" alt="IDCFlare" className="w-10 h-10 rounded-lg" />
        </motion.div>
      </div>
    )
  },
  {
    title: '隐私优先',
    description: '数据本地存储，云同步可选，你掌控一切',
    icon: <Shield className="w-7 h-7" />,
    color: 'from-emerald-500 to-teal-500',
    bgColor: 'from-emerald-500/20 to-teal-500/20',
    visual: (
      <div className="flex items-center justify-center h-20">
        <motion.div
          className="relative"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Shield className="w-16 h-16 text-emerald-400" />
          <motion.div
            className="absolute inset-0 rounded-full"
            animate={{ 
              boxShadow: [
                '0 0 0 0 rgba(16, 185, 129, 0.4)',
                '0 0 0 15px rgba(16, 185, 129, 0)',
              ]
            }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        </motion.div>
      </div>
    )
  },
  {
    title: '7级阅读系统',
    description: '从「刚起步」到「超级水怪」，记录每一刻成长',
    icon: <Zap className="w-7 h-7" />,
    color: 'from-pink-500 to-rose-500',
    bgColor: 'from-pink-500/20 to-rose-500/20',
    visual: (
      <div className="flex items-center justify-center gap-2 h-20 overflow-hidden">
        {['🌱', '📖', '📚', '🔥', '⚡', '🏆', '👑'].map((emoji, i) => (
          <motion.span
            key={i}
            className="text-2xl"
            initial={{ opacity: 0.3, scale: 0.8 }}
            animate={{ 
              opacity: [0.3, 1, 0.3],
              scale: [0.8, 1.1, 0.8]
            }}
            transition={{ 
              duration: 3,
              repeat: Infinity,
              delay: i * 0.4
            }}
          >
            {emoji}
          </motion.span>
        ))}
      </div>
    )
  },
]

export default function Features() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })

  return (
    <section id="features" className="py-24 relative" ref={ref}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 标题 */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16 select-none"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            <span className="text-white">强大功能，</span>
            <span className="gradient-text">为你而生</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            全方位的社区增强体验，让你的 Linux.do 之旅更加精彩
          </p>
        </motion.div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              whileHover={{ scale: 1.02, y: -4, transition: { duration: 0.2 } }}
              className="group relative rounded-2xl glass glass-hover overflow-hidden p-6 cursor-pointer"
              style={{ minHeight: '280px' }}
            >
              {/* 背景渐变 */}
              <div className={`absolute inset-0 bg-gradient-to-br ${feature.bgColor} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
              
              <div className="relative z-10 select-none">
                {/* 图标 */}
                <div className={`inline-flex p-3 rounded-xl bg-gradient-to-r ${feature.color} mb-4`}>
                  {feature.icon}
                </div>

                {/* 标题 */}
                <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>

                {/* 描述 */}
                <p className="text-gray-400 text-sm mb-4">{feature.description}</p>

                {/* 可视化元素 */}
                {feature.visual}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
