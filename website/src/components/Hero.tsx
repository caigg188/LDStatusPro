import { ArrowDown, ArrowRight, ArrowUpRight } from 'lucide-react'
import { Logo } from './Logo'
import { links, pluginVersion } from '../config/links'

export default function Hero() {
  return (
    <section className="hero site-width" aria-labelledby="hero-heading">
      <div className="hero-copy">
        <p className="eyebrow">
          <span className="brand-dot" />
          开源社区工具 · 由 Jacky 持续维护
        </p>
        <h1 id="hero-heading">
          社区里的日常，
          <br />
          <span>有好工具相伴。</span>
        </h1>
        <p className="hero-description">
          用 LDStatusPro 看见阅读与成长，
          <br className="desktop-break" />在 LD 士多发现好物、兑换并跟进交付。
        </p>
        <div className="hero-actions">
          <a className="action action-plugin" href="#install">
            安装 LDStatusPro
            <ArrowRight size={18} aria-hidden="true" />
          </a>
          <a className="action action-store-outline" href={links.store} target="_blank" rel="noopener noreferrer">
            打开 LD 士多
            <ArrowUpRight size={18} aria-hidden="true" />
          </a>
        </div>
        <a className="explore-link" href="#products">
          找到适合你的那款工具
          <ArrowDown size={16} aria-hidden="true" />
        </a>
      </div>
      <div className="hero-portals">
        <div className="hero-orbit" aria-hidden="true">
          <Logo size={360} decorative />
        </div>
        <a className="portal portal-plugin" href="#plugin">
          <Logo variant="plugin" size={70} decorative />
          <div className="portal-copy">
            <span className="portal-category">阅读与成长</span>
            <strong>LDStatusPro</strong>
            <span>让社区里的每一次阅读，看得见。</span>
          </div>
          <ArrowUpRight className="portal-arrow" size={20} aria-hidden="true" />
          <span className="version-tag">v{pluginVersion}</span>
        </a>
        <a className="portal portal-store" href="#store">
          <Logo variant="store" size={70} decorative />
          <div className="portal-copy">
            <span className="portal-category">发现与兑换</span>
            <strong>LD 士多</strong>
            <span>好物有去处，交付有记录。</span>
          </div>
          <ArrowUpRight className="portal-arrow" size={20} aria-hidden="true" />
          <span className="portal-note">使用 LDC 社区积分</span>
        </a>
        <p className="portals-caption">两个独立产品，同一个开源作品系列。</p>
      </div>
    </section>
  )
}
