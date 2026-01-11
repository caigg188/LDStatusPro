import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  Calendar, Clock, Trophy, Flame,
  BookOpen, Target,
  ChevronRight, Share2, ArrowRight,
  Crown, Zap, Heart, TrendingUp,
  BarChart3, Activity, Star,
  Copy, Check
} from 'lucide-react'

// API 配置
const API_BASE_URL = 'https://api.ldspro.qzz.io'

// 定义类型
interface Achievement {
  id: string
  name: string
  icon: string
  description: string
}

interface MonthlyData {
  month: string
  monthName: string
  minutes: number
  formattedTime: string
  hours: number
}

interface ReportData {
  userId: number
  site: string
  year: string
  summary: {
    totalMinutes: number
    totalDays: number
    avgDailyMinutes: number
    formattedTotal: string
    formattedAvgDaily: string
  }
  records: {
    maxDailyMinutes: number
    maxDailyDate: string
    formattedMaxDaily: string
    longestStreak: number
    longestStreakStart: string
    longestStreakEnd: string
  }
  timeline: {
    firstReadingDate: string
    lastReadingDate: string
    activeWeeks: number
  }
  ranking: {
    totalRank: number
    totalUsers: number
    topPercent: number
    percentileText: string
  }
  monthlyData: MonthlyData[]
  bestPeriods: {
    bestMonth: string
    bestMonthMinutes: number
    formattedBestMonth: string
    bestWeek: string
    bestWeekMinutes: number
    formattedBestWeek: string
  }
  level: {
    min: number
    label: string
    icon: string
    description: string
  }
  achievements: Achievement[]
  computedAt: number
  isRealtime?: boolean
}

// 开始 OAuth 流程（通过后端代理）
async function startOAuth(site: 'linux.do' | 'idcflare.com') {
  try {
    // 调用后端获取授权 URL，传递当前页面作为返回地址
    const returnUrl = window.location.origin + '/report/2025'
    const response = await fetch(`${API_BASE_URL}/api/auth/init?site=${site}&return_url=${encodeURIComponent(returnUrl)}`)
    const result = await response.json()
    
    // 后端返回格式: { success: true, data: { auth_url: "...", state: "..." } }
    const authUrl = result.data?.auth_url || result.auth_url
    
    if (authUrl) {
      // 跳转到授权页面
      window.location.href = authUrl
    } else {
      console.error('Failed to get auth URL:', result)
      alert('获取授权链接失败，请稍后重试')
    }
  } catch (error) {
    console.error('OAuth init error:', error)
    alert('网络错误，请稍后重试')
  }
}

// 解析 JWT
function parseJwt(token: string) {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    }).join(''))
    return JSON.parse(jsonPayload)
  } catch (e) {
    return null
  }
}

// 登录选择组件
function LoginSelector({ onSelectSite }: { onSelectSite: (site: 'linux.do' | 'idcflare.com') => void }) {
  return (
    <div className="min-h-screen bg-[#0c0c14] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-aurora opacity-50" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 max-w-lg w-full"
      >
        {/* 标题区域 */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.2 }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 mb-6"
          >
            <BookOpen className="w-10 h-10 text-white" />
          </motion.div>
          
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
            2025 年度阅读报告
          </h1>
          <p className="text-gray-400 text-lg">
            回顾你在社区的成长足迹
          </p>
        </div>

        {/* 登录按钮 */}
        <div className="space-y-4">
          <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelectSite('linux.do')}
            className="w-full glass glass-hover rounded-2xl p-6 flex items-center gap-4 transition-all"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <span className="text-2xl">🐧</span>
            </div>
            <div className="flex-1 text-left">
              <div className="text-white font-semibold text-lg">Linux.do</div>
              <div className="text-gray-400 text-sm">使用 Linux.do 账号登录</div>
            </div>
            <ChevronRight className="text-gray-500" />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelectSite('idcflare.com')}
            className="w-full glass glass-hover rounded-2xl p-6 flex items-center gap-4 transition-all"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
              <span className="text-2xl">☁️</span>
            </div>
            <div className="flex-1 text-left">
              <div className="text-white font-semibold text-lg">IDCFlare</div>
              <div className="text-gray-400 text-sm">使用 IDCFlare 账号登录</div>
            </div>
            <ChevronRight className="text-gray-500" />
          </motion.button>
        </div>

        {/* 说明文字 */}
        <p className="text-center text-gray-500 text-sm mt-6">
          登录后即可查看你的专属年度报告
        </p>
      </motion.div>
    </div>
  )
}

// 加载动画组件
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#0c0c14] flex items-center justify-center">
      <div className="absolute inset-0 bg-aurora opacity-30" />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative z-10 text-center"
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-16 h-16 mx-auto mb-6 rounded-full border-4 border-purple-500 border-t-transparent"
        />
        <p className="text-gray-400 text-lg">正在生成你的年度报告...</p>
      </motion.div>
    </div>
  )
}

// 无数据组件
function NoDataScreen() {
  return (
    <div className="min-h-screen bg-[#0c0c14] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-aurora opacity-30" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 text-center max-w-md"
      >
        <div className="text-6xl mb-6">📚</div>
        <h2 className="text-2xl font-bold text-white mb-4">还没有阅读记录</h2>
        <p className="text-gray-400 mb-8">
          你在 2025 年还没有使用 LDStatus Pro 记录阅读时间，
          快去安装脚本开始记录吧！
        </p>
        <motion.a
          href="/"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold"
        >
          了解更多 <ArrowRight size={18} />
        </motion.a>
      </motion.div>
    </div>
  )
}

// 统计卡片组件
function StatCard({ icon: Icon, label, value, subValue, color, delay = 0 }: {
  icon: React.ComponentType<{ className?: string; size?: number }>
  label: string
  value: string | number
  subValue?: string
  color: string
  delay?: number
}) {
  const colorClasses: Record<string, string> = {
    blue: 'from-blue-500/20 to-blue-600/20 border-blue-500/30',
    purple: 'from-purple-500/20 to-purple-600/20 border-purple-500/30',
    pink: 'from-pink-500/20 to-pink-600/20 border-pink-500/30',
    orange: 'from-orange-500/20 to-orange-600/20 border-orange-500/30',
    green: 'from-green-500/20 to-green-600/20 border-green-500/30',
  }

  const iconColors: Record<string, string> = {
    blue: 'text-blue-400',
    purple: 'text-purple-400',
    pink: 'text-pink-400',
    orange: 'text-orange-400',
    green: 'text-green-400',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay }}
      className={`rounded-2xl bg-gradient-to-br ${colorClasses[color]} border p-6`}
    >
      <Icon className={`${iconColors[color]} mb-3`} size={28} />
      <div className="text-3xl font-bold text-white mb-1">{value}</div>
      <div className="text-gray-400 text-sm">{label}</div>
      {subValue && <div className="text-gray-500 text-xs mt-1">{subValue}</div>}
    </motion.div>
  )
}

// 动画数字计数器
function AnimatedNumber({ value, suffix = '' }: { value: number | string; suffix?: string }) {
  const [displayValue, setDisplayValue] = useState(0)
  const numValue = typeof value === 'string' ? parseInt(value) : value
  
  useEffect(() => {
    const duration = 2000
    const steps = 60
    const stepDuration = duration / steps
    const increment = numValue / steps
    
    let current = 0
    const timer = setInterval(() => {
      current += increment
      if (current >= numValue) {
        setDisplayValue(numValue)
        clearInterval(timer)
      } else {
        setDisplayValue(Math.floor(current))
      }
    }, stepDuration)
    
    return () => clearInterval(timer)
  }, [numValue])
  
  return <span>{displayValue}{suffix}</span>
}

// 进度环组件
function CircleProgress({ percentage, color, label, value }: { percentage: number; color: string; label: string; value: string }) {
  const radius = 45
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference * (1 - percentage / 100)
  
  const colorMap: Record<string, string> = {
    blue: 'stroke-blue-500',
    purple: 'stroke-purple-500',
    pink: 'stroke-pink-500',
    orange: 'stroke-orange-500',
    green: 'stroke-green-500'
  }
  
  const bgColorMap: Record<string, string> = {
    blue: 'from-blue-500/20 to-blue-600/20 border-blue-500/30',
    purple: 'from-purple-500/20 to-purple-600/20 border-purple-500/30',
    pink: 'from-pink-500/20 to-pink-600/20 border-pink-500/30',
    orange: 'from-orange-500/20 to-orange-600/20 border-orange-500/30',
    green: 'from-green-500/20 to-green-600/20 border-green-500/30'
  }
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      className={`rounded-2xl bg-gradient-to-br ${bgColorMap[color]} border p-6 text-center`}
    >
      <svg width={120} height={120} className="mx-auto mb-4">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
        <motion.circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          className={colorMap[color]}
          strokeWidth="4"
          strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }}
          whileInView={{ strokeDashoffset }}
          viewport={{ once: true }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          style={{ strokeDasharray: circumference, transform: 'rotate(-90deg)', transformOrigin: '60px 60px' }}
        />
        <text x="60" y="70" textAnchor="middle" className="text-white font-bold text-xl" fill="white">
          {Math.round(percentage)}%
        </text>
      </svg>
      <div className="text-gray-400 text-sm mb-1">{label}</div>
      <div className="text-white font-bold text-lg">{value}</div>
    </motion.div>
  )
}

// 里程碑事件卡片
function MilestoneCard({ icon: Icon, title, description, date, color, index }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1 }}
      className="flex gap-4"
    >
      <div className={`w-12 h-12 rounded-lg bg-gradient-to-br from-${color}-500/20 to-${color}-600/20 border border-${color}-500/30 flex items-center justify-center flex-shrink-0`}>
        <Icon className={`text-${color}-400`} size={24} />
      </div>
      <div className="flex-1">
        <div className="font-semibold text-white">{title}</div>
        <div className="text-gray-400 text-sm mt-1">{description}</div>
        <div className="text-gray-500 text-xs mt-2">{date}</div>
      </div>
    </motion.div>
  )
}

// 分享弹窗
function ShareModal({ isOpen, onClose, reportData }: { isOpen: boolean; onClose: () => void; reportData: ReportData }) {
  const [copied, setCopied] = useState(false)
  
  const shareText = `我在2025年阅读了${reportData.summary.formattedTotal}，排名前${reportData.ranking.totalRank}！来LDStatus Pro看我的年度报告吧 📚`
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  
  if (!isOpen) return null
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="glass rounded-2xl p-8 max-w-md w-full border border-white/10"
      >
        <h3 className="text-xl font-bold text-white mb-6">分享你的年度报告</h3>
        
        <div className="space-y-4 mb-6">
          <button
            onClick={copyToClipboard}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-blue-500/20 border border-blue-500/30 hover:border-blue-500 text-blue-300 hover:text-blue-200 transition-colors"
          >
            {copied ? <Check size={20} /> : <Copy size={20} />}
            <span>{copied ? '已复制！' : '复制分享文案'}</span>
          </button>
          
          <a
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-gray-300 hover:text-white transition-colors"
          >
            <span>𝕏</span>
            <span>分享到 X (Twitter)</span>
          </a>
        </div>
        
        <button
          onClick={onClose}
          className="w-full px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors"
        >
          关闭
        </button>
      </motion.div>
    </motion.div>
  )
}

// 月度图表组件
function MonthlyChart({ data }: { data: MonthlyData[] }) {
  const maxMinutes = Math.max(...data.map(d => d.minutes), 1)
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="glass rounded-2xl p-6"
    >
      <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        <Calendar className="text-blue-400" size={24} />
        月度阅读趋势
      </h3>
      
      <div className="flex items-end justify-between gap-2 h-48">
        {data.map((month, idx) => {
          const height = maxMinutes > 0 ? (month.minutes / maxMinutes) * 100 : 0
          return (
            <motion.div
              key={month.month}
              initial={{ height: 0 }}
              whileInView={{ height: `${Math.max(height, 2)}%` }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.05, duration: 0.5 }}
              className="flex-1 relative group"
            >
              <div 
                className="absolute bottom-0 left-0 right-0 rounded-t-lg bg-gradient-to-t from-purple-500 to-blue-500 opacity-80 group-hover:opacity-100 transition-opacity"
                style={{ height: '100%' }}
              />
              {/* Tooltip */}
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-800 rounded-lg px-2 py-1 text-xs text-white whitespace-nowrap z-10">
                {month.formattedTime}
              </div>
            </motion.div>
          )
        })}
      </div>
      
      <div className="flex justify-between mt-2">
        {data.map(month => (
          <div key={month.month} className="flex-1 text-center text-xs text-gray-500">
            {month.monthName.replace('月', '')}
          </div>
        ))}
      </div>
    </motion.div>
  )
}

// 成就徽章组件
function AchievementBadge({ achievement, delay = 0 }: { achievement: Achievement; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ delay }}
      whileHover={{ scale: 1.05, y: -2 }}
      className="glass rounded-xl p-4 text-center"
    >
      <div className="text-3xl mb-2">{achievement.icon}</div>
      <div className="text-white font-semibold text-sm">{achievement.name}</div>
      <div className="text-gray-500 text-xs mt-1">{achievement.description}</div>
    </motion.div>
  )
}

// 年度报告主页面
function ReportPage({ data }: { data: ReportData }) {
  const [shareOpen, setShareOpen] = useState(false)
  
  // 格式化日期
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return `${date.getMonth() + 1}月${date.getDate()}日`
  }

  // 计算总小时数
  const totalHours = Math.round(data.summary.totalMinutes / 60)
  
  // 计算完成度（相对于等级要求）
  const levelCompletion = Math.min(100, (data.summary.totalMinutes / (data.level.min + 1000)) * 100)
  
  // 计算最佳月份的完成度
  const bestMonthCompletion = (data.bestPeriods.bestMonthMinutes / (data.summary.totalMinutes || 1)) * 100
  
  // 计算平均每天阅读
  const dailyAverage = Math.round(data.summary.totalMinutes / data.summary.totalDays)

  return (
    <div className="min-h-screen bg-[#0c0c14]">
      <div className="absolute inset-0 bg-aurora opacity-30 fixed" />
      
      {/* 顶部导航 */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-white">2025 年度报告</span>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShareOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold hover:shadow-lg hover:shadow-purple-500/50 transition-shadow"
          >
            <Share2 size={18} />
            <span className="hidden sm:inline">分享报告</span>
          </motion.button>
        </div>
      </nav>

      {/* 分享弹窗 */}
      <ShareModal isOpen={shareOpen} onClose={() => setShareOpen(false)} reportData={data} />

      {/* 主内容区域 */}
      <main className="relative z-10 pt-20 pb-20">
        {/* Hero 区域 - 增强版 */}
        <section className="min-h-[90vh] flex items-center justify-center px-4 overflow-hidden">
          <div className="absolute inset-0 -z-10">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
          </div>
          
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center max-w-4xl w-full"
          >
            {/* 等级徽章 - 增强 */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.3, damping: 10 }}
              className="inline-flex items-center gap-4 px-8 py-4 rounded-full glass mb-8 border border-white/10"
            >
              <motion.span 
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-4xl"
              >
                {data.level.icon}
              </motion.span>
              <div className="text-left">
                <div className="text-white font-bold text-lg">{data.level.label}</div>
                <div className="text-gray-400 text-sm">{data.level.description}</div>
              </div>
            </motion.div>

            {/* 主标题 - 大号且有动画 */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-4 leading-tight"
            >
              <span className="text-white">2025年，你共阅读了</span>
            </motion.h1>
            
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
              className="mb-8"
            >
              <div className="text-6xl sm:text-7xl lg:text-8xl font-black">
                <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  <AnimatedNumber value={totalHours} suffix=" 小时" />
                </span>
              </div>
              <p className="text-xl sm:text-2xl text-gray-400 mt-4">
                {data.summary.formattedTotal}，日均 <span className="text-blue-400 font-bold">{Math.round(dailyAverage)}分钟</span>
              </p>
            </motion.div>

            {/* 排名信息 - 卡片式 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="inline-flex flex-col sm:flex-row items-center gap-8 px-8 py-6 rounded-2xl bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 mb-8"
            >
              <div className="flex items-center gap-4">
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Trophy className="text-yellow-400" size={40} />
                </motion.div>
                <div className="text-left">
                  <div className="text-3xl sm:text-4xl font-bold text-white">
                    第 <span className="text-yellow-400">{data.ranking.totalRank}</span> 名
                  </div>
                  <div className="text-gray-400">
                    {data.ranking.percentileText}
                  </div>
                </div>
              </div>
              
              <div className="hidden sm:block w-px h-12 bg-yellow-500/20" />
              
              <div className="text-left">
                <div className="text-2xl font-bold text-white">
                  超越 <span className="text-pink-400">{data.ranking.topPercent.toFixed(1)}%</span> 的用户
                </div>
                <div className="text-gray-400">
                  共计 {data.ranking.totalUsers.toLocaleString()} 位阅读者
                </div>
              </div>
            </motion.div>

            {/* CTA 按钮 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <motion.button
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShareOpen(true)}
                className="px-8 py-4 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold flex items-center justify-center gap-2"
              >
                <Share2 size={20} />
                分享成就
              </motion.button>
              <motion.a
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                href="/"
                className="px-8 py-4 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-semibold flex items-center justify-center gap-2"
              >
                <ArrowRight size={20} />
                返回官网
              </motion.a>
            </motion.div>
          </motion.div>
        </section>

        {/* 核心统计卡片 */}
        <section className="max-w-6xl mx-auto px-4 py-20">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl font-bold text-white text-center mb-4"
          >
            📊 年度数据概览
          </motion.h2>
          <p className="text-gray-400 text-center mb-12">你的阅读之旅用数据说话</p>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={Clock}
              label="总阅读时长"
              value={data.summary.formattedTotal}
              color="blue"
              delay={0}
            />
            <StatCard
              icon={Calendar}
              label="阅读天数"
              value={`${data.summary.totalDays} 天`}
              subValue={`日均 ${data.summary.formattedAvgDaily}`}
              color="purple"
              delay={0.1}
            />
            <StatCard
              icon={Flame}
              label="最长连续"
              value={`${data.records.longestStreak} 天`}
              subValue={data.records.longestStreakStart && `${formatDate(data.records.longestStreakStart)}`}
              color="orange"
              delay={0.2}
            />
            <StatCard
              icon={Zap}
              label="单日最高"
              value={data.records.formattedMaxDaily}
              subValue={data.records.maxDailyDate && formatDate(data.records.maxDailyDate)}
              color="pink"
              delay={0.3}
            />
          </div>
        </section>

        {/* 进度环统计 */}
        <section className="max-w-6xl mx-auto px-4 py-20">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl font-bold text-white text-center mb-12"
          >
            🎯 深度数据分析
          </motion.h2>
          
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
            <CircleProgress
              percentage={levelCompletion}
              color="blue"
              label="等级完成度"
              value={`${Math.round(levelCompletion)}%`}
            />
            <CircleProgress
              percentage={bestMonthCompletion}
              color="purple"
              label="最佳月份占比"
              value={data.bestPeriods.bestMonth}
            />
            <CircleProgress
              percentage={Math.min(100, (data.summary.totalDays / 365) * 100)}
              color="pink"
              label="活跃天数比例"
              value={`${Math.round((data.summary.totalDays / 365) * 100)}%`}
            />
          </div>
        </section>

        {/* 月度趋势图表 */}
        <section className="max-w-6xl mx-auto px-4 py-20">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl font-bold text-white text-center mb-4"
          >
            📈 月度阅读趋势
          </motion.h2>
          <p className="text-gray-400 text-center mb-12">全年每月的阅读时间分布</p>
          <MonthlyChart data={data.monthlyData} />
        </section>

        {/* 最佳表现 */}
        <section className="max-w-6xl mx-auto px-4 py-20">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl font-bold text-white text-center mb-12"
          >
            🏆 最佳表现
          </motion.h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="glass rounded-2xl p-8 border border-white/10"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                  <BarChart3 className="text-blue-400" size={24} />
                </div>
                <h3 className="text-xl font-bold text-white">最佳阅读月份</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="text-gray-400 text-sm mb-2">{data.bestPeriods.bestMonth}</div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${Math.min(100, (data.bestPeriods.bestMonthMinutes / data.summary.totalMinutes) * 100)}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 1 }}
                      className="h-full bg-gradient-to-r from-blue-500 to-blue-600"
                    />
                  </div>
                  <div className="text-right text-blue-400 font-bold mt-2">
                    {data.bestPeriods.formattedBestMonth}
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="glass rounded-2xl p-8 border border-white/10"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-500/30 flex items-center justify-center">
                  <Activity className="text-purple-400" size={24} />
                </div>
                <h3 className="text-xl font-bold text-white">最佳阅读周</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="text-gray-400 text-sm mb-2">{data.bestPeriods.bestWeek}</div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${Math.min(100, (data.bestPeriods.bestWeekMinutes / data.summary.totalMinutes) * 100)}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 1 }}
                      className="h-full bg-gradient-to-r from-purple-500 to-purple-600"
                    />
                  </div>
                  <div className="text-right text-purple-400 font-bold mt-2">
                    {data.bestPeriods.formattedBestWeek}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* 里程碑时刻 */}
        <section className="max-w-6xl mx-auto px-4 py-20">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl font-bold text-white text-center mb-12"
          >
            ✨ 里程碑时刻
          </motion.h2>
          
          <div className="space-y-4">
            <MilestoneCard
              icon={BookOpen}
              title="开启阅读之旅"
              description={`首次记录阅读，从 ${formatDate(data.timeline.firstReadingDate)} 开始`}
              date={formatDate(data.timeline.firstReadingDate)}
              color="blue"
              index={0}
            />
            <MilestoneCard
              icon={Flame}
              title="创造连续纪录"
              description={`坚持 ${data.records.longestStreak} 天不间断阅读`}
              date={`${formatDate(data.records.longestStreakStart)} 至 ${formatDate(data.records.longestStreakEnd)}`}
              color="orange"
              index={1}
            />
            <MilestoneCard
              icon={Trophy}
              title="进入精英榜单"
              description={`阅读时长超过 ${data.ranking.topPercent.toFixed(1)}% 的用户`}
              date={`排名第 ${data.ranking.totalRank}`}
              color="yellow"
              index={2}
            />
            <MilestoneCard
              icon={Star}
              title="等级升级"
              description={`达到 "${data.level.label}" 等级`}
              date={`需要 ${(data.level.min / 60).toFixed(0)} 小时以上`}
              color="purple"
              index={3}
            />
          </div>
        </section>

        {/* 成就徽章 */}
        {data.achievements && data.achievements.length > 0 && (
          <section className="max-w-6xl mx-auto px-4 py-20">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-4xl font-bold text-white text-center mb-4"
            >
              🎖️ 解锁成就
            </motion.h2>
            <p className="text-gray-400 text-center mb-12">你在 2025 年获得的特殊成就</p>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {data.achievements.map((achievement, idx) => (
                <AchievementBadge 
                  key={achievement.id} 
                  achievement={achievement} 
                  delay={idx * 0.1}
                />
              ))}
            </div>
          </section>
        )}

        {/* 阅读建议 */}
        <section className="max-w-6xl mx-auto px-4 py-20">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl font-bold text-white text-center mb-12"
          >
            💡 2026年建议
          </motion.h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                icon: TrendingUp,
                title: '继续保持势头',
                description: `你已经形成了很好的阅读习惯，2026年让我们继续${data.summary.totalDays > 200 ? '保持这份热情' : '提高阅读频率'}！`
              },
              {
                icon: Target,
                title: '设置新目标',
                description: `不如为2026年设定一个新的目标？基于你的表现，年度 ${Math.round(data.summary.totalMinutes * 1.2 / 60)} 小时是个不错的挑战！`
              },
              {
                icon: Calendar,
                title: '均衡阅读',
                description: `每天坚持约 ${Math.round(dailyAverage)} 分钟的阅读，就能维持目前的水平。找到属于自己的节奏很重要。`
              },
              {
                icon: Crown,
                title: '挑战更高排名',
                description: `你已经超越了${data.ranking.topPercent.toFixed(1)}%的用户，再努力一点就能冲进前10！`
              }
            ].map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="glass rounded-2xl p-6 border border-white/10 hover:border-white/20 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                    <item.icon className="text-blue-400" size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-white mb-2">{item.title}</h3>
                    <p className="text-gray-400 text-sm">{item.description}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* 结尾 */}
        <section className="max-w-3xl mx-auto px-4 py-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="text-6xl mb-6">🎉</div>
            <h2 className="text-4xl font-bold text-white mb-4">
              感谢你的每一次阅读
            </h2>
            <p className="text-gray-400 text-lg mb-8">
              2026年，继续在知识的海洋中遨游吧！
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <motion.a
                href="/"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-8 py-4 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold flex items-center justify-center gap-2"
              >
                <Heart size={20} />
                访问官网
              </motion.a>
              <motion.button
                onClick={() => setShareOpen(true)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-8 py-4 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-semibold flex items-center justify-center gap-2"
              >
                <Share2 size={20} />
                分享报告
              </motion.button>
            </div>
          </motion.div>
        </section>
      </main>

      {/* 底部装饰 */}
      <footer className="relative z-10 border-t border-white/10 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-gray-500 text-sm">
          <p>LDStatus Pro · 2025 年度阅读报告</p>
          <p className="mt-2">数据统计截止至 2025年12月31日</p>
          <p className="mt-4 text-xs">感谢你对阅读的热爱 ❤️</p>
        </div>
      </footer>
    </div>
  )
}

// 主组件
export default function AnnualReport2025() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isFetchingReport, setIsFetchingReport] = useState(false)
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [hasNoData, setHasNoData] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [site, setSite] = useState<'linux.do' | 'idcflare.com'>('linux.do')

  // 检查登录状态
  useEffect(() => {
    // 1. 首先检查 URL hash 中是否有 OAuth 回调数据（后端代理模式）
    const hash = window.location.hash
    if (hash.includes('ldsp_oauth=')) {
      const match = hash.match(/ldsp_oauth=([^&]+)/)
      if (match) {
        try {
          const encoded = match[1]
          const decoded = JSON.parse(decodeURIComponent(atob(encoded)))
          
          if (decoded.t && decoded.u) {
            // 保存 token 和用户信息
            const oauthToken = decoded.t
            // 从 token 中解析站点信息
            const payload = parseJwt(oauthToken)
            const oauthSite = (payload?.site || 'linux.do') as 'linux.do' | 'idcflare.com'
            
            localStorage.setItem('annual_report_token', oauthToken)
            localStorage.setItem('annual_report_site', oauthSite)
            
            setToken(oauthToken)
            setSite(oauthSite)
            setIsAuthenticated(true)
            
            // 清除 URL hash
            window.history.replaceState({}, '', window.location.pathname)
            setIsLoading(false)
            return
          }
        } catch (e) {
          console.error('Failed to parse OAuth data:', e)
        }
        // 清除无效的 hash
        window.history.replaceState({}, '', window.location.pathname)
      }
    }
    
    // 2. 检查是否已有保存的 token
    const savedToken = localStorage.getItem('annual_report_token')
    const savedSite = localStorage.getItem('annual_report_site') as 'linux.do' | 'idcflare.com'
    
    if (savedToken && savedSite) {
      // 验证 token 是否过期
      const payload = parseJwt(savedToken)
      if (payload && payload.exp * 1000 > Date.now()) {
        setToken(savedToken)
        setSite(savedSite)
        setIsAuthenticated(true)
      } else {
        // Token 过期，清除
        localStorage.removeItem('annual_report_token')
        localStorage.removeItem('annual_report_site')
      }
    }
    setIsLoading(false)
  }, [])

  // 获取报告数据
  useEffect(() => {
    if (isAuthenticated && token) {
      fetchReport()
    }
  }, [isAuthenticated, token, site])

  const fetchReport = async () => {
    setIsFetchingReport(true)
    setHasNoData(false)
    try {
      const response = await fetch(`${API_BASE_URL}/api/annual-report/2025?site=${site}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      const result = await response.json()
      console.log('Annual report API result:', result)
      
      if (result.success && result.data) {
        setReportData(result.data)
      } else if (result.success && !result.data) {
        // API 成功但无数据
        setHasNoData(true)
        setReportData(null)
      } else {
        setError(result.error?.message || '获取报告失败')
      }
    } catch (e) {
      console.error('Fetch report error:', e)
      setError('获取报告时发生错误')
    } finally {
      setIsFetchingReport(false)
    }
  }

  // 选择站点登录
  const handleSelectSite = (selectedSite: 'linux.do' | 'idcflare.com') => {
    startOAuth(selectedSite)
  }

  // 渲染
  if (isLoading || isFetchingReport) {
    return <LoadingScreen />
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0c0c14] flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-4">❌ {error}</div>
          <button
            onClick={() => {
              setError(null)
              setIsAuthenticated(false)
              setHasNoData(false)
              setReportData(null)
              localStorage.removeItem('annual_report_token')
              localStorage.removeItem('annual_report_site')
            }}
            className="px-6 py-3 rounded-xl bg-gray-700 text-white"
          >
            重新登录
          </button>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginSelector onSelectSite={handleSelectSite} />
  }

  if (hasNoData) {
    return <NoDataScreen />
  }

  if (!reportData) {
    // 已登录但还没有数据（不应该到这里，但作为保护）
    return <LoadingScreen />
  }

  return <ReportPage data={reportData} />
}
