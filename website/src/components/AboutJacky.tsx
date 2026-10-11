import { ArrowUpRight } from 'lucide-react'
import { links } from '../config/links'

export default function AboutJacky() {
  return (
    <div id="jacky" className="maintainer-byline">
      <p>
        <span>项目维护者</span>
        <strong>Jacky</strong>
        <span>AI 全栈开发 · 独立开发者</span>
      </p>
      <a className="text-link" href={links.author} target="_blank" rel="noopener noreferrer">
        认识 Jacky · GitHub <ArrowUpRight size={16} />
      </a>
    </div>
  )
}
