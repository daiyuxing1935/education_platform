import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'

interface HeroSectionProps {
  onLoginClick: () => void
}

/* ── Floating geometric decor cubes (unchanged) ── */
function FloatingCubes() {
  const cubes = [
    { size: 60, color: 'rgba(167,139,250,0.15)', anim: 'floatCube1', dur: '12s', top: '15%', left: '8%', delay: '0s', radius: '16px' },
    { size: 40, color: 'rgba(129,140,248,0.18)', anim: 'floatCube2', dur: '14s', top: '65%', left: '5%', delay: '1s', radius: '12px' },
    { size: 50, color: 'rgba(196,181,253,0.12)', anim: 'floatCube3', dur: '16s', top: '20%', right: '10%', delay: '0.5s', radius: '14px' },
    { size: 35, color: 'rgba(165,180,252,0.14)', anim: 'floatCube4', dur: '11s', bottom: '25%', right: '15%', delay: '2s', radius: '10px' },
    { size: 45, color: 'rgba(199,210,254,0.10)', anim: 'floatCube1', dur: '15s', top: '50%', left: '50%', delay: '1.5s', radius: '12px' },
    { size: 30, color: 'rgba(99,102,241,0.12)', anim: 'floatCube2', dur: '10s', top: '10%', left: '40%', delay: '3s', radius: '8px' },
  ]

  return (
    <>
      {cubes.map((c, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: c.size,
            height: c.size,
            borderRadius: c.radius,
            background: c.color,
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(1px)',
            top: c.top,
            left: c.left,
            right: (c as any).right,
            bottom: (c as any).bottom,
            animation: `${c.anim} ${c.dur} ease-in-out infinite`,
            animationDelay: c.delay,
            zIndex: 1,
            pointerEvents: 'none',
          }}
        />
      ))}
    </>
  )
}

export default function HeroSection({ onLoginClick }: HeroSectionProps) {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()

  const handleStart = () => {
    if (isAuthenticated) navigate('/home')
    else onLoginClick()
  }

  return (
    <section
      id="hero"
      style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        background: 'linear-gradient(-45deg, #1e1b4b, #312e81, #3730a3, #4f46e5, #6366f1, #4338ca)',
        backgroundSize: '400% 400%',
        animation: 'bgFlow 6s ease infinite',
      }}
    >
      {/* Subtle overlay (unchanged) */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse at 20% 50%, rgba(167,139,250,0.12) 0%, transparent 60%), radial-gradient(ellipse at 80% 50%, rgba(129,140,248,0.08) 0%, transparent 60%)',
        zIndex: 1,
        pointerEvents: 'none',
      }} />

      {/* Floating cubes (unchanged) */}
      <FloatingCubes />

      {/* Content — typography-optimized */}
      <div style={{
        position: 'relative',
        zIndex: 2,
        textAlign: 'center',
        maxWidth: 860,
        padding: '0 32px',
      }}>
        {/* ═══ ② 副标题胶囊 Badge ═══ */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '5px 18px 5px 16px',
          borderRadius: '20px',
          background: 'rgba(255,255,255,0.07)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.10)',
          color: 'rgba(255,255,255,0.65)',
          fontSize: 'clamp(0.78rem, 1.2vw, 0.9rem)',
          fontWeight: 300,
          fontFamily: "'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif",
          letterSpacing: '0.3em',
          marginBottom: '36px',
          opacity: 0,
          transform: 'translateY(-16px)',
          animation: 'fadeInSlideDown 0.6s ease-out 0.1s forwards',
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#A78BFA', opacity: 0.7, display: 'inline-block' }} />
          AI驱动的个性化学习平台
        </div>

        {/* ═══ ① 主标题 — 两行错落排版 ═══ */}
        <h1 style={{
          marginBottom: '28px',
          opacity: 0,
          transform: 'translateY(-20px)',
          animation: 'fadeInSlideDown 0.7s ease-out 0.28s forwards',
        }}>
          {/* 上半句：纯白加粗，偏左错落 */}
          <span
            style={{
              display: 'block',
              fontSize: 'clamp(2.6rem, 6.5vw, 4.5rem)',
              fontWeight: 700,
              fontFamily: "'ZCOOL KuaiLe', 'Noto Sans SC', 'PingFang SC', sans-serif",
              color: '#FFFFFF',
              lineHeight: 1.25,
              letterSpacing: '0.06em',
              textShadow: '0 2px 12px rgba(0,0,0,0.08)',
              transform: 'translateX(-3%)',
              marginBottom: '4px',
            }}
          >
            让AI理解你的学习，
          </span>
          {/* 下半句：浅紫渐变柔化，偏右错落，字号略小 */}
          <span
            style={{
              display: 'block',
              fontSize: 'clamp(2.2rem, 5.5vw, 3.8rem)',
              fontWeight: 500,
              fontFamily: "'ZCOOL KuaiLe', 'Noto Sans SC', 'PingFang SC', sans-serif",
              background: 'linear-gradient(135deg, #C4B5FD, #A78BFA, #818CF8)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              lineHeight: 1.2,
              letterSpacing: '0.08em',
              transform: 'translateX(3%)',
            }}
          >
            为每个人因材施教
          </span>
        </h1>

        {/* ═══ ③ 介绍正文 — 拆分短句、纤细轻盈 ═══ */}
        <p style={{
          fontSize: 'clamp(0.88rem, 1.3vw, 1.05rem)',
          fontWeight: 200,
          fontFamily: "'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif",
          color: 'rgba(255,255,255,0.58)',
          lineHeight: 1.9,
          letterSpacing: '0.04em',
          maxWidth: 660,
          margin: '0 auto 40px',
          opacity: 0,
          transform: 'translateY(-16px)',
          animation: 'fadeInSlideDown 0.6s ease-out 0.46s forwards',
        }}>
          基于大语言模型的多智能体教育系统，
          <br />
          通过动态学习画像、个性化资源生成与自适应练习路径，
          <br />
          让学习效率提升 300%
        </p>

        {/* ═══ ④ 按钮组 ═══ */}
        <div style={{
          display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap',
          opacity: 0, transform: 'translateY(-16px)',
          animation: 'fadeInSlideDown 0.6s ease-out 0.64s forwards',
        }}>
          {/* 主按钮：立即开始体验 — 粗圆体 */}
          <button onClick={handleStart}
            style={{
              padding: '16px 44px',
              fontSize: '1.1rem',
              fontWeight: 600,
              fontFamily: "'ZCOOL KuaiLe', 'Noto Sans SC', 'PingFang SC', sans-serif",
              borderRadius: '14px',
              border: 'none',
              cursor: 'pointer',
              color: '#fff',
              background: 'linear-gradient(135deg, #6366F1, #8B5CF6, #A78BFA)',
              backgroundSize: '200% 200%',
              animation: 'gradientFlow 4s ease infinite',
              boxShadow: '0 4px 15px rgba(99,102,241,0.3)',
              letterSpacing: '0.04em',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px) scale(1.03)'
              e.currentTarget.style.boxShadow = '0 12px 30px rgba(99,102,241,0.45)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = ''
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(99,102,241,0.3)'
            }}
          >
            立即开始体验
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>

          {/* 次按钮：了解更多 — 常规细圆体 */}
          <button
            onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
            style={{
              padding: '16px 34px',
              borderRadius: '14px',
              border: '1.5px solid rgba(255,255,255,0.18)',
              background: 'rgba(255,255,255,0.06)',
              backdropFilter: 'blur(8px)',
              color: 'rgba(255,255,255,0.8)',
              fontSize: '1rem',
              fontWeight: 300,
              fontFamily: "'ZCOOL KuaiLe', 'Noto Sans SC', 'PingFang SC', sans-serif",
              cursor: 'pointer',
              letterSpacing: '0.06em',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)'
              e.currentTarget.style.background = 'rgba(255,255,255,0.15)'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.35)'
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(124,92,247,0.2)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = ''
              e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            了解更多
          </button>
        </div>

        {/* ═══ ⑤ 底部小字：已有账号？立即登录 ═══ */}
        <div style={{
          marginTop: '52px',
          opacity: 0,
          animation: 'fadeInSlideDown 0.6s ease-out 0.82s forwards',
        }}>
          <button onClick={onLoginClick} style={{
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.25)',
            cursor: 'pointer',
            fontFamily: "'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif",
            fontSize: '0.8rem',
            fontWeight: 200,
            letterSpacing: '0.04em',
            padding: '4px 0',
            borderBottom: '1px dashed rgba(255,255,255,0.12)',
            transition: 'color 0.3s ease',
          }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.55)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.25)'}
          >
            已有账号？立即登录 →
          </button>
        </div>
      </div>

      {/* Scroll indicator (unchanged) */}
      <div style={{
        position: 'absolute',
        bottom: '32px',
        zIndex: 2,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        color: 'rgba(255,255,255,0.25)',
        fontSize: '0.72rem',
        fontWeight: 200,
        fontFamily: "'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif",
        cursor: 'pointer',
        opacity: 0,
        animation: 'fadeInSlideUp 0.6s ease-out 1s forwards',
      }}
        onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
      >
        <span>向下滚动</span>
        <div style={{
          width: '20px',
          height: '30px',
          borderRadius: '10px',
          border: '2px solid rgba(255,255,255,0.12)',
          display: 'flex',
          justifyContent: 'center',
          paddingTop: '5px',
        }}>
          <div className="scroll-arrow-dot" style={{
            width: '3px',
            height: '8px',
            borderRadius: '2px',
            background: 'rgba(255,255,255,0.3)',
          }} />
        </div>
      </div>
    </section>
  )
}
