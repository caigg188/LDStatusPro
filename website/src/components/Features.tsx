import { useState } from 'react'
import { BookOpen, Cloud, Compass, PackageCheck, Sparkles, TrendingUp } from 'lucide-react'
import { Logo } from './Logo'
import PluginPreview from './PluginPreview'
import Reveal from './Reveal'
import SegmentedControl from './SegmentedControl'
import { links } from '../config/links'

const storeViews = [
  { name: '物品广场', image: 'store-home', description: '浏览社区物品与服务，用分类、搜索和筛选找到需要的好物。' },
  { name: '小店集市', image: 'store-shops', description: '逛一逛社区成员的小店，发现持续经营的物品与服务。' }
]
const galleryOptions = storeViews.map((item, index) => ({ value: String(index), label: item.name }))

function StoreGallery() {
  const [view, setView] = useState(0)
  return (
    <div className="store-gallery">
      <SegmentedControl className="gallery-controls" label="选择士多实际截图" options={galleryOptions} value={String(view)} onChange={(value) => setView(Number(value))} />
      <figure className="store-figure">
        <div className="window-toolbar">
          <span className="window-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>ldcstore.com</span>
          <span>高清桌面截图</span>
        </div>
        <div className="gallery-images">
          {storeViews.map((item, index) => (
            <img
              key={item.image}
              src={`/screenshots/${item.image}.webp`}
              alt={`LD 士多线上${item.name}真实页面`}
              width="2560"
              height="1600"
              loading="lazy"
              decoding="async"
              className={view === index ? 'selected' : ''}
              aria-hidden={view !== index}
            />
          ))}
        </div>
        <figcaption aria-live="polite">{storeViews[view].description}</figcaption>
      </figure>
      <p className="capture-note">2026-10-11 公开页面截图 · 物品、价格及统计以线上为准</p>
    </div>
  )
}

export default function Features() {
  return (
    <section id="products" className="products-section" aria-labelledby="products-heading">
      <span id="features" className="anchor-alias" />
      <Reveal className="product-intro site-width">
        <p className="eyebrow">同一个项目，两种陪伴</p>
        <h2 id="products-heading">
          把社区里的日常，
          <br />
          <span>变得更好用。</span>
        </h2>
        <div className="product-index">
          <a href="#plugin">
            <Logo variant="plugin" size={38} decorative />
            <span>
              01 <strong>LDStatusPro 插件</strong>
            </span>
          </a>
          <a href="#store">
            <Logo variant="store" size={38} decorative />
            <span>
              02 <strong>LD 士多</strong>
            </span>
          </a>
        </div>
      </Reveal>
      <article className="product-detail product-plugin site-width" id="plugin">
        <Reveal className="product-copy">
          <div className="product-type">
            <Logo variant="plugin" size={34} decorative />
            <span>01 / LDStatusPro 插件</span>
          </div>
          <h3>
            阅读的积累，
            <br />
            <span>一眼就清楚。</span>
          </h3>
          <p className="product-description">
            阅读时间、信任级别、历史趋势，都在熟悉的社区页面里。一个轻巧的面板，让每一天的成长更清楚。
          </p>
          <ul className="product-benefits">
            <li>
              <TrendingUp size={20} />
              <div>
                <strong>信任进度与历史趋势</strong>
                <span>了解升级要求，查看社区成长的变化。</span>
              </div>
            </li>
            <li>
              <Cloud size={20} />
              <div>
                <strong>阅读记录与云同步</strong>
                <span>跨设备同步记录，也可参与阅读排行榜。</span>
              </div>
            </li>
            <li>
              <Sparkles size={20} />
              <div>
                <strong>AI 话题总结</strong>
                <span>辅助梳理帖子内容，支持继续追问。</span>
              </div>
            </li>
          </ul>
          <div className="product-links">
            <a className="action action-plugin" href="#install">
              安装与使用
            </a>
            <a className="text-link" href={links.pluginGuide} target="_blank" rel="noopener noreferrer">
              功能说明
            </a>
          </div>
          <p className="product-note" id="levels">
            <BookOpen size={15} />
            适用于 Linux.do 与 IDCFlare · 开源用户脚本
          </p>
        </Reveal>
        <div className="plugin-display">
          <PluginPreview />
        </div>
      </article>
      <article className="product-store" id="store">
        <Reveal className="store-copy site-width">
          <div className="product-type">
            <Logo variant="store" size={34} decorative />
            <span>02 / LD 士多</span>
          </div>
          <h3>
            发现社区好物。
            <br />
            <span>也遇见有趣的人。</span>
          </h3>
          <p className="product-description">
            物品广场、求购广场、小店集市。用 LDC 社区积分连接需要与提供，让物品、服务和心意在社区里流动。
          </p>
          <div className="product-links">
            <a className="action action-store" href={links.store} target="_blank" rel="noopener noreferrer">
              去士多逛逛
            </a>
            <a className="text-link" href={links.storeGuide} target="_blank" rel="noopener noreferrer">
              使用指南
            </a>
          </div>
        </Reveal>
        <div className="site-width">
          <StoreGallery />
        </div>
        <div className="store-benefits site-width">
          <Reveal>
            <Compass size={23} />
            <h4>从发现开始</h4>
            <p>浏览物品、发布求购、探索小店。</p>
          </Reveal>
          <Reveal delay={0.08}>
            <PackageCheck size={23} />
            <h4>让交付清楚</h4>
            <p>订单、交付与售后记录，随时可查。</p>
          </Reveal>
          <Reveal delay={0.16}>
            <TrendingUp size={23} />
            <h4>认真经营小店</h4>
            <p>独立卖家后台，管理物品与经营。</p>
          </Reveal>
        </div>
      </article>
    </section>
  )
}
