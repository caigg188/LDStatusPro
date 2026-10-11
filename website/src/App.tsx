import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import Header from './components/Header'
import Hero from './components/Hero'
import Features from './components/Features'
import Installation from './components/Installation'
import Maintenance from './components/Maintenance'
import FAQ from './components/FAQ'
import Footer from './components/Footer'
import { useHomepageMotion } from './hooks/useHomepageMotion'

const AnnualReport2025 = lazy(() => import('./pages/AnnualReport2025'))

// 简单路由逻辑
function useSimpleRouter() {
  const [path, setPath] = useState(window.location.pathname)

  useEffect(() => {
    const handlePopState = () => setPath(window.location.pathname)
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  return path
}

// 主页组件
function HomePage() {
  const scope = useRef<HTMLDivElement>(null)
  useHomepageMotion(scope)
  return (
    <div className="brand-site" id="top" ref={scope}>
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>
      <Header />
      <main id="main-content">
        <Hero />
        <Features />
        <Installation />
        <Maintenance />
        <FAQ />
      </main>
      <Footer />
    </div>
  )
}

function App() {
  const path = useSimpleRouter()

  // 年度报告路由 (支持 /report/2025 和 /report/2025/callback)
  if (path.startsWith('/report/2025')) {
    return (
      <Suspense fallback={<p className="report-loading" role="status">正在加载年度报告…</p>}>
        <AnnualReport2025 />
      </Suspense>
    )
  }

  // 默认主页
  return <HomePage />
}

export default App
