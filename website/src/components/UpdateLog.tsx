import { motion, useInView } from 'framer-motion'
import { useRef, useState, useMemo } from 'react'
import { Sparkles, ChevronDown } from 'lucide-react'
import { useUpdateLogs } from '../hooks/useSiteData'

export default function UpdateLog() {
  const { data: updateLogsData } = useUpdateLogs()
  
  // 转换 API 数据格式为组件所需格式
  const updates = useMemo(() => {
    return updateLogsData.map(log => ({
      version: log.version,
      date: log.date,
      badge: log.badge,
      badgeColor: log.badge_color,
      title: log.title,
      highlights: log.highlights
    }))
  }, [updateLogsData])
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })
  const [expanded, setExpanded] = useState<string | null>('官网上线')

  return (
    <section id="updates" className="py-24 relative" ref={ref}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 标题 */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16 select-none"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            <span className="text-white">更新日志</span>
          </h2>
          <p className="text-gray-400 text-lg">
            持续迭代，不断进化
          </p>
        </motion.div>

        {/* 时间线 */}
        <div className="relative">
          {/* 左侧时间线 */}
          <div className="absolute left-0 md:left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500 via-purple-500 to-pink-500 opacity-30 md:-translate-x-1/2" />

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
                <div className="absolute left-0 md:left-1/2 w-4 h-4 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 md:-translate-x-1/2 shadow-lg shadow-purple-500/50" />

                {/* 日期 (桌面端) */}
                <div className={`hidden md:flex md:w-1/2 items-start ${
                  index % 2 === 0 ? 'justify-start pl-8' : 'justify-end pr-8'
                }`}>
                  <span className="text-gray-500 text-sm mt-2">{update.date}</span>
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
                          <span className="text-lg font-bold text-white">{update.version}</span>
                          
                          {/* 徽章 */}
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium text-white bg-gradient-to-r ${update.badgeColor}`}>
                            {update.badge}
                          </span>
                          
                          {/* 日期 (移动端) */}
                          <span className="md:hidden text-xs text-gray-500">{update.date}</span>
                        </div>
                        
                        {/* 标题 */}
                        <h3 className="text-gray-300">{update.title}</h3>
                      </div>

                      {/* 展开图标 */}
                      <motion.div
                        animate={{ rotate: expanded === update.version ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronDown className="w-5 h-5 text-gray-500" />
                      </motion.div>
                    </div>

                    {/* 详细内容 */}
                    <motion.div
                      initial={false}
                      animate={{
                        height: expanded === update.version ? 'auto' : 0,
                        opacity: expanded === update.version ? 1 : 0
                      }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <ul className="px-4 pb-4 space-y-2">
                        {update.highlights.map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                            <Sparkles className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
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
          transition={{ duration: 0.6, delay: 0.8 }}
          className="text-center mt-12"
        >
          <a
            href="https://github.com/caigg188/LDStatusPro/blob/main/update_log.md"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            查看完整更新日志 →
          </a>
        </motion.div>
      </div>
    </section>
  )
}
