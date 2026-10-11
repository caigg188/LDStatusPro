import { ArrowUpRight, Plus } from 'lucide-react'
import { links } from '../config/links'

const faqs = [
  {
    question: 'LDStatusPro 插件和 LD 士多是什么关系？',
    answer:
      '两者都是 Jacky 持续维护的 LDSP 开源项目。LDStatusPro 是用于 Linux.do 与 IDCFlare 的社区阅读与成长助手；LD 士多是面向 Linux.do 的独立积分兑换平台。插件保留士多快捷入口，士多也可以直接在浏览器打开。'
  },
  {
    question: 'LDStatusPro 是浏览器扩展吗？手机能使用吗？',
    answer:
      '它是用户脚本，需要 Tampermonkey 等用户脚本管理器。电脑端通过浏览器安装管理器；手机端需要使用支持用户脚本的浏览器或管理器。安装步骤与兼容说明请查看功能文档。'
  },
  {
    question: '阅读记录保存在什么地方？',
    answer:
      '插件包含浏览器本地保存和登录后的云同步功能；排行榜、AI 总结等功能也涉及相应服务请求。数据处理与功能说明以公开文档和实现为准，使用前可以查看源码与说明。'
  },
  {
    question: '使用 LD 士多需要先安装插件吗？',
    answer:
      '不需要。直接打开 ldcstore.com 即可浏览物品、求购与小店。准备兑换时使用 Linux.do 账号登录，并按平台指南使用 LDC 社区积分；交付和售后可在对应订单中查看。'
  },
  {
    question: '怎样在 LD 士多发布物品或处理售后？',
    answer:
      '卖家通过士多的独立卖家后台配置收款、发布物品和管理订单。买家可以在订单详情查看交付记录、申请退款并跟进处理。具体条件与规则请阅读士多帮助中心。'
  },
  {
    question: '这两个产品属于社区官方吗？',
    answer:
      '这是由 Jacky 开发与维护的独立社区项目，与 Linux.do、IDCFlare 官方无隶属关系。平台账号、积分与相关第三方服务遵循各自规则。'
  }
]

export default function FAQ() {
  return (
    <section id="faq" className="faq-section site-width section-space" aria-labelledby="faq-heading">
      <div className="faq-intro" data-reveal="">
        <p className="eyebrow">使用前，先了解</p>
        <h2 id="faq-heading">几个常见问题。</h2>
        <p>
          清楚的说明，
          <br />
          也是好工具的一部分。
        </p>
        <a className="text-link" href={links.issues} target="_blank" rel="noopener noreferrer">
          还有问题，告诉我们
          <ArrowUpRight size={16} aria-hidden="true" />
        </a>
      </div>
      <div className="faq-list" data-reveal="" data-delay="0.08">
        {faqs.map((faq) => (
          <details className="faq-item" key={faq.question}>
            <summary>
              <span>{faq.question}</span>
              <Plus size={20} aria-hidden="true" />
            </summary>
            <p>{faq.answer}</p>
          </details>
        ))}
        <div className="faq-guides">
          <a href={links.pluginGuide} target="_blank" rel="noopener noreferrer">
            插件功能说明
            <ArrowUpRight size={15} aria-hidden="true" />
          </a>
          <a href={links.storeGuide} target="_blank" rel="noopener noreferrer">
            士多帮助中心
            <ArrowUpRight size={15} aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  )
}
