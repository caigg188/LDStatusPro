import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { Download, Puzzle, RefreshCw, CheckCircle2, ExternalLink } from 'lucide-react'

// 浏览器配置 - 使用官方图标
const browsers = [
  { 
    name: 'Chrome', 
    icon: 'https://www.google.com/chrome/static/images/chrome-logo.svg',
    url: 'https://chromewebstore.google.com/detail/%E7%AF%A1%E6%94%B9%E7%8C%B4/dhdgffkkebhmkfjojejmpbldmpobfkfo',
    iconClass: 'w-6 h-6'
  },
  { 
    name: 'Edge', 
    icon: 'https://www.logo.wine/a/logo/Microsoft_Edge/Microsoft_Edge-New-Logo.wine.svg',
    url: 'https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd',
    iconClass: 'w-20 h-20'  // Edge SVG 有大量额外空白，需要更大
  },
  { 
    name: 'Firefox', 
    icon: 'https://www.mozilla.org/media/protocol/img/logos/firefox/browser/logo.eb1324e44442.svg',
    url: 'https://addons.mozilla.org/zh-CN/firefox/addon/tampermonkey/',
    iconClass: 'w-6 h-6'
  },
  { 
    name: 'Safari', 
    icon: 'https://uxwing.com/wp-content/themes/uxwing/download/brands-and-social-media/safari-icon.png',
    url: 'https://apps.apple.com/us/app/tampermonkey/id1482490089',
    iconClass: 'w-6 h-6'
  },
]

const steps = [
  {
    number: 1,
    title: '安装 Tampermonkey',
    description: '在浏览器扩展商店搜索并安装 Tampermonkey 用户脚本管理器',
    icon: <Puzzle className="w-6 h-6" />,
    color: 'from-blue-500 to-cyan-500',
  },
  {
    number: 2,
    title: '安装脚本',
    description: '点击下方按钮一键安装 LDStatus Pro 脚本',
    icon: <Download className="w-6 h-6" />,
    color: 'from-purple-500 to-pink-500',
  },
  {
    number: 3,
    title: '刷新页面',
    description: '访问 Linux.do 或 IDCFlare，面板自动显示在右下角',
    icon: <RefreshCw className="w-6 h-6" />,
    color: 'from-green-500 to-emerald-500',
  },
]

export default function Installation() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })

  return (
    <section id="install" className="py-24 relative" ref={ref}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 标题 */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16 select-none"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            <span className="text-white">三步开始，</span>
            <span className="gradient-text">简单上手</span>
          </h2>
          <p className="text-gray-400 text-lg">
            只需几分钟，即可享受完整功能
          </p>
        </motion.div>

        {/* 步骤卡片 */}
        <div className="relative">
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, index) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 30 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: index * 0.2 }}
                className="relative"
              >
                <div className="relative glass glass-hover rounded-2xl p-6 h-full">
                  {/* 步骤编号 */}
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-r ${step.color} flex items-center justify-center mb-4 shadow-lg`}>
                    {step.icon}
                  </div>

                  {/* 步骤序号 */}
                  <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-gradient-to-r from-gray-700 to-gray-600 flex items-center justify-center text-sm font-bold text-white border-2 border-gray-800">
                    {step.number}
                  </div>

                  <h3 className="text-xl font-semibold text-white mb-2">{step.title}</h3>
                  <p className="text-gray-400 text-sm">{step.description}</p>

                  {/* 步骤1：浏览器图标 */}
                  {step.number === 1 && (
                    <div className="flex items-center gap-3 mt-4 flex-wrap">
                      {browsers.map((browser) => (
                        <motion.a
                          key={browser.name}
                          href={browser.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          whileHover={{ scale: 1.1, y: -2 }}
                          whileTap={{ scale: 0.95 }}
                          className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors overflow-hidden"
                          title={browser.name}
                        >
                          <img 
                            src={browser.icon} 
                            alt={browser.name}
                            className={`${browser.iconClass} object-contain`}
                          />
                        </motion.a>
                      ))}
                    </div>
                  )}

                  {/* 步骤2：安装按钮 */}
                  {step.number === 2 && (
                    <div className="mt-4 space-y-2">
                      <motion.a
                        href="https://raw.githubusercontent.com/caigg188/LDStatusPro/main/LDStatusPro.user.js"
                        target="_blank"
                        rel="noopener noreferrer"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold hover:shadow-lg hover:shadow-purple-500/25 transition-shadow"
                      >
                        <Download size={18} />
                        <span>GitHub 直装（推荐）</span>
                      </motion.a>
                      <motion.a
                        href="https://greasyfork.org/zh-CN/scripts/558575-ldstatus-pro"
                        target="_blank"
                        rel="noopener noreferrer"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-white/5 text-gray-300 text-sm hover:bg-white/10 transition-colors border border-white/10"
                      >
                        <ExternalLink size={16} />
                        <span>GreasyFork 备用</span>
                      </motion.a>
                    </div>
                  )}

                  {/* 步骤3：站点链接 */}
                  {step.number === 3 && (
                    <div className="flex gap-3 mt-4">
                      <a
                        href="https://linux.do"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-blue-500/10 text-blue-400 text-sm hover:bg-blue-500/20 transition-colors"
                      >
                        <img src="https://linux.do/uploads/default/optimized/4X/6/a/6/6a6affc7b1ce8140279e959d32671304db06d5ab_2_180x180.png" alt="Linux.do" className="w-4 h-4 rounded" />
                        Linux.do
                        <ExternalLink size={14} />
                      </a>
                      <a
                        href="https://idcflare.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-purple-500/10 text-purple-400 text-sm hover:bg-purple-500/20 transition-colors"
                      >
                        <img src="https://idcflare.com/uploads/default/optimized/1X/8746f94a48ddc8140e8c7a52084742f38d3f5085_2_180x180.png" alt="IDCFlare" className="w-4 h-4 rounded" />
                        IDCFlare
                        <ExternalLink size={14} />
                      </a>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* 完成提示 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="mt-12 text-center"
        >
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full glass">
            <CheckCircle2 className="w-5 h-5 text-green-400" />
            <span className="text-gray-300">
              安装完成后，面板会自动显示在页面右下角，点击登录即可使用云同步和排行榜功能
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
