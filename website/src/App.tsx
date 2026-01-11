import { useEffect, useState } from 'react'
import Header from './components/Header'
import Hero from './components/Hero'
import Features from './components/Features'
import Levels from './components/Levels'
import Installation from './components/Installation'
import UpdateLog from './components/UpdateLog'
import FAQ from './components/FAQ'
import Footer from './components/Footer'
import AnnualReport2025 from './pages/AnnualReport2025'

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
  return (
    <div className="min-h-screen bg-[#0c0c14]">
      <Header />
      <main>
        <Hero />
        <Features />
        <Levels />
        <Installation />
        <UpdateLog />
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
    return <AnnualReport2025 />
  }
  
  // 默认主页
  return <HomePage />
}

export default App
