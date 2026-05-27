import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import * as echarts from 'echarts'
import MarkdownRenderer from './MarkdownRenderer'

interface StepData {
  narration: string
  visual_desc: string
  visual_type?: string
  image_query?: string
  icon_type?: string
  chart_data?: { type: string; title: string; labels: string[]; values: number[] }
  table_data?: { headers: string[]; rows: string[][] }
  animation_effect?: string
  duration_seconds: number
  audio_file?: string
  audio_url?: string
  bg_image?: string
  image_url?: string
  mindmap_data?: any
  flowchart_data?: any
  gantt_data?: any
  timeline_data?: any
  drawio_xml?: string
  diagram_html?: string
}

interface ChapterData { id: string; title: string; steps: StepData[] }

interface VideoData {
  type: string; title: string; script: string; outline: string
  chapters: ChapterData[]; total_steps: number; has_audio: boolean
}

interface VideoPlayerProps { data: VideoData }

const THEMES = [
  { bg: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)', text: '#fff', accent: '#7eb8ff' },
  { bg: 'linear-gradient(135deg, #0d4f3c, #1a6e5c, #2a8c75)', text: '#fff', accent: '#6ddbc3' },
  { bg: 'linear-gradient(135deg, #2d1b69, #4a2d8e, #6b3fa0)', text: '#fff', accent: '#c084fc' },
  { bg: 'linear-gradient(135deg, #0c2340, #1a4a7a, #2d6fa0)', text: '#fff', accent: '#7dd3fc' },
  { bg: 'linear-gradient(135deg, #1a3a2a, #2d5c45, #3d7c60)', text: '#fff', accent: '#86efac' },
  { bg: 'linear-gradient(135deg, #3d1f0a, #5c3a1a, #7a5530)', text: '#fff', accent: '#fdba74' },
]

/** 图片 URL 回退方案：当后端未提供图片时，使用纯色占位图 */
function fallbackImageUrl(query: string, w = 1920, h = 1080): string {
  return `https://placehold.co/${w}x${h}/1a1a2e/ffffff?text=${encodeURIComponent(query.slice(0, 20))}`
}

const TRANSITIONS = ['card-flip', 'depth-zoom', 'slide-spread', 'glow-fade'] as const

const KNOWLEDGE_ICONS: Record<string, string> = {
  code: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
  brain: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2a4 4 0 0 1 4 4c0 1.1-.4 2-1 2.7V10c0 1.1-.9 2-2 2s-2-.9-2-2V8.7c-.6-.7-1-1.6-1-2.7a4 4 0 0 1 4-4z"/><path d="M12 14c2.2 0 6 1.1 6 3v2H6v-2c0-1.9 3.8-3 6-3z"/></svg>`,
  database: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`,
  book: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
  lightbulb: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/></svg>`,
  chart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
}

function inferIconType(narration: string, iconType?: string): string {
  if (iconType && KNOWLEDGE_ICONS[iconType]) return iconType
  const l = narration.toLowerCase()
  if (/\b(code|编程|代码|函数|算法)\b/.test(l)) return 'code'
  if (/\b(brain|大脑|思维|思考)\b/.test(l)) return 'brain'
  if (/\b(data|base|数据|库|存储)\b/.test(l)) return 'database'
  if (/\b(book|书|文档|学习)\b/.test(l)) return 'book'
  return 'lightbulb'
}

function BarChart({ data, color }: { data: { labels: string[]; values: number[] }; color: string }) {
  if (!data?.values?.length) return null
  const max = Math.max(...data.values, 1)
  return (
    <div style={{ width: '100%', maxWidth: 500, margin: '0 auto 12px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 100, padding: '0 8px' }}>
        {data.values.map((v, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ width: '100%', height: `${(v / max) * 80}px`, minHeight: 4, borderRadius: '4px 4px 0 0', background: color, opacity: 0.8 }} />
            {data.labels[i] && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 60 }}>{data.labels[i]}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function VideoPlayer({ data }: VideoPlayerProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [themeIdx, setThemeIdx] = useState(0)
  const [bgImage, setBgImage] = useState('')
  const [transitionClass, setTransitionClass] = useState('')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [displayText, setDisplayText] = useState('')

  const currentStepRef = useRef(-1)
  const playingRef = useRef(true)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const playerRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const bgmCtxRef = useRef<AudioContext | null>(null)
  const elapsedStartRef = useRef(0)
  const rafRef = useRef<number>()
  const unmountedRef = useRef(false)
  const textTimerRef = useRef<number>()
  const speechGenRef = useRef(0)         // 递增，防陈旧 speech 回调

  const [totalElapsedSec, setTotalElapsedSec] = useState(0)

  // ── 稳定化 allSteps（useMemo 确保引用稳定） ──
  const { allSteps, total, totalDurationSec } = useMemo(() => {
    const steps: Array<{
      narration: string; visual_type?: string; image_query?: string; icon_type?: string
      chart_data?: any; table_data?: any; dur: number; audio_url?: string
      bg_image?: string; image_url?: string
      mindmap_data?: any; flowchart_data?: any; gantt_data?: any; timeline_data?: any
      drawio_xml?: string; diagram_html?: string
    }> = []
    let durSec = 0
    for (const ch of data.chapters || []) {
      steps.push({ narration: `${ch.title}`, dur: 3 }); durSec += 3
      for (const s of ch.steps || []) {
        steps.push({
          narration: s.narration || '', visual_type: s.visual_type, image_query: s.image_query,
          icon_type: s.icon_type, chart_data: s.chart_data, table_data: s.table_data,
          dur: Math.max(2, s.duration_seconds || 5), audio_url: s.audio_url,
          bg_image: s.bg_image, image_url: s.image_url,
          mindmap_data: s.mindmap_data, flowchart_data: s.flowchart_data, gantt_data: s.gantt_data, timeline_data: s.timeline_data,
          drawio_xml: s.drawio_xml, diagram_html: s.diagram_html,
        })
        durSec += Math.max(2, s.duration_seconds || 5)
      }
    }
    return { allSteps: steps, total: steps.length, totalDurationSec: durSec }
  }, [data.chapters])

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60); const s = Math.floor(sec % 60)
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  // ── 彻底停止所有音频 ──
  const hardStopAllAudio = useCallback(() => {
    if (textTimerRef.current) { clearTimeout(textTimerRef.current); textTimerRef.current = undefined }
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = undefined }
    if (audioRef.current) {
      try { audioRef.current.pause(); audioRef.current.currentTime = 0; audioRef.current.onended = null; audioRef.current.onerror = null; audioRef.current.src = '' } catch {}
    }
    window.speechSynthesis?.cancel()
  }, [])

  const stopBGM = useCallback(() => {
    try { if (bgmCtxRef.current) { bgmCtxRef.current.close().catch(() => {}); bgmCtxRef.current = null } } catch {}
  }, [])

  const startBGM = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const gain = ctx.createGain(); gain.gain.value = 0.03; gain.connect(ctx.destination)
      const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = 130.81; o1.connect(gain); o1.start()
      const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 196.00; o2.connect(gain); o2.start()
      bgmCtxRef.current = ctx
    } catch {}
  }, [])

  const playTransitionSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc = ctx.createOscillator(); const gain = ctx.createGain()
      osc.type = 'sine'; osc.frequency.setValueAtTime(500, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.12)
      gain.gain.setValueAtTime(0.05, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18)
      osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.18)
    } catch {}
  }, [])

  // ── 朗读 + 定时器推进（不使用 onend 推进，避免某些浏览器秒播完） ──
  const speakText = useCallback((text: string, onDone: () => void) => {
    speechGenRef.current += 1
    const myGen = speechGenRef.current

    // 根据文本长度计算最小停留时间（每秒约 8 个字，最少 2 秒）
    const minDuration = Math.max(2000, Math.round(text.length * 130))

    const fireOnDone = () => {
      if (myGen === speechGenRef.current) onDone()
    }

    // 始终用定时器控制推进
    textTimerRef.current = window.setTimeout(fireOnDone, minDuration)

    // 语音仅作背景播放，不依赖其回调
    if (!window.speechSynthesis || !text) return
    try {
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'zh-CN'; u.rate = 1.0; u.pitch = 1.0
      window.speechSynthesis.speak(u)
    } catch {}
  }, [])

  // ── 核心：跳转到指定步 ──
  const goToStep = useCallback((idx: number, force = false) => {
    if (unmountedRef.current) return
    const clamped = Math.max(0, Math.min(total - 1, idx))
    if (clamped === currentStepRef.current && !force) return

    hardStopAllAudio()
    currentStepRef.current = clamped
    playingRef.current = true
    setCurrentStep(clamped)
    setPlaying(true)
    setElapsedMs(0)

    const step = allSteps[clamped]
    if (!step) return

    setDisplayText(step.narration)
    const query = step.image_query || data.title
    setBgImage(step.bg_image || fallbackImageUrl(query))
    setThemeIdx(Math.floor(clamped / 3) % THEMES.length)
    setTransitionClass(TRANSITIONS[clamped % TRANSITIONS.length])
    playTransitionSound()

    speakText(step.narration, () => {
      if (!unmountedRef.current && clamped === currentStepRef.current && playingRef.current) {
        const next = currentStepRef.current + 1
        if (next < total) goToStep(next)
        else { setPlaying(false); playingRef.current = false }
      }
    })
  }, [total, allSteps, data.title, hardStopAllAudio, playTransitionSound, speakText])

  // ── 暂停/播放 ──
  const togglePlay = useCallback(() => {
    if (playingRef.current) { playingRef.current = false; setPlaying(false); hardStopAllAudio() }
    else goToStep(currentStepRef.current, true)
  }, [hardStopAllAudio, goToStep])

  const seekOnly = useCallback((idx: number) => {
    const wasPlaying = playingRef.current
    goToStep(idx, true)
    if (!wasPlaying) { playingRef.current = false; setPlaying(false); hardStopAllAudio() }
  }, [goToStep, hardStopAllAudio])

  const handleNext = useCallback(() => { if (playingRef.current) goToStep(currentStepRef.current + 1) }, [goToStep])
  const handlePrev = useCallback(() => { if (playingRef.current) goToStep(currentStepRef.current - 1) }, [goToStep])
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) playerRef.current?.requestFullscreen?.(); else document.exitFullscreen()
  }, [])

  // ── 首次挂载 ──
  const startedRef = useRef(false)
  useEffect(() => {
    if (total > 0 && !startedRef.current) { startedRef.current = true; goToStep(0) }
  }, [total, goToStep])

  // ── 时间追踪（RAF） ──
  useEffect(() => {
    if (!playing || currentStep < 0 || currentStep >= total) return
    elapsedStartRef.current = performance.now(); setElapsedMs(0)
    const tick = () => {
      if (unmountedRef.current) return
      setElapsedMs(performance.now() - elapsedStartRef.current)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [currentStep, playing, total])

  // ── 总时间 ──
  useEffect(() => {
    let sec = 0
    for (let i = 0; i < currentStep && i < allSteps.length; i++) sec += allSteps[i]?.dur || 0
    setTotalElapsedSec(sec + elapsedMs / 1000)
  }, [currentStep, allSteps, elapsedMs])

  // ── 键盘 ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Space') { e.preventDefault(); togglePlay() }
      else if (e.key === 'ArrowRight') { seekOnly(currentStepRef.current + 1) }
      else if (e.key === 'ArrowLeft') { seekOnly(currentStepRef.current - 1) }
      else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); toggleFullscreen() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goToStep, seekOnly])

  // ── 进度条：仅用 mousedown/click 双保险 ──
  const calcStepFromPos = useCallback((clientX: number) => {
    if (!progressRef.current) return -1
    const rect = progressRef.current.getBoundingClientRect()
    return Math.round(Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * (total - 1))
  }, [total])

  const handleProgressInteract = useCallback((clientX: number) => {
    const idx = calcStepFromPos(clientX)
    if (idx >= 0 && idx !== currentStepRef.current) {
      goToStep(idx)
    }
  }, [calcStepFromPos, goToStep])

  const handleProgressMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    handleProgressInteract(clientX)
    setDragging(true)
  }, [handleProgressInteract])

  useEffect(() => {
    if (!dragging) return
    const hMove = (e: MouseEvent | TouchEvent) => {
      handleProgressInteract('touches' in e ? e.touches[0].clientX : e.clientX)
    }
    const hUp = () => setDragging(false)
    document.addEventListener('mousemove', hMove); document.addEventListener('mouseup', hUp)
    document.addEventListener('touchmove', hMove, { passive: false }); document.addEventListener('touchend', hUp)
    return () => { document.removeEventListener('mousemove', hMove); document.removeEventListener('mouseup', hUp); document.removeEventListener('touchmove', hMove); document.removeEventListener('touchend', hUp) }
  }, [dragging, handleProgressInteract])

  // ── BGM ──
  useEffect(() => { startBGM(); return stopBGM }, [startBGM, stopBGM])

  // ── 卸载 ──
  useEffect(() => {
    unmountedRef.current = false
    return () => { unmountedRef.current = true; hardStopAllAudio(); stopBGM() }
  }, [hardStopAllAudio, stopBGM])

  // ── 渲染 ──
  const current = allSteps[currentStep]
  const theme = THEMES[themeIdx]
  const fineProgress = total > 0 ? (currentStep + (elapsedMs / 1000) / (allSteps[currentStep]?.dur || 5)) / total : 0

  const renderConceptIcon = (step: any) => {
    const ik = inferIconType(step?.narration || '', step?.icon_type)
    const svg = KNOWLEDGE_ICONS[ik]
    return svg ? <div style={{ width: 56, height: 56, margin: '0 auto 12px', color: theme.accent, opacity: 0.9 }} dangerouslySetInnerHTML={{ __html: svg }} /> : null
  }

  const renderTable = (step: any) => {
    const tbl = step?.table_data
    if (!tbl?.headers?.length || !tbl?.rows?.length) return null
    return (
      <table style={{ borderCollapse: 'collapse', width: '80%', margin: '12px auto', fontSize: 'clamp(13px, 1.5vw, 22px)', color: theme.text }}>
        <thead><tr>{tbl.headers.map((h: string, i: number) => (<th key={i} style={{ background: 'rgba(255,255,255,0.15)', padding: '10px 14px', fontWeight: 600, border: '1px solid rgba(255,255,255,0.15)' }}>{h}</th>))}</tr></thead>
        <tbody>{tbl.rows.map((row: string[], ri: number) => (<tr key={ri}>{row.map((cell: string, ci: number) => (<td key={ci} style={{ padding: '8px 14px', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>{cell}</td>))}</tr>))}</tbody>
      </table>
    )
  }

  const renderContentImage = (step: any) => (
    <img src={step?.image_url || fallbackImageUrl(step?.image_query || data.title, 800, 450)} alt="" style={{ maxWidth: '70%', maxHeight: '38%', borderRadius: 12, marginBottom: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.3)', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
  )

  const renderMindmap = (data: any) => {
    if (!data?.central) return null
    const branches = data.branches || []
    const colors = ['#4fc3f7', '#81c784', '#ffb74d', '#e57373', '#ba68c8', '#4db6ac']
    return (
      <div style={{ width: '100%', maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <div style={{ padding: '8px 20px', borderRadius: 10, background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 18, fontWeight: 700, textAlign: 'center', backdropFilter: 'blur(4px)' }}>
          {data.central}
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 6 }}>
          {branches.map((b: any, i: number) => (
            <div key={i} style={{ flex: 1, minWidth: 100, maxWidth: 180, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 2, height: 16, background: colors[i % colors.length], opacity: 0.5 }} />
              <div style={{ padding: '6px 12px', borderRadius: 6, background: colors[i % colors.length], color: '#fff', fontSize: 13, fontWeight: 600, textAlign: 'center', width: '100%' }}>
                {b.topic}
              </div>
              {(b.sub_items || []).map((item: string, j: number) => (
                <div key={j} style={{ padding: '3px 8px', margin: '1px 0', background: 'rgba(255,255,255,0.08)', borderRadius: 4, fontSize: 11, lineHeight: 1.3, color: 'rgba(255,255,255,0.8)', width: '100%', textAlign: 'center' }}>
                  {item}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  const renderFlowchart = (data: any) => {
    if (!data?.steps?.length) return null
    const stepMap: Record<string, any> = {}
    data.steps.forEach((s: any) => { stepMap[s.id] = s })
    return (
      <div style={{ width: '100%', maxWidth: 500, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {data.title && <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 8 }}>{data.title}</div>}
        {data.steps.map((s: any) => {
          const outgoing = (data.connections || []).filter((c: any) => c.from === s.id)
          const isDecision = s.type === 'decision'
          const isTerminal = s.type === 'start' || s.type === 'end'
          return (
            <div key={s.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <div style={{
                padding: '6px 16px',
                borderRadius: isTerminal ? 16 : isDecision ? 4 : 6,
                background: 'rgba(255,255,255,0.08)',
                border: '2px solid ' + (isDecision ? '#ffb74d' : isTerminal ? '#4fc3f7' : 'rgba(255,255,255,0.2)'),
                color: '#fff', fontSize: 13, fontWeight: 500, textAlign: 'center', minWidth: 70,
              }}>
                {s.text}
              </div>
              {outgoing.map((oc: any, oi: number) => (
                <div key={oi} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>{'↓'}</span>
                  {oc.label && <span style={{ fontSize: 10, color: '#ffb74d' }}>{oc.label}</span>}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    )
  }

  const renderGantt = (data: any) => {
    if (!data?.tasks?.length) return null
    const tasks = data.tasks
    const maxEnd = Math.max(...tasks.map((t: any) => (t.start || 0) + (t.duration || 1)))
    const cols = Math.max(maxEnd, 6)
    const colors = ['#4fc3f7', '#81c784', '#ffb74d', '#e57373', '#ba68c8', '#4db6ac', '#fff176', '#a1887f']

    const title = data.title
    return (
      <div style={{ width: '100%', maxWidth: 550, margin: '0 auto' }}>
        {title && <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 8, fontWeight: 500 }}>{title}</div>}
        <div style={{ display: 'flex', gap: 0, marginBottom: 4, paddingLeft: 80 }}>
          {Array.from({ length: Math.min(cols + 1, 9) }, (_, i) => {
            const val = Math.round((i / 8) * cols)
            return <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>{val}</div>
          })}
        </div>
        {tasks.map((t: any, i: number) => {
          const pctLeft = ((t.start || 0) / Math.max(1, cols)) * 100
          const pctWidth = ((t.duration || 1) / Math.max(1, cols)) * 100
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '3px 0' }}>
              <div style={{ width: 70, fontSize: 11, color: 'rgba(255,255,255,0.6)', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {t.name}
              </div>
              <div style={{ flex: 1, height: 20, position: 'relative', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ position: 'absolute', left: pctLeft + '%', width: Math.max(pctWidth, 3) + '%', height: '100%', borderRadius: 3, background: colors[i % colors.length], opacity: 0.85 }} />
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const renderTimeline = (data: any) => {
    if (!data?.milestones?.length) return null
    const colors = ['#4fc3f7', '#81c784', '#ffb74d', '#e57373', '#ba68c8', '#4db6ac']
    return (
      <div style={{ width: '100%', maxWidth: 500, margin: '0 auto', position: 'relative' }}>
        {data.title && <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, marginBottom: 12, fontWeight: 600, textAlign: 'center' }}>{data.title}</div>}
        {data.milestones.map((m: any, i: number) => {
          const c = colors[i % colors.length]
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', margin: '6px 0', paddingLeft: 40 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: c, margin: '3px 8px 0 0', flexShrink: 0, boxShadow: `0 0 8px ${c}66` }} />
              <div style={{ flex: 1 }}>
                <span style={{ color: c, fontWeight: 600, fontSize: 13 }}>{m.title}</span>
                {m.date && <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginLeft: 6 }}>{m.date}</span>}
                {m.description && <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 1 }}>{m.description}</div>}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const tAnim: Record<string, React.CSSProperties> = {
    'card-flip': { animation: 'vpCardFlip 0.7s ease-out' },
    'depth-zoom': { animation: 'vpDepthZoom 0.7s ease-out' },
    'slide-spread': { animation: 'vpSlideSpread 0.7s ease-out' },
    'glow-fade': { animation: 'vpGlowFade 0.7s ease-out' },
  }

  return (
    <div ref={playerRef} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--gray-200)', background: theme.bg, perspective: 1200 }}>
        {bgImage && (
          <>
            <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.2 }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.3) 100%)' }} />
          </>
        )}
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '4% 8%', ...(tAnim[transitionClass] || {}) }}>
          <div style={{ textAlign: 'center', width: '100%' }}>
            {renderConceptIcon(current)}
            {(current as any)?.visual_type === 'image' && renderContentImage(current)}
            {(current as any)?.chart_data && <BarChart data={(current as any).chart_data} color={theme.accent} />}
            {(current as any)?.visual_type === 'table' && renderTable(current)}
            {(current as any)?.visual_type === 'mindmap' && renderMindmap((current as any)?.mindmap_data)}
            {(current as any)?.visual_type === 'flowchart' && renderFlowchart((current as any)?.flowchart_data)}
            {(current as any)?.visual_type === 'gantt' && renderGantt((current as any)?.gantt_data)}
            {(current as any)?.visual_type === 'timeline' && renderTimeline((current as any)?.timeline_data)}
            {(['bar_chart','line_chart','pie_chart','donut_chart','chart'].includes((current as any)?.visual_type)) && <EChartComponent chartData={(current as any)?.chart_data} stepIdx={currentStep} />}
            <p style={{ fontSize: 'clamp(16px, 2vw, 32px)', lineHeight: 1.8, color: theme.text, maxWidth: '90%', margin: '0 auto', textShadow: '0 2px 12px rgba(0,0,0,0.3)', fontWeight: 400, letterSpacing: '0.02em' }}>{displayText}</p>
          </div>
          <div style={{ position: 'absolute', top: 16, right: 16, fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace', letterSpacing: '0.05em' }}>{formatTime(totalElapsedSec)} / {formatTime(totalDurationSec)}</div>
        </div>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} style={{ position: 'absolute', width: 6 + (i % 3) * 2, height: 6 + (i % 3) * 2, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', left: `${(i * 31 + 7) % 100}%`, top: `${(i * 47 + 11) % 100}%`, animation: `vpPulse ${2 + (i % 3)}s ease-in-out infinite`, animationDelay: `${i * 0.3}s` }} />
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px', flexWrap: 'wrap' }}>
        <button onClick={handlePrev} disabled={currentStep <= 0} style={{ background: 'none', border: '1px solid var(--gray-200)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', color: 'var(--gray-600)', opacity: currentStep <= 0 ? 0.4 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg></button>
        <button onClick={togglePlay} style={{ background: playing ? 'var(--gray-100)' : 'var(--primary)', border: 'none', borderRadius: 6, padding: '4px 16px', cursor: 'pointer', fontWeight: 600, color: playing ? 'var(--gray-700)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{playing ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> : <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>}</button>
        <button onClick={handleNext} disabled={currentStep >= total - 1} style={{ background: 'none', border: '1px solid var(--gray-200)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', color: 'var(--gray-600)', opacity: currentStep >= total - 1 ? 0.4 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg></button>

        <div ref={progressRef}
          onMouseDown={handleProgressMouseDown}
          onTouchStart={handleProgressMouseDown}
          style={{ flex: 1, minWidth: 80, height: dragging ? 8 : 4, background: 'var(--gray-200)', borderRadius: 4, margin: '0 8px', cursor: 'pointer', position: 'relative', transition: 'height 0.15s ease' }}>
          <div style={{ width: `${Math.min(100, fineProgress * 100)}%`, height: '100%', background: 'var(--primary)', borderRadius: 4, pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', left: `${Math.min(100, fineProgress * 100)}%`, top: '50%', transform: 'translate(-50%, -50%)', width: 10, height: 10, borderRadius: '50%', background: 'var(--primary)', border: '2px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,0.3)', pointerEvents: 'none' }} />
        </div>

        <span style={{ fontSize: 12, color: 'var(--gray-500)', fontFamily: 'monospace', whiteSpace: 'nowrap', minWidth: 48, textAlign: 'center' }}>{formatTime(totalElapsedSec)}</span>
        <button onClick={toggleFullscreen} style={{ background: 'none', border: '1px solid var(--gray-200)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12, color: 'var(--gray-500)', display: 'flex', alignItems: 'center', gap: 3 }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg> 全屏</button>
        <button onClick={() => setExpanded(!expanded)} style={{ background: 'none', border: '1px solid var(--gray-200)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12, color: 'var(--gray-500)' }}>{expanded ? '收起' : '脚本'}</button>
        <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>空格暂停 · F 全屏</span>
      </div>

      {expanded && (
        <div style={{ border: '1px solid var(--gray-200)', borderRadius: 8, padding: 12, maxHeight: 200, overflowY: 'auto', fontSize: '0.8125rem', lineHeight: 1.6, background: 'var(--gray-50, #f9fafb)' }}>
          <div style={{ fontWeight: 600, marginBottom: 4, fontSize: '0.75rem', color: 'var(--gray-500)' }}>口播稿</div>
          <MarkdownRenderer content={data.script} />
        </div>
      )}

      <style>{`
        @keyframes vpPulse { 0%, 100% { opacity: 0.06; transform: scale(1); } 50% { opacity: 0.2; transform: scale(1.5); } }
        @keyframes vpCardFlip { 0% { opacity: 0; transform: rotateY(-15deg) scale(0.92); } 60% { opacity: 1; transform: rotateY(3deg) scale(1.01); } 100% { opacity: 1; transform: rotateY(0) scale(1); } }
        @keyframes vpDepthZoom { 0% { opacity: 0; transform: perspective(800px) translateZ(-200px) scale(0.8); } 100% { opacity: 1; transform: perspective(800px) translateZ(0) scale(1); } }
        @keyframes vpSlideSpread { 0% { opacity: 0; transform: translateX(40px) scale(0.96); clip-path: inset(0 100% 0 0); } 60% { clip-path: inset(0 0% 0 0); } 100% { opacity: 1; transform: translateX(0) scale(1); } }
        @keyframes vpGlowFade { 0% { opacity: 0; filter: blur(8px) brightness(1.5); } 50% { filter: blur(0) brightness(1.1); } 100% { opacity: 1; filter: blur(0) brightness(1); } }
      `}</style>
    </div>
  )
}

/** ECharts 图表组件（独立组件，避免 hooks 规则冲突） */
function EChartComponent({ chartData, stepIdx }: { chartData: any; stepIdx: number }) {
  const id = `ve-${stepIdx}`
  const chartRef = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    const el = document.getElementById(id)
    if (!el || typeof echarts === 'undefined') return
    if (!chartRef.current) chartRef.current = echarts.init(el)
    const chart = chartRef.current

    const ctype = chartData?.type || 'bar'
    const title = chartData?.title || ''
    const tc = 'rgba(255,255,255,0.85)'
    const isPie = ctype === 'pie' || ctype === 'donut'

    const option: any = {
      backgroundColor: 'transparent',
      ...(title ? { title: { text: title, left: 'center', textStyle: { color: tc, fontSize: 14 } } } : {}),
    }
    if (isPie) {
      option.tooltip = { trigger: 'item' }
      option.legend = { bottom: 5, textStyle: { color: tc, fontSize: 11 } }
      option.series = [{
        type: 'pie',
        radius: ctype === 'donut' ? ['40%', '65%'] : ['0%', '70%'],
        center: ['50%', '55%'],
        data: (chartData?.labels || []).map((l: string, i: number) => ({ name: l, value: (chartData?.values || [])[i] || 0 })),
        label: { color: tc, fontSize: 12 },
        itemStyle: { borderRadius: 4 },
      }]
    } else {
      option.tooltip = { trigger: 'axis' }
      option.grid = { left: 45, right: 15, bottom: 30, top: 40 }
      option.xAxis = { type: 'category', data: chartData?.labels || [], axisLabel: { color: tc, fontSize: 11 } }
      option.yAxis = { type: 'value', axisLabel: { color: tc, fontSize: 10 }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } } }
      option.series = [{
        type: ctype === 'line' ? 'line' : 'bar',
        data: chartData?.values || [],
        itemStyle: ctype === 'line' ? { color: '#4fc3f7' } : { color: '#4fc3f7', borderRadius: [4, 4, 0, 0] },
        lineStyle: ctype === 'line' ? { color: '#4fc3f7', width: 2 } : undefined,
        areaStyle: ctype === 'line' ? { color: 'rgba(79,195,247,0.15)' } : undefined,
        symbol: ctype === 'line' ? 'circle' : 'none',
        smooth: ctype === 'line',
      }]
    }
    chart.setOption(option, true)
    const onResize = () => { if (chart && !chart.isDisposed()) chart.resize() }
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      if (chart && !chart.isDisposed()) { chart.dispose(); chartRef.current = null }
    }
  }, [id, chartData])

  if (!chartData?.labels?.length || !chartData?.values?.length) return null
  return <div id={id} style={{ width: '90%', maxWidth: 500, height: 260, margin: '0 auto 10px' }} />
}
