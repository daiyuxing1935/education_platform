import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import Navbar from '../components/landing/Navbar'
import HeroSection from '../components/landing/HeroSection'
import FeatureCards from '../components/landing/FeatureCards'
import AdvantagesSection from '../components/landing/AdvantagesSection'
import AppShowcase from '../components/landing/AppShowcase'
import AuthModal from '../components/landing/AuthModal'

export default function LandingPage() {
  const [showAuth, setShowAuth] = useState<'login' | 'register' | null>(null)
  const { isAuthenticated } = useAuthStore()
  const navigate = useNavigate()

  // If already authenticated, redirect to saved target or /home
  useEffect(() => {
    if (isAuthenticated) {
      const redirectTo = sessionStorage.getItem('loginRedirect')
      if (redirectTo) {
        sessionStorage.removeItem('loginRedirect')
        navigate(redirectTo, { replace: true })
      } else {
        navigate('/home', { replace: true })
      }
    }
  }, [isAuthenticated, navigate])

  // Handle hash-based routing (support /#login, /#register)
  useEffect(() => {
    const hash = window.location.hash.replace('#', '')
    if (hash === 'login') setShowAuth('login')
    else if (hash === 'register') setShowAuth('register')
  }, [])

  const openLogin = () => setShowAuth('login')
  const openRegister = () => setShowAuth('register')
  const closeAuth = () => setShowAuth(null)

  if (isAuthenticated) return null

  return (
    <div style={{ minHeight: '100vh', height: '100vh', overflowY: 'auto', overflowX: 'hidden' }}>
      {/* Navbar (fixed, not scrolled with content) */}
      <Navbar onLoginClick={openLogin} onRegisterClick={openRegister} />

      {/* Hero Section */}
      <HeroSection onLoginClick={openLogin} />

      {/* Core Features */}
      <FeatureCards onLoginClick={openLogin} />

      {/* Product Showcase */}
      <AppShowcase onLoginClick={openLogin} />

      {/* Advantages — separate from features, unique content */}
      <AdvantagesSection onLoginClick={openLogin} />

      {/* Footer */}
      <footer style={{
        padding: '40px 32px',
        background: '#1F2937',
        color: 'rgba(255,255,255,0.5)',
        textAlign: 'center',
        fontSize: '0.8125rem',
        lineHeight: 1.8,
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '32px',
            marginBottom: '24px',
            flexWrap: 'wrap',
          }}>
            <a href="#hero" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', transition: 'color 0.2s' }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
            >首页</a>
            <a href="#features" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', transition: 'color 0.2s' }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
            >核心功能</a>
            <a href="#showcase" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', transition: 'color 0.2s' }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
            >产品介绍</a>
            <a href="#advantages" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', transition: 'color 0.2s' }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
            >优势亮点</a>
          </div>
          <div style={{ width: '40px', height: '1px', background: 'rgba(255,255,255,0.1)', margin: '0 auto 20px' }} />
          <p>© {new Date().getFullYear()} Education Agent. All rights reserved.</p>
          <p style={{ marginTop: '4px', fontSize: '0.75rem' }}>
            基于大模型的个性化学习多智能体系统
          </p>
        </div>
      </footer>

      {/* Auth Modal (Login / Register) */}
      {showAuth && (
        <AuthModal
          initialMode={showAuth}
          onClose={closeAuth}
        />
      )}
    </div>
  )
}
