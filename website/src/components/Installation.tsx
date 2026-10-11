import { ArrowRight, ArrowUpRight, Download, Globe, LogIn, Puzzle, RefreshCw } from 'lucide-react'
import { Logo } from './Logo'
import { links, pluginVersion } from '../config/links'

export default function Installation() {
  return (
    <section id="install" className="start-section section-space" aria-labelledby="start-heading">
      <div className="site-width">
        <div className="section-heading" data-reveal="">
          <div>
            <p className="eyebrow">从这里开始</p>
            <h2 id="start-heading">
              选一款工具，
              <br />
              开始你的社区日常。
            </h2>
          </div>
          <p>
            插件先安装，士多直接打开。
            <br />
            需要帮助时，指南与反馈入口都在这里。
          </p>
        </div>
        <div className="start-grid">
          <article className="start-panel start-plugin" data-reveal="">
            <div className="start-title">
              <Logo variant="plugin" size={42} decorative />
              <h3>安装 LDStatusPro</h3>
              <span className="version-tag">v{pluginVersion}</span>
            </div>
            <ol className="getting-started">
              <li>
                <Puzzle size={20} aria-hidden="true" />
                <div>
                  <strong>安装用户脚本管理器</strong>
                  <p>在浏览器安装 Tampermonkey 等管理器；手机浏览器需要支持用户脚本。</p>
                  <a className="text-link" href={links.scriptManagers} target="_blank" rel="noopener noreferrer">
                    查看管理器安装说明
                    <ArrowUpRight size={14} aria-hidden="true" />
                  </a>
                </div>
              </li>
              <li>
                <Download size={20} aria-hidden="true" />
                <div>
                  <strong>安装 LDStatusPro 脚本</strong>
                  <p>通过 GitHub 直装，或使用 Greasy Fork 安装页。</p>
                </div>
              </li>
              <li>
                <RefreshCw size={20} aria-hidden="true" />
                <div>
                  <strong>打开社区，刷新页面</strong>
                  <p>访问 Linux.do 或 IDCFlare，查看页面上的插件面板。</p>
                </div>
              </li>
            </ol>
            <div className="start-actions">
              <a className="action action-plugin" href={links.install} target="_blank" rel="noopener noreferrer">
                安装脚本
                <ArrowUpRight size={17} aria-hidden="true" />
              </a>
              <a className="text-link" href={links.greasyFork} target="_blank" rel="noopener noreferrer">
                Greasy Fork 安装
                <ArrowUpRight size={15} aria-hidden="true" />
              </a>
            </div>
          </article>
          <article className="start-panel start-store" data-reveal="" data-delay="0.08">
            <div className="start-title">
              <Logo variant="store" size={42} decorative />
              <h3>打开 LD 士多</h3>
              <span className="start-browser-label">浏览器即用</span>
            </div>
            <ol className="getting-started">
              <li>
                <Globe size={20} aria-hidden="true" />
                <div>
                  <strong>先逛一逛社区好物</strong>
                  <p>浏览物品广场、求购与小店，找到感兴趣的物品或服务。</p>
                </div>
              </li>
              <li>
                <LogIn size={20} aria-hidden="true" />
                <div>
                  <strong>使用社区账号登录</strong>
                  <p>准备兑换时，通过 Linux.do 账号登录，阅读物品详情与平台规则。</p>
                </div>
              </li>
              <li>
                <RefreshCw size={20} aria-hidden="true" />
                <div>
                  <strong>确认兑换，跟进交付</strong>
                  <p>使用 LDC 社区积分，在订单中查看交付与售后记录。</p>
                </div>
              </li>
            </ol>
            <div className="start-actions">
              <a className="action action-store" href={links.store} target="_blank" rel="noopener noreferrer">
                打开士多
                <ArrowUpRight size={17} aria-hidden="true" />
              </a>
              <a className="text-link" href={links.sellerGuide} target="_blank" rel="noopener noreferrer">
                我是卖家
                <ArrowRight size={15} aria-hidden="true" />
              </a>
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}
