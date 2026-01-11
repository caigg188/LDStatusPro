import { motion, useInView, AnimatePresence } from 'framer-motion'
import { useRef, useState } from 'react'

const levels = [
  { 
    name: '刚起步', icon: '🌱', range: '0-30分钟', color: '#94a3b8', 
    bgFrom: 'rgba(148,163,184,0.2)', bgTo: 'rgba(100,116,139,0.2)',
    clickEmojis: ['🌱', '🌿', '☘️', '🍀'],
    clickMessage: '每一颗种子都值得期待！'
  },
  { 
    name: '热身中', icon: '📖', range: '30-90分钟', color: '#60a5fa', 
    bgFrom: 'rgba(96,165,250,0.2)', bgTo: 'rgba(59,130,246,0.2)',
    clickEmojis: ['📖', '📚', '📕', '📗'],
    clickMessage: '翻开书页，开启旅程！'
  },
  { 
    name: '渐入佳境', icon: '📚', range: '90-180分钟', color: '#34d399', 
    bgFrom: 'rgba(52,211,153,0.2)', bgTo: 'rgba(16,185,129,0.2)',
    clickEmojis: ['✨', '💚', '🌟', '📚'],
    clickMessage: '你已进入心流状态！'
  },
  { 
    name: '沉浸阅读', icon: '🔥', range: '180-300分钟', color: '#fbbf24', 
    bgFrom: 'rgba(251,191,36,0.2)', bgTo: 'rgba(245,158,11,0.2)',
    clickEmojis: ['🔥', '💥', '⚡', '🌟'],
    clickMessage: '燃烧吧，阅读之魂！'
  },
  { 
    name: '深度学习', icon: '⚡', range: '300-450分钟', color: '#f97316', 
    bgFrom: 'rgba(249,115,22,0.2)', bgTo: 'rgba(234,88,12,0.2)',
    clickEmojis: ['⚡', '💫', '🚀', '✨'],
    clickMessage: '你已超越 90% 的人！'
  },
  { 
    name: 'LD达人', icon: '🏆', range: '450-600分钟', color: '#a855f7', 
    bgFrom: 'rgba(168,85,247,0.2)', bgTo: 'rgba(147,51,234,0.2)',
    clickEmojis: ['🏆', '🎖️', '🥇', '👏'],
    clickMessage: '社区达人，名副其实！'
  },
  { 
    name: '超级水怪', icon: '👑', range: '600+分钟', color: '#ec4899', 
    bgFrom: 'rgba(236,72,153,0.2)', bgTo: 'rgba(219,39,119,0.2)',
    clickEmojis: ['👑', '🎉', '🎊', '💎'],
    clickMessage: '传说级水怪，无人能敌！'
  },
]

// 点击粒子效果组件
interface Particle {
  id: number
  emoji: string
  x: number
  y: number
}

interface ClickEffect {
  levelIndex: number
  particles: Particle[]
  message: string
}

export default function Levels() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })
  const [clickEffect, setClickEffect] = useState<ClickEffect | null>(null)

  // 处理卡片点击
  const handleCardClick = (index: number, e: React.MouseEvent<HTMLDivElement>) => {
    const level = levels[index]
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    // 生成随机粒子
    const particles: Particle[] = level.clickEmojis.flatMap((emoji, i) => 
      Array.from({ length: 3 }, (_, j) => ({
        id: i * 3 + j,
        emoji,
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
      }))
    )
    
    setClickEffect({ levelIndex: index, particles, message: level.clickMessage })
    
    // 1.5秒后清除效果
    setTimeout(() => setClickEffect(null), 1500)
  }

  return (
    <section id="levels" className="py-24 relative overflow-hidden" ref={ref}>
      {/* 背景装饰 */}
      <div className="absolute inset-0 bg-aurora opacity-50" />
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 标题 */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16 select-none"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            <span className="text-white">7级阅读</span>
            <span className="gradient-text">成就系统</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            从「刚起步」到「超级水怪」，每一级都是你努力的见证
          </p>
          <p className="text-gray-500 text-sm mt-2">✨ 点击卡片探索惊喜</p>
        </motion.div>

        {/* 等级卡片网格布局 - 在大屏幕上显示7列 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {levels.map((level, index) => (
            <motion.div
              key={level.name}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: index * 0.08 }}
              whileHover={{ scale: 1.08, y: -10, transition: { duration: 0.15 } }}
              whileTap={{ scale: 0.95, transition: { duration: 0.1 } }}
              className="cursor-pointer select-none"
              onClick={(e) => handleCardClick(index, e)}
            >
              <div 
                className="relative h-48 rounded-2xl glass overflow-hidden group"
                style={{ 
                  borderColor: `${level.color}30`,
                  borderWidth: '1px'
                }}
              >
                {/* 背景渐变 - 使用 style 而不是 Tailwind 动态类 */}
                <div 
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                  style={{ 
                    background: `linear-gradient(to bottom right, ${level.bgFrom}, ${level.bgTo})`
                  }}
                />
                
                {/* 发光效果 */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 rounded-2xl"
                  style={{ 
                    boxShadow: `0 0 30px ${level.color}30, inset 0 0 30px ${level.color}08`
                  }}
                />

                {/* 点击粒子效果 */}
                <AnimatePresence>
                  {clickEffect?.levelIndex === index && (
                    <>
                      {clickEffect.particles.map((particle) => (
                        <motion.span
                          key={particle.id}
                          className="absolute text-2xl pointer-events-none z-20"
                          initial={{ 
                            x: particle.x, 
                            y: particle.y, 
                            scale: 0,
                            opacity: 1 
                          }}
                          animate={{ 
                            x: particle.x + (Math.random() - 0.5) * 120,
                            y: particle.y - 60 - Math.random() * 40,
                            scale: [0, 1.2, 0.8],
                            opacity: [1, 1, 0],
                            rotate: Math.random() * 360
                          }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                        >
                          {particle.emoji}
                        </motion.span>
                      ))}
                      {/* 点击消息 */}
                      <motion.div
                        className="absolute inset-x-0 top-1/2 z-20 text-center pointer-events-none"
                        initial={{ opacity: 0, y: 10, scale: 0.8 }}
                        animate={{ opacity: 1, y: -20, scale: 1 }}
                        exit={{ opacity: 0, y: -40 }}
                        transition={{ duration: 0.3 }}
                      >
                        <span 
                          className="px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap"
                          style={{ 
                            backgroundColor: level.color,
                            color: '#fff',
                            textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                          }}
                        >
                          {clickEffect.message}
                        </span>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
                
                <div className="relative z-10 h-full flex flex-col items-center justify-center p-3">
                  {/* 等级图标 */}
                  <motion.div
                    className="text-4xl mb-2"
                    whileHover={{ 
                      rotateY: 360,
                      transition: { duration: 0.4 }
                    }}
                  >
                    {level.icon}
                  </motion.div>
                  
                  {/* 等级名称 */}
                  <h3 
                    className="text-base font-bold mb-1 text-center"
                    style={{ color: level.color }}
                  >
                    {level.name}
                  </h3>
                  
                  {/* 时间范围 */}
                  <p className="text-xs text-gray-400 text-center">{level.range}</p>
                  
                  {/* 等级编号 */}
                  <div 
                    className="mt-2 px-2.5 py-0.5 rounded-full text-xs font-medium"
                    style={{ 
                      backgroundColor: `${level.color}20`,
                      color: level.color
                    }}
                  >
                    Lv.{index + 1}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* 说明文字 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="text-center mt-10"
        >
          <p className="text-gray-500 text-sm">
            💡 等级每日重置，基于当天阅读时间计算 · 管理员可自定义等级配置
          </p>
        </motion.div>
      </div>
    </section>
  )
}
