import { motion, useInView } from 'framer-motion'
import { useRef, useEffect, useState } from 'react'
import { Cloud, Trophy, Globe, Zap, BarChart3, Store, Sparkles, BookOpen, Coins } from 'lucide-react'

// 礼炮粒子类型
interface ConfettiParticle {
  id: number
  emoji: string
  x: number
  y: number
  angle: number
  velocity: number
  rotation: number
  rotationSpeed: number
}

// 进度环动画组件（带礼炮效果）
function AnimatedProgressRing() {
  const [progress, setProgress] = useState(0)
  const [confetti, setConfetti] = useState<ConfettiParticle[]>([])
  const [showCelebration, setShowCelebration] = useState(false)
  const circumference = 2 * Math.PI * 40 // r=40
  
  // 生成礼炮粒子
  const triggerConfetti = () => {
    const emojis = ['🎉', '✨', '🎊', '⭐', '🌟', '💫', '🎆', '🎇', '💖', '🏆']
    const particles: ConfettiParticle[] = []
    
    for (let i = 0; i < 20; i++) {
      particles.push({
        id: i,
        emoji: emojis[Math.floor(Math.random() * emojis.length)],
        x: 50, // 从中心发射
        y: 50,
        angle: (Math.random() * 360) * (Math.PI / 180), // 随机方向
        velocity: 3 + Math.random() * 4, // 随机速度
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 20,
      })
    }
    
    setConfetti(particles)
    setShowCelebration(true)
    
    // 1.5秒后清除粒子
    setTimeout(() => {
      setConfetti([])
      setShowCelebration(false)
    }, 1500)
  }
  
  useEffect(() => {
    let mounted = true
    
    // 循环动画：0 -> 100 -> 停顿 -> 0 -> 100
    const animateProgress = async () => {
      while (mounted) {
        // 从0到100
        for (let i = 0; i <= 100 && mounted; i += 1) {
          setProgress(i)
          // 达到100%时触发礼炮
          if (i === 100) {
            triggerConfetti()
          }
          await new Promise(r => setTimeout(r, 30))
        }
        // 停顿（显示庆祝效果）
        await new Promise(r => setTimeout(r, 1200))
        // 快速重置
        if (mounted) setProgress(0)
        await new Promise(r => setTimeout(r, 500))
      }
    }
    animateProgress()
    
    return () => { mounted = false }
  }, [])

  const offset = circumference - (progress / 100) * circumference

  return (
    <div className="relative w-24 h-24">
      {/* 礼炮粒子 */}
      {confetti.map((particle, index) => (
        <motion.span
          key={particle.id}
          className="absolute text-lg pointer-events-none z-20"
          initial={{ 
            x: 0, 
            y: 0, 
            scale: 0,
            opacity: 1,
            rotate: particle.rotation
          }}
          animate={{ 
            x: Math.cos(particle.angle) * particle.velocity * 25,
            y: Math.sin(particle.angle) * particle.velocity * 25 - 20, // 向上偏移
            scale: [0, 1.2, 0.8, 0],
            opacity: [1, 1, 0.8, 0],
            rotate: particle.rotation + particle.rotationSpeed * 10
          }}
          transition={{ 
            duration: 1.2,
            ease: "easeOut",
            delay: index * 0.02
          }}
          style={{
            left: '50%',
            top: '50%',
            marginLeft: '-10px',
            marginTop: '-10px',
          }}
        >
          {particle.emoji}
        </motion.span>
      ))}
      
      {/* 100%时的光环效果 */}
      {showCelebration && (
        <motion.div
          className="absolute inset-0 rounded-full"
          initial={{ scale: 1, opacity: 0.6 }}
          animate={{ scale: 1.8, opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          style={{
            background: 'radial-gradient(circle, rgba(139,164,184,0.4) 0%, transparent 70%)',
          }}
        />
      )}
      
      {/* 背景环 */}
      <svg className="w-full h-full absolute inset-0 -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="8" />
        <circle 
          cx="50" cy="50" r="40" fill="none" 
          stroke="url(#blueGradient)" 
          strokeWidth="8" 
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ 
            filter: `drop-shadow(0 0 ${3 + progress * 0.05}px rgba(139,164,184,${0.3 + progress * 0.004}))`,
            transition: 'stroke-dashoffset 0.03s linear'
          }}
        />
        <defs>
          <linearGradient id="blueGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8ba4b8" />
            <stop offset="100%" stopColor="#7a9cad" />
          </linearGradient>
        </defs>
      </svg>
      
      {/* 中心数字 */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.span 
          className="text-xl font-bold tabular-nums"
          animate={{
            scale: progress === 100 ? 1.15 : 1,
            color: progress === 100 ? '#7a9cad' : '#3d3d3d',
          }}
          transition={{ duration: 0.2 }}
          style={{ 
            textShadow: progress === 100 ? '0 0 12px rgba(139,164,184,0.8)' : 'none',
          }}
        >
          {progress}%
        </motion.span>
      </div>
    </div>
  )
}

const features = [
  {
    title: '信任等级追踪',
    description: '实时进度显示、多维度统计、365天趋势分析、里程碑通知，达标时触发礼炮动画！',
    icon: <BarChart3 className="w-7 h-7" />,
    color: 'from-[#8ba4b8] to-[#7a9cad]',
    bgColor: 'from-[#8ba4b8]/15 to-[#7a9cad]/15',
    visual: (
      <div className="relative w-full h-32 flex items-center justify-center overflow-visible">
        <AnimatedProgressRing />
      </div>
    )
  },
  {
    title: 'LD 士多',
    description: '虚拟物品兑换信息中心，LDC积分兑换，CDK自动发放，商家可入驻发布兑换信息',
    icon: <Store className="w-7 h-7" />,
    color: 'from-[#c9a87c] to-[#b89a6a]',
    bgColor: 'from-[#c9a87c]/15 to-[#b89a6a]/15',
    visual: (
      <div className="flex items-center justify-center gap-3 h-24">
        <div className="flex flex-col items-center gap-2">
          <div className="flex gap-2">
            {['🤖', '💾', '🐣', '📡'].map((emoji, i) => (
              <span key={i} className="text-2xl animate-bounce" style={{ animationDelay: `${i * 0.15}s`, animationDuration: '1.5s' }}>{emoji}</span>
            ))}
          </div>
          <div className="flex items-center gap-2 text-sm text-[#9a9a9a]">
            <span>💳 LDC</span>
            <span>→</span>
            <span>🎁 CDK</span>
          </div>
        </div>
      </div>
    )
  },
  {
    title: '吃瓜助手',
    description: 'AI帖子总结、追问对话、流式输出、历史记录，自定义提示词打造专属助手',
    icon: <Sparkles className="w-7 h-7" />,
    color: 'from-[#9d95ab] to-[#8a82a0]',
    bgColor: 'from-[#9d95ab]/15 to-[#8a82a0]/15',
    visual: (
      <div className="flex items-center justify-center h-24">
        <div className="relative">
          <span className="text-5xl">🍉</span>
          <motion.div 
            className="absolute -top-1 -right-1 text-xl"
            animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            ✨
          </motion.div>
        </div>
      </div>
    )
  },
  {
    title: '我的活动',
    description: '已读历史、收藏管理、回复记录、点赞历史、互动查看，支持搜索功能',
    icon: <BookOpen className="w-7 h-7" />,
    color: 'from-[#8faa9d] to-[#7a9c8a]',
    bgColor: 'from-[#8faa9d]/15 to-[#7a9c8a]/15',
    visual: (
      <div className="flex items-center justify-center gap-4 h-24">
        {['📖', '⭐', '💬', '❤️', '📝'].map((emoji, i) => (
          <motion.span 
            key={i} 
            className="text-2xl"
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 1.5, delay: i * 0.2, repeat: Infinity }}
          >
            {emoji}
          </motion.span>
        ))}
      </div>
    )
  },
  {
    title: 'LDC 积分',
    description: '余额查看、当日预估、7日统计、交易记录筛选，支持赞赏打赏功能',
    icon: <Coins className="w-7 h-7" />,
    color: 'from-[#c4a6a0] to-[#b89090]',
    bgColor: 'from-[#c4a6a0]/15 to-[#b89090]/15',
    visual: (
      <div className="flex items-center justify-center h-24">
        <div className="flex items-center gap-3">
          <motion.span 
            className="text-4xl"
            animate={{ rotateY: [0, 360] }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          >
            🪙
          </motion.span>
          <div className="flex flex-col text-sm">
            <span className="text-[#8faa9d] font-medium">+128 LDC</span>
            <span className="text-[#9a9a9a] text-xs">今日收益</span>
          </div>
        </div>
      </div>
    )
  },
  {
    title: '阅读排行榜',
    description: '日/周/月三榜切换，Top 50展示，金银铜牌特殊展示，隐私优先自主选择',
    icon: <Trophy className="w-7 h-7" />,
    color: 'from-[#c9a87c] to-[#b89a6a]',
    bgColor: 'from-[#c9a87c]/15 to-[#b89a6a]/15',
    visual: (
      <div className="flex items-end justify-center gap-3 h-28 mt-4">
        <div className="flex flex-col items-center">
          <span className="text-2xl mb-1">🥈</span>
          <div className="w-10 h-12 rounded-t-lg bg-gradient-to-t from-[#9a9a9a]/25 to-[#b5b5b5]/20" />
        </div>
        <div className="flex flex-col items-center">
          <span className="text-3xl mb-1">🥇</span>
          <div className="w-12 h-20 rounded-t-lg bg-gradient-to-t from-[#c9a87c]/35 to-[#d4b88a]/25" />
        </div>
        <div className="flex flex-col items-center">
          <span className="text-xl mb-1">🥉</span>
          <div className="w-10 h-8 rounded-t-lg bg-gradient-to-t from-[#c4a6a0]/30 to-[#d4b8b2]/20" />
        </div>
      </div>
    )
  },
  {
    title: '云端同步',
    description: '跨浏览器跨设备同步，智能数据合并，365天历史恢复，升级要求同步',
    icon: <Cloud className="w-7 h-7" />,
    color: 'from-[#9d95ab] to-[#c4a6a0]',
    bgColor: 'from-[#9d95ab]/15 to-[#c4a6a0]/15',
    visual: (
      <div className="relative w-full h-24 flex items-center justify-center">
        <div className="flex items-center gap-6">
          <div className="text-2xl">💻</div>
          <div className="h-0.5 w-10 bg-gradient-to-r from-[#9d95ab] to-[#c4a6a0] animate-pulse" />
          <Cloud className="w-8 h-8 text-[#9d95ab]" />
          <div className="h-0.5 w-10 bg-gradient-to-r from-[#c4a6a0] to-[#9d95ab] animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="text-2xl">📱</div>
        </div>
      </div>
    )
  },
  {
    title: '多站点支持',
    description: 'Linux.do 与 IDCFlare 双站点完整支持，独立认证数据隔离',
    icon: <Globe className="w-7 h-7" />,
    color: 'from-[#8faa9d] to-[#7a9c8a]',
    bgColor: 'from-[#8faa9d]/15 to-[#7a9c8a]/15',
    visual: (
      <div className="flex items-center justify-center gap-6 h-20">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#8ba4b8]/25 to-[#7a9cad]/20 flex items-center justify-center border border-[#8ba4b8]/25 overflow-hidden hover:scale-105 transition-transform">
          <img src="https://linux.do/uploads/default/optimized/4X/6/a/6/6a6affc7b1ce8140279e959d32671304db06d5ab_2_180x180.png" alt="Linux.do" className="w-10 h-10 rounded-lg" />
        </div>
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#9d95ab]/25 to-[#8a82a0]/20 flex items-center justify-center border border-[#9d95ab]/25 overflow-hidden hover:scale-105 transition-transform">
          <img src="https://idcflare.com/uploads/default/optimized/1X/8746f94a48ddc8140e8c7a52084742f38d3f5085_2_180x180.png" alt="IDCFlare" className="w-10 h-10 rounded-lg" />
        </div>
      </div>
    )
  },
  {
    title: '7级阅读系统',
    description: '从「刚起步」到「超级水怪」，智能活跃检测，管理员可配置等级区间',
    icon: <Zap className="w-7 h-7" />,
    color: 'from-[#c4a6a0] to-[#b89090]',
    bgColor: 'from-[#c4a6a0]/15 to-[#b89090]/15',
    visual: (
      <div className="flex items-center justify-center gap-2 h-20 overflow-hidden">
        {['🌱', '📖', '📚', '🔥', '⚡', '🏆', '👑'].map((emoji, i) => (
          <span
            key={i}
            className="text-2xl animate-pulse gpu-accelerate"
            style={{ 
              animationDuration: `${2 + i * 0.2}s`,
              animationDelay: `${i * 0.3}s`
            }}
          >
            {emoji}
          </span>
        ))}
      </div>
    )
  },
]

export default function Features() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })

  return (
    <section id="features" className="py-24 relative bg-[#f8f7f5]" ref={ref}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 标题 */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16 select-none"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            <span className="text-[#3d3d3d]">强大功能，</span>
            <span className="gradient-text">为你而生</span>
          </h2>
          <p className="text-[#6b6b6b] text-lg max-w-2xl mx-auto">
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
              transition={{ duration: 0.5, delay: index * 0.08 }}
              className="group relative rounded-2xl glass glass-hover overflow-hidden p-6 cursor-pointer"
              style={{ minHeight: '280px' }}
            >
              {/* 背景渐变 */}
              <div className={`absolute inset-0 bg-gradient-to-br ${feature.bgColor} opacity-0 group-hover:opacity-100 transition-opacity duration-400`} />
              
              <div className="relative z-10 select-none">
                {/* 图标 */}
                <div className={`inline-flex p-3 rounded-xl bg-gradient-to-r ${feature.color} mb-4 text-white`}>
                  {feature.icon}
                </div>

                {/* 标题 */}
                <h3 className="text-xl font-semibold text-[#3d3d3d] mb-2">{feature.title}</h3>

                {/* 描述 */}
                <p className="text-[#6b6b6b] text-sm mb-4">{feature.description}</p>

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
