import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { Download, Puzzle, RefreshCw, CheckCircle2, ExternalLink } from 'lucide-react'

// 浏览器配置 - 使用官方图标
const browsers = [
  { 
    name: 'Chrome', 
    icon: 'https://www.google.com/chrome/static/images/chrome-logo.svg',
    url: 'https://chromewebstore.google.com/detail/%E7%AF%A1%E6%94%B9%E7%8C%B4/dhdgffkkebhmkfjojejmpbldmpobfkfo',
    iconClass: 'w-5 h-5'
  },
  { 
    name: 'Edge', 
    icon: 'https://img.icons8.com/fluency/96/ms-edge-new.png',
    url: 'https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd',
    iconClass: 'w-5 h-5'
  },
  { 
    name: 'Firefox', 
    icon: 'https://www.mozilla.org/media/protocol/img/logos/firefox/browser/logo.eb1324e44442.svg',
    url: 'https://addons.mozilla.org/zh-CN/firefox/addon/tampermonkey/',
    iconClass: 'w-5 h-5'
  },
  { 
    name: 'Safari', 
    icon: 'https://uxwing.com/wp-content/themes/uxwing/download/brands-and-social-media/safari-icon.png',
    url: 'https://apps.apple.com/us/app/tampermonkey/id1482490089',
    iconClass: 'w-5 h-5'
  },
]

const steps = [
  {
    number: 1,
    title: '安装 Tampermonkey',
    description: '在浏览器扩展商店搜索并安装 Tampermonkey 用户脚本管理器',
    icon: <Puzzle className="w-6 h-6" />,
    color: 'from-[#8ba4b8] to-[#7a9cad]',
  },
  {
    number: 2,
    title: '安装脚本',
    description: '点击下方按钮一键安装 LDStatus Pro 脚本',
    icon: <Download className="w-6 h-6" />,
    color: 'from-[#9d95ab] to-[#c4a6a0]',
  },
  {
    number: 3,
    title: '刷新页面',
    description: '访问 Linux.do 或 IDCFlare，面板自动显示在页面',
    icon: <RefreshCw className="w-6 h-6" />,
    color: 'from-[#8faa9d] to-[#7a9c8a]',
  },
]

export default function Installation() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })

  return (
    <section id="install" className="py-24 relative bg-[#f8f7f5]" ref={ref}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 标题 */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-16 select-none"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            <span className="text-[#3d3d3d]">三步开始，</span>
            <span className="gradient-text">简单上手</span>
          </h2>
          <p className="text-[#6b6b6b] text-lg">
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
                <div className="relative glass glass-hover rounded-2xl p-6 h-full flex flex-col">
                  {/* 步骤编号 */}
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-r ${step.color} flex items-center justify-center mb-4 shadow-lg text-white`}>
                    {step.icon}
                  </div>

                  {/* 步骤序号 */}
                  <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-gradient-to-r from-[#9d95ab] to-[#8ba4b8] flex items-center justify-center text-sm font-bold text-white border-2 border-white/50">
                    {step.number}
                  </div>

                  <h3 className="text-xl font-semibold text-[#3d3d3d] mb-2">{step.title}</h3>
                  <p className="text-[#6b6b6b] text-sm flex-grow">{step.description}</p>

                  {/* 步骤1：浏览器图标 - 2x2 网格布局 */}
                  {step.number === 1 && (
                    <div className="grid grid-cols-2 gap-2 mt-4">
                      {browsers.map((browser) => (
                        <motion.a
                          key={browser.name}
                          href={browser.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          whileHover={{ scale: 1.02, y: -1 }}
                          whileTap={{ scale: 0.98 }}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#f5f4f2] hover:bg-[#efedea] transition-colors overflow-hidden border border-[#e5e3e0]"
                          title={browser.name}
                        >
                          <div className="w-6 h-6 flex items-center justify-center overflow-hidden flex-shrink-0">
                            <img 
                              src={browser.icon} 
                              alt={browser.name}
                              className={`${browser.iconClass} object-contain`}
                            />
                          </div>
                          <span className="text-sm text-[#6b6b6b] font-medium">{browser.name}</span>
                        </motion.a>
                      ))}
                    </div>
                  )}

                  {/* 步骤2：安装按钮 */}
                  {step.number === 2 && (
                    <div className="mt-4 flex flex-col gap-2">
                      <motion.a
                        href="https://raw.githubusercontent.com/caigg188/LDStatusPro/main/LDStatusPro.user.js"
                        target="_blank"
                        rel="noopener noreferrer"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-gradient-to-r from-[#9d95ab] to-[#c4a6a0] text-white font-semibold text-sm hover:shadow-lg hover:shadow-[#9d95ab]/20 transition-shadow"
                      >
                        <Download size={16} />
                        <span>GitHub 直装</span>
                      </motion.a>
                      <motion.a
                        href="https://greasyfork.org/zh-CN/scripts/558575-ldstatus-pro"
                        target="_blank"
                        rel="noopener noreferrer"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="flex items-center justify-center gap-2 w-full py-2 rounded-xl bg-[#efedea] text-[#6b6b6b] text-sm hover:bg-[#e5e3e0] transition-colors border border-[#d4d2cf]"
                      >
                        <ExternalLink size={14} />
                        <span>GreasyFork</span>
                      </motion.a>
                    </div>
                  )}

                  {/* 步骤3：站点链接 */}
                  {step.number === 3 && (
                    <div className="flex flex-col gap-2 mt-4">
                      <a
                        href="https://linux.do"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#8ba4b8]/10 text-[#7a9cad] text-sm hover:bg-[#8ba4b8]/20 transition-colors"
                      >
                        <img src="https://linux.do/uploads/default/optimized/4X/6/a/6/6a6affc7b1ce8140279e959d32671304db06d5ab_2_180x180.png" alt="Linux.do" className="w-4 h-4 rounded" />
                        Linux.do
                        <ExternalLink size={14} />
                      </a>
                      <a
                        href="https://idcflare.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 py-2 rounded-xl bg-[#9d95ab]/10 text-[#9d95ab] text-sm hover:bg-[#9d95ab]/20 transition-colors"
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
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mt-12 text-center"
        >
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full glass">
            <CheckCircle2 className="w-5 h-5 text-[#8faa9d]" />
            <span className="text-[#6b6b6b]">
              安装完成后，面板会自动显示在页面，点击登录即可使用云同步和排行榜功能
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
