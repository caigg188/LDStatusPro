import { useState, type ReactNode } from 'react'
import { Moon, Sun } from 'lucide-react'
import { pluginVersion } from '../config/links'
import SegmentedControl from './SegmentedControl'

type PanelView = 'reqs' | 'trends'
const themes = [
  { value: 'light', label: '浅色', icon: <Sun size={15} /> },
  { value: 'dark', label: '深色', icon: <Moon size={15} /> }
] satisfies { value: 'light' | 'dark'; label: string; icon: ReactNode }[]
const views = [
  { value: 'reqs', label: '升级要求' },
  { value: 'trends', label: '阅读趋势' }
] satisfies { value: PanelView; label: string }[]

export function PluginPanel({
  theme = 'light',
  view = 'reqs',
  eager = false,
  switchable = false
}: {
  theme?: 'light' | 'dark'
  view?: PanelView
  eager?: boolean
  switchable?: boolean
}) {
  const panels = switchable
    ? ['light', 'dark'].flatMap((panelTheme) => ['reqs', 'trends'].map((panelView) => ({ theme: panelTheme, view: panelView })))
    : [{ theme, view }]
  return (
    <div className={`panel-canvas${switchable ? ' panel-switchable' : ''}`}>
      {panels.map((panel) => (
        <img
          key={`${panel.theme}-${panel.view}`}
          className={`plugin-panel${panel.theme === theme && panel.view === view ? ' selected' : ''}`}
          width="760"
          height={panel.view === 'reqs' ? 1186 : 1211}
          src={`/product-preview/plugin-${panel.theme}-${panel.view}.webp`}
          alt={`LDStatusPro v${pluginVersion} 原生${panel.theme === 'light' ? '浅色' : '深色'}${panel.view === 'reqs' ? '升级要求' : '阅读趋势'}面板，模拟登录状态与演示数据`}
          aria-hidden={panel.theme !== theme || panel.view !== view}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={eager ? 'high' : 'auto'}
        />
      ))}
    </div>
  )
}

export default function PluginPreview() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [view, setView] = useState<PanelView>('reqs')
  return (
    <figure className={`plugin-showcase theme-${theme}`}>
      <SegmentedControl className="theme-chooser" label="查看插件实际主题" options={themes} value={theme} onChange={setTheme} />
      <SegmentedControl className="panel-view-chooser" label="查看插件功能演示" options={views} value={view} onChange={setView} />
      <div className="plugin-pair">
        <div className="plugin-secondary" aria-hidden="true">
          <div className="panel-drift">
            <PluginPanel theme={theme === 'light' ? 'dark' : 'light'} view={view} switchable />
          </div>
        </div>
        <div className="plugin-primary">
          <div className="panel-drift">
            <PluginPanel theme={theme} view={view} switchable />
          </div>
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
