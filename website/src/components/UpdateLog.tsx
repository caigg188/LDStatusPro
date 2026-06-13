import { motion, useInView } from 'framer-motion'
import { useRef, useState } from 'react'
import { Sparkles, ChevronDown } from 'lucide-react'

// 固定更新日志数据
const updates = [
  {
    version: 'v3.5.4',
    date: '2026-01',
    badge: '最新',
    badgeColor: 'from-[#8faa9d] to-[#7a9c8a]',
    title: 'LD士多 - 虚拟物品兑换信息中心',
    highlights: [
      '🏪 LDC 积分兑换 - 使用积分兑换虚拟物品和服务',
      '📦 CDK 自动发放 - 兑换成功后自动获取卡密',
      '👤 商家入驻 - 绑定 LDC 账户发布兑换信息',
      '🛡️ 安全加固 - XSS 防护、SQL 注入防护、CDK 竞态修复'
    ]
  },
  {
    version: 'v3.5.2',
    date: '2025-12',
    badge: '功能',
    badgeColor: 'from-[#8ba4b8] to-[#7a9cad]',
    title: 'CDK 面板 & 请求优化',
    highlights: [
      '🔑 CDK 面板 - cdk.linux.do 页面集成 CDK 领取功能',
      '🚦 全局请求队列 - 300ms 最小间隔防止 429',
      '💬 错误提示优化 - 智能识别错误类型，友好提示'
    ]
  },
  {
    version: 'v3.5.0',
    date: '2025-11',
    badge: '重大',
    badgeColor: 'from-[#c9a87c] to-[#b89a6a]',
    title: '吃瓜助手 & 我的活动 & LDC 积分',
    highlights: [
      '🍉 吃瓜助手 - AI 帖子总结、追问对话、历史记录',
      '📋 我的活动 - 已读/收藏/回复/赞过/我的话题',
      '🍟 LDC 积分 - 余额查看、7日统计、赞赏支持'
    ]
  },
  {
    version: 'v3.4.0',
    date: '2025-10',
    badge: '功能',
    badgeColor: 'from-[#9d95ab] to-[#8a82a0]',
    title: '工单系统 & UI 全面优化',
    highlights: [
      '🎫 反馈工单 - 用户可便捷提交功能建议/BUG反馈',
      '🎨 UI 配色优化 - 使用更高级沉稳的配色方案',
      '📊 低等级支持 - 0/1 级用户也可查看升级进度'
    ]
  },
  {
    version: 'v3.3.0',
    date: '2025-09',
    badge: '功能',
    badgeColor: 'from-[#c4a6a0] to-[#b89090]',
    title: '双站点支持 & 排行榜系统',
    highlights: [
      '🌐 IDCFlare 支持 - 双站点完整功能支持',
      '🏆 排行榜系统 - 日/周/月三榜，Top 50 展示',
      '☁️ 云端同步 - 365 天历史数据恢复'
    ]
  }
]

export default function UpdateLog() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })
  const [expanded, setExpanded] = useState<string | null>('官网上线')

  return (
    <section id="updates" className="py-24 relative bg-[#f8f7f5]" ref={ref}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 标题 */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-16 select-none"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            <span className="text-[#3d3d3d]">更新日志</span>
          </h2>
          <p className="text-[#6b6b6b] text-lg">
            持续迭代，不断进化
          </p>
        </motion.div>

        {/* 时间线 */}
        <div className="relative">
          {/* 左侧时间线 - 莫兰迪渐变 */}
          <div className="absolute left-0 md:left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-[#8ba4b8] via-[#9d95ab] to-[#c4a6a0] opacity-30 md:-translate-x-1/2" />

          {/* 更新条目 */}
          <div className="space-y-8">
            {updates.map((update, index) => (
              <motion.div
                key={update.version}
                initial={{ opacity: 0, x: index % 2 === 0 ? -30 : 30 }}
                animate={isInView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className={`relative flex flex-col md:flex-row gap-8 ${
                  index % 2 === 0 ? 'md:flex-row-reverse' : ''
                }`}
              >
                {/* 时间线圆点 */}
                <div className="absolute left-0 md:left-1/2 w-4 h-4 rounded-full bg-gradient-to-r from-[#9d95ab] to-[#c4a6a0] md:-translate-x-1/2 shadow-lg shadow-[#9d95ab]/30" />

                {/* 日期 (桌面端) */}
                <div className={`hidden md:flex md:w-1/2 items-start ${
                  index % 2 === 0 ? 'justify-start pl-8' : 'justify-end pr-8'
                }`}>
                  <span className="text-[#9a9a9a] text-sm mt-2">{update.date}</span>
                </div>

                {/* 内容卡片 */}
                <div className={`ml-8 md:ml-0 md:w-1/2 ${
                  index % 2 === 0 ? 'md:pr-8' : 'md:pl-8'
                }`}>
                  <motion.div
                    className="glass glass-hover rounded-xl overflow-hidden cursor-pointer select-none"
                    onClick={() => setExpanded(expanded === update.version ? null : update.version)}
                    whileHover={{ scale: 1.01 }}
                  >
                    {/* 头部 */}
                    <div className="p-4 flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          {/* 版本号 */}
                          <span className="text-lg font-bold text-[#3d3d3d]">{update.version}</span>
                          
                          {/* 徽章 */}
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium text-white bg-gradient-to-r ${update.badgeColor}`}>
                            {update.badge}
                          </span>
                          
                          {/* 日期 (移动端) */}
                          <span className="md:hidden text-xs text-[#9a9a9a]">{update.date}</span>
                        </div>
                        
                        {/* 标题 */}
                        <h3 className="text-[#6b6b6b]">{update.title}</h3>
                      </div>

                      {/* 展开图标 */}
                      <motion.div
                        animate={{ rotate: expanded === update.version ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronDown className="w-5 h-5 text-[#9a9a9a]" />
                      </motion.div>
                    </div>

                    {/* 详细内容 */}
                    <motion.div
                      initial={false}
                      animate={{
                        height: expanded === update.version ? 'auto' : 0,
                        opacity: expanded === update.version ? 1 : 0
                      }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <ul className="px-4 pb-4 space-y-2">
                        {update.highlights.map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-[#6b6b6b]">
                            <Sparkles className="w-4 h-4 text-[#9d95ab] flex-shrink-0 mt-0.5" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  </motion.div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* 查看完整日志 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="text-center mt-12"
        >
          <a
            href="https://github.com/caigg188/LDStatusPro/blob/main/update_log.md"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-[#6b6b6b] hover:text-[#3d3d3d] transition-colors"
          >
            查看完整更新日志 →
          </a>
        </motion.div>
      </div>
    </section>
  )
}
