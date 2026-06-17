import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

interface NavbarProps {
  onLoginClick: () => void
  onRegisterClick: () => void
}

function LogoSvg() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c0 1.1 2.7 3 6 3s6-1.9 6-3v-5" />
    </svg>
  )
}

const navItems = [
  { id: 'features', label: '核心功能' },
  { id: 'showcase', label: '产品介绍' },
  { id: 'advantages', label: '优势亮点' },
] as const

export default function Navbar({ onLoginClick, onRegisterClick }: NavbarProps) {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  const [activeSection, setActiveSection] = useState('')
  const observerRef = useRef<IntersectionObserver | null>(null)

  // Scroll handler for navbar background
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // IntersectionObserver to track which section is in view
  useEffect(() => {
    const sectionIds = ['hero', 'features', 'showcase', 'advantages']

    observerRef.current = new IntersectionObserver(
      (entries) => {
        // Collect visible sections with their intersection ratios
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)

        if (visible.length > 0) {
          setActiveSection(visible[0].target.id)
        }
      },
      {
        threshold: [0.2, 0.4, 0.6],
        rootMargin: '-80px 0px -20% 0px',
      }
    )

    sectionIds.forEach((id) => {
      const el = document.getElementById(id)
      if (el) observerRef.current?.observe(el)
    })

    return () => observerRef.current?.disconnect()
  }, [])

  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <nav className={`landing-navbar${scrolled ? ' scrolled' : ''}`}>
      {/* Left: Logo + Name */}
      <button
        onClick={() => navigate('/')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          border: 'none',
          background: 'none',
          color: scrolled ? 'var(--app-indigo)' : '#fff',
          fontFamily: 'var(--font-heading)',
          fontSize: '1.3rem',
          fontWeight: 700,
          letterSpacing: '-0.02em',
          transition: 'color 0.3s ease',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        <span style={{ color: scrolled ? 'var(--app-indigo)' : '#A78BFA' }}>
          <LogoSvg />
        </span>
        Education Agent
      </button>

      {/* Center: Nav Links */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`landing-nav-link${activeSection === item.id ? ' active' : ''}`}
            onClick={() => scrollTo(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Right: Auth Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          onClick={onLoginClick}
          style={{
            padding: '8px 20px',
            borderRadius: '10px',
            border: scrolled ? '1.5px solid var(--gray-200)' : '1.5px solid rgba(255,255,255,0.3)',
            background: 'transparent',
            color: scrolled ? 'var(--gray-700)' : 'rgba(255,255,255,0.85)',
            fontSize: '0.875rem',
            fontWeight: 500,
            fontFamily: 'var(--font-body)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = scrolled ? 'var(--gray-100)' : 'rgba(255,255,255,0.1)'
            e.currentTarget.style.borderColor = scrolled ? 'var(--gray-300)' : 'rgba(255,255,255,0.5)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.borderColor = scrolled ? 'var(--gray-200)' : 'rgba(255,255,255,0.3)'
          }}
        >
          登录
        </button>
        <button
          onClick={onRegisterClick}
          style={{
            padding: '8px 20px',
            borderRadius: '10px',
            border: 'none',
            background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
            color: '#fff',
            fontSize: '0.875rem',
            fontWeight: 500,
            fontFamily: 'var(--font-body)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(99,102,241,0.4)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = 'none'
          }}
        >
          注册
        </button>
      </div>
    </nav>
  )
}
