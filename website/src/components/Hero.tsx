import { ArrowDown } from 'lucide-react'
import { Logo } from './Logo'
import { PluginPanel } from './PluginPreview'
import { links, pluginVersion } from '../config/links'
import FluidBackground from './FluidBackground'

export default function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-heading">
      <FluidBackground />
      <div className="hero-copy site-width">
        <p className="eyebrow">
          <span className="brand-dot" />
          LDSP · 为社区日常而生
        </p>
        <h1 id="hero-heading">
          <span className="hero-line"><span data-hero-line="">认真阅读。</span></span>
          <span className="hero-line"><span data-hero-line="" className="hero-line-accent">尽兴发现。</span></span>
        </h1>
        <p className="hero-description">
          LDStatusPro 插件，让阅读与成长看得见。
          <br />
          LD 士多，让社区里的好物有去处。
        </p>
        <div className="hero-actions">
          <a className="action action-plugin" href="#install">
            安装 LDStatusPro
          </a>
          <a className="action action-store-outline" href={links.store} target="_blank" rel="noopener noreferrer">
            打开 LD 士多
          </a>
        </div>
      </div>
      <div className="hero-scene site-width">
        <div className="scene-word" aria-hidden="true">
          READ. DISCOVER.
        </div>
        <div className="hero-store-window">
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
        </div>
        <div className="hero-plugin-window">
          <PluginPanel eager />
          <span className="scene-caption">
            <Logo variant="plugin" size={19} decorative />
            LDStatusPro v{pluginVersion} · 原生面板
          </span>
        </div>
        <a className="explore-link" href="#products">
          探索两款产品 <ArrowDown size={16} aria-hidden="true" />
        </a>
      </div>
      <p className="capture-note site-width">插件使用当前版本的原生界面与演示数据；士多为线上公开页面高清截图。</p>
    </section>
  )
}
