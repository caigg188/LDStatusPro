import { motion, useInView, AnimatePresence } from 'framer-motion'
import { useRef, useState } from 'react'
import { ChevronDown, Shield, Cloud, Clock, Settings, Zap, Store } from 'lucide-react'

// 固定 FAQ 数据
const faqs = [
  {
    question: '安装这个脚本安全吗？会不会盗号？',
    answer: '完全安全！LDStatus Pro 是开源项目，代码公开透明，你可以在 GitHub 查看全部源码。脚本使用官方 OAuth 认证登录，不会获取你的密码。所有数据存储在浏览器本地或你自己授权的云端账号中。',
    icon: <Shield className="w-5 h-5" />,
    color: 'text-[#8faa9d]'
  },
  {
    question: '面板不显示怎么办？',
    answer: '请检查：1. 浏览器开发者模式已开启；2. Tampermonkey 扩展中脚本已启用；3. 刷新页面后等待几秒。如仍不显示，尝试禁用其他可能冲突的扩展后重试。',
    icon: <Settings className="w-5 h-5" />,
    color: 'text-[#9d95ab]'
  },
  {
    question: '阅读时间为什么不增加？',
    answer: '脚本检测鼠标移动、滚动、点击等活动。60秒无操作会自动暂停计时，恢复操作后继续计时。这是为了确保统计的是真实阅读时间。',
    icon: <Clock className="w-5 h-5" />,
    color: 'text-[#c9a87c]'
  },
  {
    question: '云同步数据会覆盖本地数据吗？',
    answer: '不会！云同步采用「取较大值合并」策略。同一天的数据，保留本地和云端中的较大值，不会丢失任何已记录的阅读时间。',
    icon: <Cloud className="w-5 h-5" />,
    color: 'text-[#8ba4b8]'
  },
  {
    question: '如何在 LD士多 发布兑换信息？',
    answer: '打开 LDC 积分面板 → 切换到「LD士多」→ 点击「我的发布」→「商家设置」→ 填写 LDC PID（从 credit.linux.do 个人页面获取）→ 保存后即可发布兑换信息。',
    icon: <Store className="w-5 h-5" />,
    color: 'text-[#c4a6a0]'
  },
  {
    question: 'Firefox 浏览器登录失败怎么办？',
    answer: '部分 Firefox 用户可能因隐私设置导致 OAuth 登录失败。请尝试：1. 将增强型追踪保护改为「标准」；2. 确保授权弹窗和主页面在同一个容器中；3. 检查第三方 Cookie 设置。',
    icon: <Zap className="w-5 h-5" />,
    color: 'text-[#b89090]'
  }
]

export default function FAQ() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })
  const [expanded, setExpanded] = useState<number | null>(0)

  return (
    <section id="faq" className="py-24 relative bg-[#efedea]" ref={ref}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 标题 */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-16 select-none"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            <span className="text-[#3d3d3d]">常见问题</span>
          </h2>
          <p className="text-[#6b6b6b] text-lg">
            解答你可能遇到的疑问
          </p>
        </motion.div>

        {/* 问题列表 */}
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <div className="glass glass-hover rounded-xl overflow-hidden">
                {/* 问题头部 */}
                <button
                  className="w-full px-6 py-4 flex items-center gap-4 text-left cursor-pointer select-none"
                  onClick={() => setExpanded(expanded === index ? null : index)}
                >
                  <div className={`${faq.color}`}>
                    {faq.icon}
                  </div>
                  <span className="flex-1 font-medium text-[#3d3d3d]">
                    {faq.question}
                  </span>
                  <motion.div
                    animate={{ rotate: expanded === index ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown className="w-5 h-5 text-[#9a9a9a]" />
                  </motion.div>
                </button>

                {/* 答案内容 */}
                <AnimatePresence>
                  {expanded === index && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      <div className="px-6 pb-4 pl-14">
                        <p className="text-[#6b6b6b] leading-relaxed">
                          {faq.answer}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ))}
        </div>

        {/* 更多问题 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="text-center mt-12"
        >
          <p className="text-[#9a9a9a] mb-4">还有其他问题？</p>
          <a
            href="https://github.com/caigg188/LDStatusPro/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-[#d4d2cf] text-[#6b6b6b] hover:border-[#9d95ab] hover:bg-white/50 transition-all glass"
          >
            在 GitHub 提问 →
          </a>
        </motion.div>
      </div>
    </section>
  )
}
