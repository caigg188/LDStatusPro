import { useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { pluginVersion } from '../config/links'

type PanelView = 'reqs' | 'trends'

export function PluginPanel({
  theme = 'light',
  view = 'reqs',
  eager = false
}: {
  theme?: 'light' | 'dark'
  view?: PanelView
  eager?: boolean
}) {
  return (
    <div className="panel-canvas">
      <img
        className="plugin-panel"
        width="760"
        height={view === 'reqs' ? 1186 : 1211}
        src={`/product-preview/plugin-${theme}-${view}.webp`}
        alt={`LDStatusPro v${pluginVersion} 原生${theme === 'light' ? '浅色' : '深色'}${view === 'reqs' ? '升级要求' : '阅读趋势'}面板，模拟登录状态与演示数据`}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={eager ? 'high' : 'auto'}
      />
    </div>
  )
}

export default function PluginPreview() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [view, setView] = useState<PanelView>('reqs')
  return (
    <figure className={`plugin-showcase theme-${theme}`}>
      <div className="theme-chooser" role="group" aria-label="查看插件实际主题">
        <button type="button" aria-pressed={theme === 'light'} onClick={() => setTheme('light')}>
          <Sun size={15} />
          浅色
        </button>
        <button type="button" aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>
          <Moon size={15} />
          深色
        </button>
      </div>
      <div className="panel-view-chooser" role="group" aria-label="查看插件功能演示">
        <button type="button" aria-pressed={view === 'reqs'} onClick={() => setView('reqs')}>
          升级要求
        </button>
        <button type="button" aria-pressed={view === 'trends'} onClick={() => setView('trends')}>
          阅读趋势
        </button>
      </div>
      <div className="plugin-pair">
        <div className="plugin-secondary" aria-hidden="true">
          <PluginPanel theme={theme === 'light' ? 'dark' : 'light'} view={view} />
        </div>
        <div className="plugin-primary">
          <PluginPanel theme={theme} view={view} />
        </div>
      </div>
      <figcaption>
        v{pluginVersion} 原生面板 · 演示数据
        <br />
        真实界面 · 宽版布局 · 仅显示未完成要求。
      </figcaption>
    </figure>
  )
}
