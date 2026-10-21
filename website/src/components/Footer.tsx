import { Logo } from './Logo'
import { links } from '../config/links'

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-width">
        <div className="footer-top">
          <div>
            <a className="brand-name" href="#top">
              <Logo size={42} decorative inverted />
              <span>
                LDSP<span className="brand-byline">社区开源工具</span>
              </span>
            </a>
            <p>把社区里的好用工具，持续做好。</p>
          </div>
          <nav className="footer-nav" aria-label="页脚导航">
            <a href="#plugin">LDStatusPro 插件</a>
            <a href={links.store} target="_blank" rel="noopener noreferrer">
              LD 士多
            </a>
            <a href={links.author} target="_blank" rel="noopener noreferrer">
              Jacky 的 GitHub
            </a>
            <a href={links.issues} target="_blank" rel="noopener noreferrer">
              反馈问题
            </a>
            <a href="/report/2025">2025 阅读年报</a>
          </nav>
        </div>
        <div className="footer-bottom">
          <p>
            © {new Date().getFullYear()} Jacky · 项目源码 MIT · <a href="/licenses/react-bits.txt">第三方动效许可</a>
          </p>
          <p>独立社区项目，与 Linux.do、IDCFlare 官方无隶属关系。</p>
          <a href="/brand/identity-sheet.svg" target="_blank" rel="noopener noreferrer">
            品牌标志
          </a>
        </div>
      </div>
    </footer>
  )
}
