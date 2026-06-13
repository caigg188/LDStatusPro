import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Cloud, Moon, Settings, ChevronUp, Minimize2 } from 'lucide-react'

// 复刻 LDStatus Pro 面板的CSS实现
export default function PanelPreview() {
  const [progress, setProgress] = useState(0)
  const [minutes, setMinutes] = useState(0)
  const targetProgress = 85
  const targetMinutes = 256

  // 动画效果：数字递增
  useEffect(() => {
    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= targetProgress) return targetProgress
        return prev + 1
      })
      setMinutes(prev => {
        if (prev >= targetMinutes) return targetMinutes
        return prev + 3
      })
    }, 30)
    return () => clearInterval(timer)
  }, [])

  return (
    <motion.div
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      className="relative"
      style={{
        // 面板根CSS变量 - 浅色莫兰迪主题
        ['--bg' as string]: '#ffffff',
        ['--bg-card' as string]: 'rgba(248,247,245,.95)',
        ['--bg-hover' as string]: 'rgba(239,237,234,.95)',
        ['--bg-el' as string]: 'rgba(245,243,240,.9)',
        ['--txt' as string]: '#3d3d3d',
        ['--txt-sec' as string]: '#6b6b6b',
        ['--txt-mut' as string]: '#9a9a9a',
        ['--accent' as string]: '#7a9cad',
        ['--accent-light' as string]: '#9bb8c7',
        ['--accent2' as string]: '#8faa9d',
        ['--ok' as string]: '#7a9c8e',
        ['--ok-light' as string]: '#8faa9d',
        ['--err' as string]: '#c9877f',
        ['--border' as string]: 'rgba(0,0,0,.06)',
        ['--r' as string]: '16px',
        ['--r-sm' as string]: '10px',
        ['--pd' as string]: '14px',
      }}
    >
      {/* 发光背景 - 莫兰迪柔和光斑 */}
      <div className="absolute -inset-6 rounded-3xl opacity-50" style={{
        background: 'radial-gradient(ellipse at 30% 20%, rgba(122,156,173,0.25), transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(143,170,157,0.2), transparent 50%)',
        filter: 'blur(30px)',
      }} />
      
      {/* 面板主体（响应式） */}
      <div 
        className="relative overflow-hidden mx-auto w-full"
        style={{
          width: '100%',
          maxWidth: '380px',
          borderRadius: '16px',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,.1), 0 0 40px rgba(122,156,173,.12)',
        }}
      >
        {/* Header - 复刻 .ldsp-hdr */}
        <div 
          className="flex items-center justify-between"
          style={{
            padding: '10px 14px',
            background: 'linear-gradient(180deg, rgba(122,156,173,.06), transparent)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div className="flex items-center gap-2">
            {/* 站点图标 - 莫兰迪色系 */}
            <svg width="28" height="28" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="panel-logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#7a9cad" />
                  <stop offset="100%" stopColor="#9d95ab" />
                </linearGradient>
              </defs>
              <path d="M 32,4 A 28,28 0 1,1 12,52" fill="none" stroke="url(#panel-logo-grad)" strokeWidth="8" strokeLinecap="round" />
              <rect x="26" y="26" width="12" height="12" rx="3" fill="url(#panel-logo-grad)" transform="rotate(45 32 32)" />
            </svg>
            <div>
              <div className="font-semibold" style={{ fontSize: '14px', color: 'var(--txt)' }}>Linux.do</div>
              <div style={{ 
                fontSize: '10px', 
                color: 'var(--txt-mut)',
                background: 'var(--bg-el)',
                padding: '1px 6px',
                borderRadius: '4px',
                display: 'inline-block',
              }}>v3.3.2</div>
            </div>
          </div>
          
          {/* 操作按钮 */}
          <div className="flex items-center gap-1">
            {[Cloud, Moon, Settings, Minimize2].map((Icon, i) => (
              <button 
                key={i}
                className="flex items-center justify-center transition-colors"
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  background: 'var(--bg-el)',
                  color: 'var(--txt-sec)',
                }}
              >
                <Icon size={14} />
              </button>
            ))}
          </div>
        </div>

        {/* 用户区域 - 复刻 .ldsp-user */}
        <div 
          className="flex items-center gap-3 relative"
          style={{
            padding: '10px 14px',
            background: 'var(--bg-card)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          {/* 顶部发光线 */}
          <div className="absolute top-0 left-0 right-0 h-px" style={{
            background: 'linear-gradient(90deg, transparent, var(--accent), transparent)',
            opacity: 0.3,
          }} />
          
          {/* 头像 */}
          <div 
            className="flex items-center justify-center font-bold text-white"
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #7a9cad, #9d95ab)',
              fontSize: '20px',
              boxShadow: '0 0 20px rgba(122,156,173,.25)',
            }}
          >
            U
          </div>
          
          {/* 用户信息 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold" style={{ 
                fontSize: '16px',
                color: 'var(--txt)',
              }}>演示用户</span>
              <span style={{
                fontSize: '10px',
                padding: '2px 6px',
                borderRadius: '4px',
                background: 'rgba(122,156,173,.12)',
                color: '#7a9cad',
                border: '1px solid rgba(122,156,173,.25)',
              }}>Lv3</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--txt-mut)' }}>@demo_user</div>
          </div>
          
          {/* 阅读时间卡片 */}
          <motion.div 
            style={{
              padding: '6px 12px',
              borderRadius: '10px',
              background: 'rgba(122,156,140,.08)',
              border: '1px solid rgba(122,156,140,.2)',
              position: 'relative',
              overflow: 'hidden',
            }}
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {/* 顶部发光边 */}
            <div className="absolute top-0 left-2 right-2 h-px" style={{
              background: 'linear-gradient(90deg, transparent, var(--ok), transparent)',
            }} />
            <div style={{ fontSize: '10px', color: 'var(--txt-sec)' }}>今日阅读</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--ok)' }}>{minutes}分钟</div>
          </motion.div>
        </div>

        {/* 环形进度区域 - 复刻 .ldsp-ring */}
        <div style={{ padding: '16px 14px' }}>
          <div className="flex items-center justify-center gap-5">
            {/* 左侧统计 */}
            <div className="text-center">
              <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--ok)' }}>5</div>
              <div style={{ fontSize: '11px', color: 'var(--txt-mut)' }}>已达标</div>
            </div>

            {/* 环形进度 */}
            <div className="relative" style={{ width: '100px', height: '100px' }}>
              <svg className="w-full h-full" style={{ transform: 'rotate(-90deg)' }} viewBox="0 0 100 100">
                {/* 背景环 */}
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="rgba(0,0,0,0.06)"
                  strokeWidth="8"
                />
                {/* 进度环 */}
                <motion.circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="url(#progressGradient)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 42}`}
                  strokeDashoffset={2 * Math.PI * 42 * (1 - progress / 100)}
                  style={{ filter: 'drop-shadow(0 0 6px rgba(122, 156, 173, 0.4))' }}
                />
                <defs>
                  <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#7a9cad" />
                    <stop offset="50%" stopColor="#8faa9d" />
                    <stop offset="100%" stopColor="#9d95ab" />
                  </linearGradient>
                </defs>
              </svg>
              {/* 中心文字 */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span style={{ fontSize: '26px', fontWeight: 700, color: 'var(--txt)' }}>
                  {progress}%
                </span>
                <span style={{ fontSize: '10px', color: 'var(--txt-mut)' }}>升级进度</span>
              </div>
            </div>

            {/* 右侧统计 */}
            <div className="text-center">
              <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--err)' }}>1</div>
              <div style={{ fontSize: '11px', color: 'var(--txt-mut)' }}>待完成</div>
            </div>
          </div>

          {/* 等级标签 */}
          <div className="flex justify-center" style={{ marginTop: '10px' }}>
            <span style={{
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '11px',
              background: 'rgba(122,156,173,.1)',
              color: '#7a9cad',
              border: '1px solid rgba(122,156,173,.2)',
            }}>
              Lv2 → Lv3
            </span>
          </div>
        </div>

        {/* 阅读等级 - 复刻 .ldsp-reading */}
        <div style={{ 
          padding: '10px 14px', 
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-card)',
        }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span style={{ fontSize: '24px' }}>🔥</span>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#c9a87c' }}>沉浸阅读</div>
                <div style={{ fontSize: '11px', color: 'var(--txt-mut)' }}>距下一级还需44分钟</div>
              </div>
            </div>
            <div style={{ 
              width: '70px', 
              height: '6px', 
              borderRadius: '3px', 
              background: 'rgba(0,0,0,.06)',
              overflow: 'hidden',
            }}>
              <motion.div 
                style={{ 
                  height: '100%', 
                  background: 'linear-gradient(90deg, #c9a87c, #b89070)',
                  borderRadius: '3px',
                }}
                initial={{ width: 0 }}
                animate={{ width: '76%' }}
                transition={{ duration: 1, delay: 0.5 }}
              />
            </div>
          </div>
        </div>

        {/* Tab栏 - 复刻 .ldsp-tabs */}
        <div style={{ 
          padding: '8px 14px', 
          borderTop: '1px solid var(--border)',
          display: 'flex',
          gap: '6px',
        }}>
          {['升级要求', '趋势', '排行榜'].map((tab, i) => (
            <button
              key={tab}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                transition: 'all 0.2s',
                background: i === 0 ? 'rgba(122,156,173,.1)' : 'transparent',
                color: i === 0 ? 'var(--txt)' : 'var(--txt-mut)',
                border: i === 0 ? '1px solid rgba(122,156,173,.2)' : '1px solid transparent',
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* 需求列表 - 复刻 .ldsp-req-item */}
        <div style={{ padding: '8px 14px', maxHeight: '150px', overflowY: 'auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {[
              { label: '浏览话题', current: 1250, required: 500, done: true, icon: '📖' },
              { label: '已读帖子', current: 8420, required: 3000, done: true, icon: '📚' },
              { label: '发帖', current: 25, required: 10, done: true, icon: '✏️' },
              { label: '回复', current: 156, required: 30, done: true, icon: '💬' },
              { label: '获赞', current: 89, required: 50, done: true, icon: '❤️' },
              { label: '送出赞', current: 45, required: 75, done: false, icon: '👍', change: +12 },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  borderRadius: '10px',
                  background: 'var(--bg-el)',
                  transition: 'all 0.2s',
                }}
              >
                <div className="flex items-center gap-2">
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    background: item.done ? 'rgba(122,156,140,.12)' : 'rgba(201,135,127,.12)',
                  }}>
                    {item.icon}
                  </div>
                  <span style={{ fontSize: '13px', color: 'var(--txt-sec)' }}>{item.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  {item.change && (
                    <span className="flex items-center" style={{ fontSize: '11px', color: 'var(--ok)' }}>
                      <ChevronUp size={12} />
                      {item.change}
                    </span>
                  )}
                  <span style={{ 
                    fontSize: '12px', 
                    fontWeight: 600,
                    color: item.done ? 'var(--ok)' : 'var(--txt-sec)',
                  }}>
                    {item.current.toLocaleString()}/{item.required.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 底部状态栏 */}
        <div style={{ 
          padding: '8px 14px', 
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: 'var(--txt-mut)',
        }}>
          <div className="flex items-center gap-1">
            <div style={{ 
              width: '6px', 
              height: '6px', 
              borderRadius: '50%', 
              background: 'var(--ok)',
              boxShadow: '0 0 8px var(--ok)',
              animation: 'pulse 2s infinite',
            }} />
            <span>追踪中</span>
          </div>
          <span>☁️ 已同步</span>
        </div>
      </div>
      
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </motion.div>
  )
}
