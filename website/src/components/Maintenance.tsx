import { ArrowUpRight, GitPullRequest, MessageSquare, NotebookPen } from 'lucide-react'
import { links } from '../config/links'

export default function Maintenance() {
  return (
    <section id="updates" className="maintenance-section site-width" aria-labelledby="maintenance-heading">
      <div className="maintenance-heading">
        <p className="eyebrow">开源与持续维护</p>
        <h2 id="maintenance-heading">好工具，一起慢慢做好。</h2>
        <p>代码、维护记录与反馈入口，始终可以找到。</p>
      </div>
      <div className="maintenance-links">
        <a href={links.github} target="_blank" rel="noopener noreferrer">
          <GitPullRequest size={23} aria-hidden="true" />
          <div>
            <strong>查看源码</strong>
            <span>用户脚本、官网与士多前端</span>
          </div>
          <ArrowUpRight size={18} aria-hidden="true" />
        </a>
        <a href={links.changes} target="_blank" rel="noopener noreferrer">
          <NotebookPen size={23} aria-hidden="true" />
          <div>
            <strong>查看近期改进</strong>
            <span>以仓库提交记录了解实际变化</span>
          </div>
          <ArrowUpRight size={18} aria-hidden="true" />
        </a>
        <a href={links.issues} target="_blank" rel="noopener noreferrer">
          <MessageSquare size={23} aria-hidden="true" />
          <div>
            <strong>提出问题与建议</strong>
            <span>说明使用场景，帮助定位问题</span>
          </div>
          <ArrowUpRight size={18} aria-hidden="true" />
        </a>
      </div>
    </section>
  )
}
