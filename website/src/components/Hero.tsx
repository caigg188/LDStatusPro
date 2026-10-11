import { useRef } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { ArrowDown, ArrowRight, ArrowUpRight } from 'lucide-react'
import { Logo } from './Logo'
import { PluginPanel } from './PluginPreview'
import { links, pluginVersion } from '../config/links'

export default function Hero() {
  const scene = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: scene, offset: ['start end', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], [18, -18])
  const panelY = useTransform(scrollYProgress, [0, 1], [12, -18])

  return (
    <section className="hero" aria-labelledby="hero-heading">
      <div className="hero-copy site-width">
        <p className="eyebrow">
          <span className="brand-dot" />
          LDSP · 为社区日常而造
        </p>
        <h1 id="hero-heading">
          认真阅读。
          <br />
          <span>尽兴发现。</span>
        </h1>
        <p className="hero-description">
          LDStatusPro 插件，让阅读与成长看得见。
          <br />
          LD 士多，让社区里的好物有去处。
        </p>
        <div className="hero-actions">
          <a className="action action-plugin" href="#install">
            安装 LDStatusPro <ArrowRight size={17} />
          </a>
          <a className="action action-store-outline" href={links.store} target="_blank" rel="noopener noreferrer">
            打开 LD 士多 <ArrowUpRight size={17} />
          </a>
        </div>
      </div>
      <div ref={scene} className="hero-scene site-width">
        <div className="scene-word" aria-hidden="true">
          READ. DISCOVER.
        </div>
        <motion.div className="hero-store-window" style={reduced ? undefined : { y }}>
          <div className="window-toolbar">
            <span className="window-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span>ldcstore.com</span>
            <Logo variant="store" size={18} decorative />
          </div>
          <img
            src="/screenshots/store-home.webp"
            alt="LD 士多线上物品广场实际截图，包含搜索、分类与社区物品"
            width="2560"
            height="1600"
            fetchPriority="high"
          />
        </motion.div>
        <motion.div className="hero-plugin-window" style={reduced ? undefined : { y: panelY }}>
          <PluginPanel eager />
          <span className="scene-caption">
            <Logo variant="plugin" size={19} decorative />
            LDStatusPro v{pluginVersion} · 原生面板
          </span>
        </motion.div>
        <a className="explore-link" href="#products">
          探索两款产品 <ArrowDown size={16} />
        </a>
      </div>
      <p className="capture-note site-width">插件使用当前版本的原生界面与演示数据；士多为线上公开页面高清截图。</p>
    </section>
  )
}
