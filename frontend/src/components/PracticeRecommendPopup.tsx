import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { pathApi, type AgentRecommendation } from '../api/path'
import { recommendApi, type Recommendation } from '../api/recommend'

interface PracticeRecommendPopupProps {
  answerCount: number
  subjectId?: string
}

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  weak_point: { label: '薄弱点', color: 'var(--app-danger)', bg: 'rgba(239, 68, 68, 0.12)' },
  ebbinghaus_review: { label: '待复习', color: 'var(--app-warning)', bg: 'rgba(245, 158, 11, 0.12)' },
  knowledge_chain: { label: '继续学习', color: 'var(--app-info)', bg: 'rgba(59, 130, 246, 0.12)' },
  variation_exercise: { label: '变式练习', color: 'var(--app-purple)', bg: 'rgba(139, 92, 246, 0.12)' },
  difficulty_adjust: { label: '难度调整', color: '#EC4899', bg: 'rgba(236, 72, 153, 0.12)' },
  periodic_summary: { label: '周总结', color: '#14B8A6', bg: 'rgba(20, 184, 166, 0.12)' },
  fatigue_recovery: { label: '休息建议', color: '#F97316', bg: 'rgba(249, 115, 22, 0.12)' },
  important_resource: { label: '重要资源', color: '#06B6D4', bg: 'rgba(6, 182, 212, 0.12)' },
  review: { label: '复习', color: 'var(--app-warning)', bg: 'rgba(245, 158, 11, 0.12)' },
  practice: { label: '练习', color: 'var(--app-purple)', bg: 'rgba(139, 92, 246, 0.12)' },
  study: { label: '学习', color: 'var(--app-info)', bg: 'rgba(59, 130, 246, 0.12)' },
  unlock: { label: '解锁', color: 'var(--app-success)', bg: 'rgba(16, 185, 129, 0.12)' },
  breakthrough: { label: '攻克难点', color: 'var(--app-danger)', bg: 'rgba(239, 68, 68, 0.12)' },
}

export default function PracticeRecommendPopup({ answerCount, subjectId }: PracticeRecommendPopupProps) {
  const navigate = useNavigate()
  const [recommendation, setRecommendation] = useState<(AgentRecommendation | Recommendation) | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [visible, setVisible] = useState(false)
  const [exiting, setExiting] = useState(false)
  const lastCheckRef = useRef(0)

  const checkRecommendations = useCallback(async () => {
    if (dismissed) return
    try {
      const params = subjectId ? { subject_id: subjectId } : undefined
      const [agentRes, recRes] = await Promise.allSettled([
        pathApi.getAgentRecommendations(params),
        recommendApi.getAll(params),
      ])

      if (agentRes.status === 'fulfilled' && agentRes.value.data.recommendations?.length > 0) {
        const agentRecs = agentRes.value.data.recommendations
        const top = agentRecs[0]
        if (top.priority === 'high' || (top as any).priority >= 60) {
          setRecommendation(top)
          setVisible(true)
          setExiting(false)
          return
        }
      }

      if (recRes.status === 'fulfilled' && recRes.value.data.recommendations?.length > 0) {
        const recs = recRes.value.data.recommendations
        const highPriority = recs.filter(r => r.priority >= 60)
        if (highPriority.length > 0) {
          setRecommendation(highPriority[0] as any)
          setVisible(true)
          setExiting(false)
        }
      }
    } catch {
      // silent
    }
  }, [dismissed])

  useEffect(() => {
    if (answerCount === 0) return
    const now = Date.now()
    if (answerCount % 3 === 0 && now - lastCheckRef.current > 10000) {
      lastCheckRef.current = now
      checkRecommendations()
    }
  }, [answerCount, checkRecommendations])

  const handleDismiss = () => {
    setExiting(true)
    setTimeout(() => {
      setVisible(false)
      setExiting(false)
      setDismissed(true)
      setTimeout(() => setDismissed(false), 120000)
    }, 250)
  }

  const handleViewQuestions = () => {
    setExiting(true)
    setTimeout(() => {
      setVisible(false)
      setExiting(false)
      navigate('/path')
    }, 200)
  }

  if (!visible || !recommendation) return null

  const rec = recommendation as any
  const recType = rec.type || ''
  const typeConf = TYPE_CONFIG[recType] || { label: '学习建议', color: 'var(--app-text-secondary)', bg: 'rgba(107, 114, 128, 0.1)' }
  const title = rec.title || '学习建议'
  const reason = rec.reason || rec.description || ''

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      width: '340px',
      maxHeight: '220px',
      zIndex: 5000,
      animation: exiting ? 'popupExit 0.25s ease-in forwards' : 'popupEnter 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
    }}>
      {/* Glassmorphism card */}
      <div style={{
        position: 'relative',
        background: 'rgba(255, 255, 255, 0.75)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.3)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06)',
        overflow: 'hidden',
      }}>
        {/* Colored top accent */}
        <div style={{
          height: '3px',
          background: `linear-gradient(90deg, ${typeConf.color}, ${typeConf.color}88)`,
        }} />

        <div style={{ padding: '14px 16px 12px' }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '10px',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <span style={{
                display: 'inline-flex',
                padding: '3px 10px',
                borderRadius: '20px',
                fontSize: '0.6875rem',
                fontWeight: 600,
                color: typeConf.color,
                background: typeConf.bg,
              }}>
                {typeConf.label}
              </span>
            </div>
            <button
              onClick={handleDismiss}
              style={{
                border: 'none',
                background: 'rgba(0,0,0,0.04)',
                cursor: 'pointer',
                color: 'var(--app-text-muted)',
                fontSize: '0.875rem',
                padding: '2px 8px',
                lineHeight: 1.4,
                borderRadius: '12px',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.08)'; e.currentTarget.style.color = 'var(--app-text-secondary)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; e.currentTarget.style.color = 'var(--app-text-muted)' }}
            >
              ✕ 关闭
            </button>
          </div>

          {/* Title */}
          <div style={{
            fontSize: '0.875rem',
            fontWeight: 700,
            color: 'var(--app-text-heading)',
            marginBottom: '6px',
            lineHeight: 1.4,
          }}>
            {title}
          </div>

          {/* Reason */}
          <div style={{
            fontSize: '0.75rem',
            color: 'var(--app-text-secondary)',
            lineHeight: 1.5,
            marginBottom: '12px',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {reason}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleViewQuestions}
              style={{
                flex: 1,
                padding: '8px 16px',
                border: 'none',
                borderRadius: '10px',
                background: typeConf.color,
                color: 'white',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 4px 12px ${typeConf.color}44` }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
            >
              查看详情
            </button>
            <button
              onClick={handleDismiss}
              style={{
                padding: '8px 14px',
                border: '1px solid #E5E7EB',
                borderRadius: '10px',
                background: 'rgba(255,255,255,0.5)',
                color: 'var(--app-text-secondary)',
                fontSize: '0.75rem',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.8)'; e.currentTarget.style.borderColor = 'var(--app-text-placeholder)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.5)'; e.currentTarget.style.borderColor = 'var(--app-border)' }}
            >
              稍后再说
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes popupEnter {
          from {
            transform: translateX(40px) translateY(20px) scale(0.95);
            opacity: 0;
          }
          to {
            transform: translateX(0) translateY(0) scale(1);
            opacity: 1;
          }
        }
        @keyframes popupExit {
          from {
            transform: translateX(0) translateY(0) scale(1);
            opacity: 1;
          }
          to {
            transform: translateX(30px) translateY(10px) scale(0.95);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}
