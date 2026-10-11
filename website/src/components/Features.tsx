import { ArrowRight, ArrowUpRight, BookOpen, Cloud, Compass, PackageCheck, Sparkles, TrendingUp } from 'lucide-react'
import { Logo } from './Logo'
import { links } from '../config/links'

function ReadingPreview() {
  return (
    <div className="product-visual reading-visual" aria-label="插件阅读统计功能示意，非真实账户数据">
      <div className="visual-topline">
        <Logo variant="plugin" size={32} decorative />
        <span>LDStatusPro</span>
        <span className="visual-label">功能示意</span>
      </div>
      <div className="reading-summary">
        <span>把时间，留给好内容。</span>
        <strong>
          阅读的积累<span>都看得见。</span>
        </strong>
      </div>
      <div className="reading-stat">
        <div>
          <span>今日阅读</span>
          <strong>
            42<small>分钟</small>
          </strong>
        </div>
        <div className="reading-ring">
          <span>
            68<small>%</small>
          </span>
        </div>
        <div>
          <span>信任级别</span>
          <strong>Lv.2</strong>
        </div>
      </div>
      <div className="reading-calendar" aria-hidden="true">
        {Array.from({ length: 56 }, (_, i) => (
          <span key={i} className={`reading-cell tone-${(i * 7 + Math.floor(i / 8)) % 5}`} />
        ))}
      </div>
      <p className="visual-footnote">示例数据 · 阅读统计、信任进度与历史趋势</p>
    </div>
  )
}

function StorePreview() {
  return (
    <div className="product-visual store-visual" aria-label="LD 士多发现、兑换与交付流程示意">
      <div className="visual-topline">
        <Logo variant="store" size={32} decorative />
        <span>LD 士多</span>
        <span className="visual-label">使用流程</span>
      </div>
      <div className="store-visual-title">
        <Logo variant="store" size={114} decorative />
        <strong>
          社区好物，
          <br />
          认真交付。
        </strong>
      </div>
      <div className="store-flow">
        <div>
          <Compass size={23} aria-hidden="true" />
          <span>发现物品</span>
          <small>物品、求购、小店</small>
        </div>
        <ArrowRight size={17} aria-hidden="true" />
        <div>
          <Logo variant="store" size={25} decorative />
          <span>LDC 兑换</span>
          <small>确认订单与支付</small>
        </div>
        <ArrowRight size={17} aria-hidden="true" />
        <div>
          <PackageCheck size={23} aria-hidden="true" />
          <span>跟进交付</span>
          <small>查看记录与售后</small>
        </div>
      </div>
      <p className="visual-footnote">面向 Linux.do 社区成员 · 使用社区积分</p>
    </div>
  )
}

export default function Features() {
  return (
    <section className="products-section site-width section-space" id="products" aria-labelledby="products-heading">
      <span id="features" className="anchor-alias" />
      <div className="section-heading">
        <div>
          <p className="eyebrow">两款产品，各有所长</p>
          <h2 id="products-heading">
            从阅读的积累，
            <br />
            到好物的相遇。
          </h2>
        </div>
        <p>
          一个陪伴你的社区阅读，
          <br />
          一个连接社区里的物品与服务。
        </p>
      </div>
      <article className="product-detail product-plugin" id="plugin">
        <div className="product-copy">
          <p className="product-type">
            LDStatusPro 插件<span>开源用户脚本</span>
          </p>
          <h3>
            看见你的
            <br />
            社区成长。
          </h3>
          <p className="product-description">
            为 Linux.do 与 IDCFlare 提供阅读统计、信任级别进度和历史趋势，把日常的积累整理得更清楚。
          </p>
          <ul className="product-benefits">
            <li>
              <TrendingUp size={18} aria-hidden="true" />
              查看信任进度与成长趋势
            </li>
            <li>
              <Cloud size={18} aria-hidden="true" />
              跨设备云同步与阅读排行榜
            </li>
            <li>
              <Sparkles size={18} aria-hidden="true" />
              AI 话题总结与追问辅助
            </li>
          </ul>
          <div className="product-links">
            <a className="action action-plugin" href="#install">
              安装与使用
              <ArrowRight size={17} aria-hidden="true" />
            </a>
            <a className="text-link" href={links.pluginGuide} target="_blank" rel="noopener noreferrer">
              查看功能说明
              <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          </div>
          <p className="product-note" id="levels">
            <BookOpen size={15} aria-hidden="true" />
            通过用户脚本管理器使用，支持两款社区站点。
          </p>
        </div>
        <ReadingPreview />
      </article>
      <article className="product-detail product-store" id="store">
        <StorePreview />
        <div className="product-copy">
          <p className="product-type">
            LD 士多<span>社区积分兑换平台</span>
          </p>
          <h3>
            好物有去处，
            <br />
            交付有记录。
          </h3>
          <p className="product-description">
            发现社区成员发布的物品与服务，使用 LDC 兑换。从物品广场、求购到小店，连接需要与提供。
          </p>
          <ul className="product-benefits">
            <li>
              <Compass size={18} aria-hidden="true" />
              发现物品、发布求购与浏览小店
            </li>
            <li>
              <PackageCheck size={18} aria-hidden="true" />
              查看订单、交付记录与退款进度
            </li>
            <li>
              <TrendingUp size={18} aria-hidden="true" />
              独立卖家后台与经营工具
            </li>
          </ul>
          <div className="product-links">
            <a className="action action-store" href={links.store} target="_blank" rel="noopener noreferrer">
              打开 LD 士多
              <ArrowUpRight size={17} aria-hidden="true" />
            </a>
            <a className="text-link" href={links.storeGuide} target="_blank" rel="noopener noreferrer">
              阅读使用指南
              <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          </div>
          <p className="product-note">士多可直接在浏览器使用，无需安装插件。</p>
        </div>
      </article>
    </section>
  )
}
