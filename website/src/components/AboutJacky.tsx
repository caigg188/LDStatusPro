import { ArrowUpRight, Code2, GitBranch, Wrench } from 'lucide-react'
import { Logo } from './Logo'
import { links } from '../config/links'

export default function AboutJacky() {
  return (
    <section id="jacky" className="about-section site-width section-space" aria-labelledby="jacky-heading">
      <div className="jacky-portrait">
        <Logo variant="jacky" size={164} decorative />
        <span>Jacky</span>
        <p>
          AI 全栈开发者
          <br />
          独立开发者
        </p>
        <a className="text-link" href={links.author} target="_blank" rel="noopener noreferrer">
          GitHub · caigg188
          <ArrowUpRight size={16} aria-hidden="true" />
        </a>
      </div>
      <div className="jacky-copy">
        <p className="eyebrow">工具背后，是一个持续做产品的人</p>
        <h2 id="jacky-heading">
          用 AI 做产品，
          <br />
          也把产品运营好。
        </h2>
        <p>
          我是 Jacky。把自己和社区需要的工具做成在线产品，是我开始独立开发的方式。LDStatusPro 和 LD
          士多，是我持续开发与维护的两款作品。
        </p>
        <p>我关心一个功能怎样实现，也关心上线后能否稳定使用、交付是否清楚，以及反馈能否变成下一次改进。</p>
        <ul className="maker-principles">
          <li>
            <Code2 size={20} aria-hidden="true" />
            <div>
              <strong>从真实需要出发</strong>
              <span>把问题做小，把工具做好。</span>
            </div>
          </li>
          <li>
            <GitBranch size={20} aria-hidden="true" />
            <div>
              <strong>让实现可以被看见</strong>
              <span>公开代码，欢迎问题与贡献。</span>
            </div>
          </li>
          <li>
            <Wrench size={20} aria-hidden="true" />
            <div>
              <strong>持续维护在线作品</strong>
              <span>关注反馈，也认真处理日常运行。</span>
            </div>
          </li>
        </ul>
        <a className="text-link" href={links.author} target="_blank" rel="noopener noreferrer">
          在 GitHub 认识 Jacky
          <ArrowUpRight size={17} aria-hidden="true" />
        </a>
      </div>
    </section>
  )
}
