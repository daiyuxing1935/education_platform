import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

/* ── 主题配置 ── */
const THEMES = {
  purple: {
    bg: 'radial-gradient(ellipse at 50% 0%, #1a1035 0%, #0f0a2a 35%, #120b30 60%, #1c1038 80%, #2a1440 100%)',
    starColor: '255,255,255',
    bigStarColor: '251,191,36',
    goldColor: '251,191,36',
    ribbonColor: '124,92,247',
    accentColor: '167,139,250',
    starCount: 55,
    bigStarCount: 12,
    goldCount: 25,
    fallCount: 6,
    meteorCount: 3,
    showRibbons: true,
    showBooks: true,
  },
  blue: {
    bg: 'radial-gradient(ellipse at 50% 0%, #0c1f3a 0%, #091426 35%, #0b1830 60%, #0f1f3d 80%, #16284a 100%)',
    starColor: '200,220,255',
    bigStarColor: '147,197,253',
    goldColor: '147,197,253',
    ribbonColor: '59,130,246',
    accentColor: '147,197,253',
    starCount: 45,
    bigStarCount: 10,
    goldCount: 20,
    fallCount: 4,
    meteorCount: 4,
    showRibbons: true,
    showBooks: false,
  },
  emerald: {
    bg: 'radial-gradient(ellipse at 50% 0%, #0a2e1a 0%, #071d10 35%, #0a2618 60%, #0d3320 80%, #14482c 100%)',
    starColor: '180,255,210',
    bigStarColor: '52,211,153',
    goldColor: '16,185,129',
    ribbonColor: '16,185,129',
    accentColor: '110,231,183',
    starCount: 50,
    bigStarCount: 10,
    goldCount: 22,
    fallCount: 5,
    meteorCount: 2,
    showRibbons: true,
    showBooks: true,
  },
  amber: {
    bg: 'radial-gradient(ellipse at 50% 0%, #2a1f0a 0%, #1d1407 35%, #261b0a 60%, #33240d 80%, #402e12 100%)',
    starColor: '255,240,200',
    bigStarColor: '251,191,36',
    goldColor: '245,158,11',
    ribbonColor: '217,119,6',
    accentColor: '251,191,36',
    starCount: 40,
    bigStarCount: 8,
    goldCount: 18,
    fallCount: 4,
    meteorCount: 3,
    showRibbons: false,
    showBooks: false,
  },
  rose: {
    bg: 'radial-gradient(ellipse at 50% 0%, #2a0a1a 0%, #1d0712 35%, #260a18 60%, #330d20 80%, #401228 100%)',
    starColor: '255,210,230',
    bigStarColor: '244,114,182',
    goldColor: '236,72,153',
    ribbonColor: '219,39,119',
    accentColor: '249,168,212',
    starCount: 45,
    bigStarCount: 10,
    goldCount: 20,
    fallCount: 5,
    meteorCount: 2,
    showRibbons: true,
    showBooks: false,
  },
  cosmic: {
    bg: 'radial-gradient(ellipse at 50% 0%, #1a0a2e 0%, #0f051d 35%, #140826 60%, #1b0c33 80%, #241040 100%)',
    starColor: '220,200,255',
    bigStarColor: '167,139,250',
    goldColor: '139,92,246',
    ribbonColor: '124,58,237',
    accentColor: '196,181,253',
    starCount: 60,
    bigStarCount: 14,
    goldCount: 28,
    fallCount: 6,
    meteorCount: 5,
    showRibbons: true,
    showBooks: true,
  },
}

type ThemeName = keyof typeof THEMES

interface StarryBgProps {
  theme?: ThemeName
  customBg?: string
}

/* ── 全局动画 keyframes（仅注入一次） ── */
let injected = false
function injectKeyframes() {
  if (injected || typeof document === 'undefined') return
  injected = true
  const style = document.createElement('style')
  style.textContent = `
    @keyframes moonFloat { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-12px); } }
    @keyframes ribbonFlow {
      0%,100% { transform:translateX(0) translateY(0) scale(1); opacity:0.6; }
      25% { transform:translateX(50px) translateY(-15px) scale(1.06); opacity:0.8; }
      50% { transform:translateX(-30px) translateY(18px) scale(0.94); opacity:0.5; }
      75% { transform:translateX(25px) translateY(-10px) scale(1.03); opacity:0.7; }
    }
    @keyframes openBookFloat {
      0%,100% { transform:scale(var(--book-scale,1)) translateY(0) rotate(0deg); }
      25% { transform:scale(var(--book-scale,1)) translateY(-12px) rotate(2.5deg); }
      50% { transform:scale(var(--book-scale,1)) translateY(-22px) rotate(-1.5deg); }
      75% { transform:scale(var(--book-scale,1)) translateY(-8px) rotate(2deg); }
    }
    @keyframes goldStream {
      0%,100% { transform:translateX(0) scale(1); opacity:0.3; }
      25% { transform:translateX(40%) scale(1.25); opacity:0.6; }
      50% { transform:translateX(80%) scale(0.75); opacity:0.2; }
      75% { transform:translateX(40%) scale(1.15); opacity:0.45; }
    }
  `
  document.head.appendChild(style)
}

/* ── 通用星空背景组件 ── */
export default function StarryBackground({ theme: themeName = 'purple', customBg }: StarryBgProps) {
  injectKeyframes()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const theme = THEMES[themeName]
    let w = window.innerWidth, h = window.innerHeight
    canvas.width = w; canvas.height = h
    let animId = 0

    /* ── 粒子 ── */
    interface Particle { x: number; y: number; vx: number; vy: number; size: number; speed: number; phase: number; type: 'small' | 'big' | 'gold' | 'fall' }
    const particles: Particle[] = []

    const rand = (min: number, max: number) => min + Math.random() * (max - min)

    for (let i = 0; i < theme.starCount; i++) particles.push({
      x: rand(0, w), y: rand(0, h), vx: 0, vy: 0, size: rand(0.8, 2), speed: rand(0.8, 2.5), phase: rand(0, Math.PI * 2), type: 'small',
    })
    for (let i = 0; i < theme.bigStarCount; i++) particles.push({
      x: rand(0, w), y: rand(0, h), vx: 0, vy: 0, size: rand(2.5, 4.5), speed: rand(0.3, 0.8), phase: rand(0, Math.PI * 2), type: 'big',
    })
    for (let i = 0; i < theme.goldCount; i++) particles.push({
      x: rand(0, w), y: rand(0, h), vx: rand(-0.1, 0.1), vy: rand(-0.15, -0.05), size: rand(1.2, 2.5), speed: rand(0.4, 1.2), phase: rand(0, Math.PI * 2), type: 'gold',
    })

    const falling: Particle[] = []
    for (let i = 0; i < theme.fallCount; i++) falling.push({
      x: rand(0, w), y: -rand(10, 60), vx: 0, vy: 0, size: rand(1.5, 3), speed: rand(0.3, 0.6), phase: rand(0, Math.PI * 2), type: 'fall',
    })

    /* ── 流星 ── */
    interface Meteor { x: number; y: number; vx: number; vy: number; len: number; life: number; maxLife: number; delay: number }
    const meteors: Meteor[] = []
    for (let i = 0; i < theme.meteorCount; i++) {
      meteors.push({
        x: rand(0, w * 0.5), y: rand(0, h * 0.3),
        vx: rand(3, 6), vy: rand(1.5, 3),
        len: rand(40, 80), life: 0, maxLife: rand(60, 120),
        delay: rand(0, 200),
      })
    }

    let frame = 0
    const draw = () => {
      frame++
      ctx!.clearRect(0, 0, w, h)
      const time = Date.now() / 1000

      /* ── 小星星 ── */
      for (const p of particles) {
        if (p.type !== 'small') continue
        const alpha = 0.15 + Math.sin(time * p.speed + p.phase) * 0.5 + 0.35
        const s = p.size * (0.7 + Math.sin(time * p.speed * 1.5 + p.phase) * 0.15)
        ctx!.beginPath()
        ctx!.arc(p.x, p.y, Math.max(0.3, s), 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(${theme.starColor},${Math.max(0.05, alpha)})`
        ctx!.fill()
      }

      /* ── 大星星 ── */
      for (const p of particles) {
        if (p.type !== 'big') continue
        const alpha = 0.2 + Math.sin(time * p.speed * 0.5 + p.phase) * 0.4
        const glow = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3)
        glow.addColorStop(0, `rgba(${theme.bigStarColor},${Math.max(0.05, alpha * 0.6)})`)
        glow.addColorStop(1, `rgba(${theme.bigStarColor},0)`)
        ctx!.fillStyle = glow
        ctx!.fillRect(p.x - p.size * 3, p.y - p.size * 3, p.size * 6, p.size * 6)
        ctx!.beginPath()
        ctx!.arc(p.x, p.y, p.size * 0.8, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(${theme.bigStarColor},${Math.max(0.05, alpha)})`
        ctx!.fill()
      }

      /* ── 金色粒子 ── */
      for (const p of particles) {
        if (p.type !== 'gold') continue
        const alpha = 0.1 + Math.sin(time * p.speed + p.phase) * 0.25
        const driftX = Math.sin(time * 0.3 + p.phase) * 15
        p.x += p.vx; p.y += p.vy
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0
        if (p.y < 0) p.y = h; if (p.y > h) p.y = 0
        ctx!.beginPath()
        ctx!.arc(p.x + driftX, p.y, p.size * 0.6, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(${theme.goldColor},${Math.max(0.03, alpha)})`
        ctx!.fill()
      }

      /* ── 飘落星 ── */
      for (const p of falling) {
        p.y += 0.4 + p.speed * 0.5
        p.x += Math.sin(time * 0.5 + p.phase) * 0.3
        if (p.y > h + 20) { p.y = -rand(10, 60); p.x = rand(0, w) }
        const alpha = Math.max(0.05, 0.45 * (1 - p.y / h))
        ctx!.beginPath()
        ctx!.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(${theme.bigStarColor},${alpha})`
        ctx!.fill()
      }

      /* ── 流星 ── */
      for (const m of meteors) {
        if (frame < m.delay) continue
        m.life++
        if (m.life > m.maxLife) { m.life = 0; m.x = rand(0, w * 0.5); m.y = rand(0, h * 0.3); m.delay = rand(40, 180); continue }
        const progress = m.life / m.maxLife
        const headAlpha = Math.max(0, 1 - progress * 0.8)
        const tailAlpha = Math.max(0, 0.5 * (1 - progress))
        m.x += m.vx; m.y += m.vy
        // 流星头
        ctx!.beginPath()
        ctx!.arc(m.x, m.y, 1.5, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(${theme.bigStarColor},${headAlpha})`
        ctx!.fill()
        // 流星尾
        const tailLen = m.len * (1 - progress * 0.3)
        const grad = ctx!.createLinearGradient(m.x, m.y, m.x - m.vx * tailLen, m.y - m.vy * tailLen)
        grad.addColorStop(0, `rgba(${theme.bigStarColor},${tailAlpha})`)
        grad.addColorStop(1, `rgba(${theme.bigStarColor},0)`)
        ctx!.beginPath()
        ctx!.moveTo(m.x, m.y)
        ctx!.lineTo(m.x - m.vx * tailLen, m.y - m.vy * tailLen)
        ctx!.strokeStyle = grad
        ctx!.lineWidth = 1.5
        ctx!.stroke()
      }

      animId = requestAnimationFrame(draw)
    }
    draw()

    const onResize = () => { w = window.innerWidth; h = window.innerHeight; canvas!.width = w; canvas!.height = h }
    window.addEventListener('resize', onResize)
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', onResize) }
  }, [themeName])

  const theme = THEMES[themeName]

  return (
    <div style={{
      position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden',
      background: customBg || theme.bg,
      opacity: 0.22, transform: 'translateZ(0)',
    }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

      {/* 弯月 */}
      <div style={{
        position: 'absolute', pointerEvents: 'none', willChange: 'transform',
        top: '8%', left: '84%', animation: 'moonFloat 10s ease-in-out infinite',
      }}>
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: 50, height: 50, borderRadius: '50%',
          background: `radial-gradient(circle, rgba(${theme.bigStarColor},0.06) 0%, transparent 70%)`,
        }} />
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.4 }}>
          <path d="M12 3a10 10 0 1 0 10 10 9 9 0 0 1-10-10z" fill={`rgba(${theme.bigStarColor},0.5)`} />
        </svg>
      </div>

      {/* 飘带 */}
      {theme.showRibbons && [
        { top: '20%', left: '-10%', w: '120%', h: '20%', color: `rgba(${theme.ribbonColor},0.05)`, dur: '22s', delay: '0s' },
        { top: '55%', left: '-10%', w: '120%', h: '16%', color: `rgba(${theme.accentColor},0.04)`, dur: '25s', delay: '-6s' },
        { top: '75%', left: '-15%', w: '130%', h: '18%', color: `rgba(${theme.ribbonColor},0.03)`, dur: '20s', delay: '-12s' },
      ].map((r, i) => (
        <div key={`rb-${i}`} style={{
          position: 'absolute', pointerEvents: 'none', willChange: 'transform', opacity: 0.4,
          top: r.top, left: r.left, width: r.w, height: r.h, borderRadius: '50%',
          background: `linear-gradient(90deg, ${r.color}, transparent, ${r.color})`,
          animation: `ribbonFlow ${r.dur} ease-in-out infinite`, animationDelay: r.delay,
        }} />
      ))}

      {/* 书本 */}
      {theme.showBooks && [
        { top: '18%', left: '6%', scale: 1, delay: '0s', dur: '9s' },
        { top: '60%', left: '80%', scale: 0.75, delay: '3s', dur: '10s' },
      ].map((ob, i) => (
        <div key={`book-${i}`} style={{
          position: 'absolute', pointerEvents: 'none', willChange: 'transform',
          top: ob.top, left: ob.left, transform: `scale(${ob.scale})`,
          animation: `openBookFloat ${ob.dur} ease-in-out infinite`, animationDelay: ob.delay,
        }}>
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            width: 40, height: 28, borderRadius: '50%',
            background: `radial-gradient(ellipse, rgba(${theme.bigStarColor},0.04) 0%, transparent 70%)`,
          }} />
          <svg width="32" height="22" viewBox="0 0 36 28" fill="none" style={{ opacity: 0.3 }}>
            <path d="M18 26V5c-2-2-5-3-8-3H2v22h8c3 0 6 1 8 2z" fill={`rgba(${theme.accentColor},0.1)`} stroke={`rgba(${theme.accentColor},0.08)`} strokeWidth="0.4" />
            <path d="M18 26V5c2-2 5-3 8-3h8v22h-8c-3 0-6 1-8 2z" fill={`rgba(${theme.accentColor},0.07)`} stroke={`rgba(${theme.accentColor},0.06)`} strokeWidth="0.4" />
            <line x1="18" y1="2" x2="18" y2="26" stroke={`rgba(${theme.accentColor},0.1)`} strokeWidth="0.5" />
          </svg>
        </div>
      ))}

      {/* 金色流光 */}
      {[
        { top: '30%', left: '-5%', w: '55%', delay: '0s', dur: '16s' },
        { top: '55%', left: '50%', w: '45%', delay: '-8s', dur: '18s' },
        { top: '75%', left: '5%', w: '50%', delay: '-14s', dur: '15s' },
      ].map((g, i) => (
        <div key={`gs-${i}`} style={{
          position: 'absolute', pointerEvents: 'none', willChange: 'transform, opacity',
          top: g.top, left: g.left, width: g.w, height: 2, borderRadius: '50%',
          background: `linear-gradient(90deg, transparent, rgba(${theme.goldColor},0.05), transparent)`,
          opacity: 0.35,
          animation: `goldStream ${g.dur} ease-in-out infinite`, animationDelay: g.delay,
        }} />
      ))}
    </div>
  )
}

/* ── 便捷预设 ── */
export const PurpleTheme = () => <StarryBackground theme="purple" />
export const BlueTheme = () => <StarryBackground theme="blue" />
export const EmeraldTheme = () => <StarryBackground theme="emerald" />
export const AmberTheme = () => <StarryBackground theme="amber" />
export const RoseTheme = () => <StarryBackground theme="rose" />
export const CosmicTheme = () => <StarryBackground theme="cosmic" />

/* ── 路由主题映射 ── */
export function useStarryTheme(): ThemeName {
  const loc = useLocation()
  const path = loc.pathname
  if (path === '/home' || path === '/') return 'purple'
  if (path.startsWith('/chat') || path.startsWith('/api') || path.startsWith('/settings')) return 'blue'
  if (path.startsWith('/banks') || path.startsWith('/practice') || path.startsWith('/subject') || path.startsWith('/wrong') || path.startsWith('/stats') || path.startsWith('/test')) return 'emerald'
  if (path.startsWith('/profile') || path.startsWith('/path')) return 'amber'
  if (path.startsWith('/resources') || path.startsWith('/cloud') || path.startsWith('/recommendations')) return 'rose'
  if (path.startsWith('/admin')) return 'cosmic'
  return 'purple'
}
