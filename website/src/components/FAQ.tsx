import { motion, useInView, AnimatePresence } from 'framer-motion'
import { useRef, useState, useMemo } from 'react'
import { ChevronDown, Shield, Cloud, Trophy, Lock, HelpCircle, Settings, Zap } from 'lucide-react'
import { useFaqs } from '../hooks/useSiteData'

// 图标组件映射
const IconMap: Record<string, React.ReactNode> = {
  Shield: <Shield className="w-5 h-5" />,
  Trophy: <Trophy className="w-5 h-5" />,
  Cloud: <Cloud className="w-5 h-5" />,
  Lock: <Lock className="w-5 h-5" />,
  HelpCircle: <HelpCircle className="w-5 h-5" />,
  Settings: <Settings className="w-5 h-5" />,
  Zap: <Zap className="w-5 h-5" />
}

export default function FAQ() {
  const { data: faqsData } = useFaqs()
  
  // 转换 API 数据格式为组件所需格式
  const faqs = useMemo(() => {
    return faqsData.map(faq => ({
      question: faq.question,
      answer: faq.answer,
      icon: IconMap[faq.icon] || <HelpCircle className="w-5 h-5" />,
      color: faq.icon_color
    }))
  }, [faqsData])
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })
  const [expanded, setExpanded] = useState<number | null>(0)

  return (
    <section id="faq" className="py-24 relative" ref={ref}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 标题 */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16 select-none"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            <span className="text-white">常见问题</span>
          </h2>
          <p className="text-gray-400 text-lg">
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
                  <span className="flex-1 font-medium text-white">
                    {faq.question}
                  </span>
                  <motion.div
                    animate={{ rotate: expanded === index ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  </motion.div>
                </button>

                {/* 答案内容 */}
                <AnimatePresence>
                  {expanded === index && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="px-6 pb-4 pl-14">
                        <p className="text-gray-400 leading-relaxed">
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
          transition={{ duration: 0.6, delay: 0.8 }}
          className="text-center mt-12"
        >
          <p className="text-gray-500 mb-4">还有其他问题？</p>
          <a
            href="https://github.com/caigg188/LDStatusPro/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-gray-700 text-gray-300 hover:border-gray-600 hover:bg-white/5 transition-all"
          >
            在 GitHub 提问 →
          </a>
        </motion.div>
      </div>
    </section>
  )
}
