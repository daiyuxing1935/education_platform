import React, { useState, useEffect, useCallback } from 'react'
import { TargetIcon, TrendingUpIcon, BarChartIcon, StarIcon, BrainIcon, VideoIcon, BookOpenIcon, BookmarkIcon, PaletteIcon, FileTextIcon, FileIcon, CheckCircleIcon, ArrowRightIcon, ClockIcon, LinkIcon, RefreshIcon, LayersIcon, EditIcon, PuzzleIcon } from './Icons'
import { recommendApi, type Recommendation } from '../api/recommend'

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  weak_point: { label: '薄弱点攻克', color: '#e74c3c', icon: <TargetIcon size={16} /> },
  ebbinghaus_review: { label: '复习提醒', color: '#f39c12', icon: <ClockIcon size={16} /> },
  knowledge_chain: { label: '继续学习', color: '#3498db', icon: <LinkIcon size={16} /> },
  variation_exercise: { label: '变式练习', color: '#9b59b6', icon: <RefreshIcon size={16} /> },
  difficulty_adjust: { label: '难度调整', color: '#1abc9c', icon: <TrendingUpIcon size={16} /> },
  periodic_summary: { label: '学习报告', color: '#2ecc71', icon: <BarChartIcon size={16} /> },
  fatigue_recovery: { label: '疲劳调节', color: '#e67e22', icon: <CheckCircleIcon size={16} /> },
  important_resource: { label: '重要推荐', color: '#e84393', icon: <StarIcon size={16} /> },
}

export default function RecommendationPanel() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const loadRecommendations = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await recommendApi.getAll()
      setRecommendations(response.data.recommendations || [])
    } catch (err: any) {
      console.error('加载推荐失败:', err)
      setError(err.response?.data?.detail || '加载推荐失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadRecommendations()
  }, [loadRecommendations])

  const handleDismiss = (rec: Recommendation) => {
    const key = `${rec.type}-${rec.knowledge_point || ''}`
    setDismissedIds(prev => new Set(prev).add(key))
    recommendApi.ignoreType(rec.type).catch(() => {})
  }

  const toggleExpand = (idx: number) => {
    setExpandedId(prev => prev === `${idx}` ? null : `${idx}`)
  }

  const visibleRecs = recommendations.filter(
    r => !dismissedIds.has(`${r.type}-${r.knowledge_point || ''}`)
  )

  if (loading) {
    return (
      <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--gray-400)', fontSize: '0.875rem' }}>
        <div style={{ marginBottom: 'var(--space-2)' }}>●</div>
        加载个性化推荐...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 'var(--space-3)', fontSize: '0.8125rem', color: 'var(--danger)', textAlign: 'center' }}>
        {error}
        <button onClick={loadRecommendations} className="btn btn-secondary" style={{ marginLeft: '0.5rem', padding: '0.125rem 0.5rem', fontSize: '0.75rem' }}>
          重试
        </button>
      </div>
    )
  }

  if (visibleRecs.length === 0) {
    return (
      <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--gray-400)', fontSize: '0.8125rem' }}>
        <div style={{ marginBottom: 'var(--space-2)' }}><CheckCircleIcon size={24} /></div>
        暂无推荐，继续加油！
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 var(--space-1)' }}>
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--gray-600)', fontFamily: 'var(--font-heading)' }}>
          个性化推荐 ({visibleRecs.length})
        </span>
        <button
          onClick={loadRecommendations}
          className="btn btn-secondary"
          style={{ padding: '0.125rem 0.5rem', fontSize: '0.7rem' }}
          title="刷新推荐"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          刷新
        </button>
      </div>

      {visibleRecs.map((rec, idx) => {
        const config = TYPE_CONFIG[rec.type] || { label: '推荐', color: '#95a5a6', icon: <BookmarkIcon size={16} /> }
        const isExpanded = expandedId === `${idx}`
        const recKey = `${rec.type}-${rec.knowledge_point || ''}`

        return (
          <div
            key={recKey}
            className="fade-in"
            style={{
              borderRadius: 'var(--radius-lg)',
              border: `1px solid ${config.color}22`,
              backgroundColor: 'white',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-sm)',
              transition: 'box-shadow 0.15s',
            }}
          >
            {/* Header */}
            <div
              onClick={() => toggleExpand(idx)}
              style={{
                padding: '0.625rem 0.75rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                borderBottom: isExpanded ? `1px solid ${config.color}11` : 'none',
              }}
            >
              <span style={{ flexShrink: 0 }}>{config.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: 'var(--gray-800)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {rec.title}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginTop: '2px' }}>
                  <span style={{
                    fontSize: '0.6rem',
                    padding: '1px 5px',
                    borderRadius: '3px',
                    backgroundColor: `${config.color}18`,
                    color: config.color,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}>
                    {config.label}
                  </span>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--gray-400)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {rec.reason}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                <span style={{
                  fontSize: '0.6rem',
                  padding: '1px 5px',
                  borderRadius: '3px',
                  backgroundColor: rec.priority >= 60 ? `${config.color}22` : 'var(--gray-50)',
                  color: rec.priority >= 60 ? config.color : 'var(--gray-400)',
                  fontWeight: 600,
                }}>
                  P{Math.floor(rec.priority / 10)}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDismiss(rec) }}
                  title="忽略此推荐"
                  style={{ padding: '2px', border: 'none', background: 'none', color: 'var(--gray-300)', cursor: 'pointer', fontSize: '0.8rem', lineHeight: 1 }}
                >
                  ×
                </button>
              </div>
            </div>

            {/* Expanded content */}
            {isExpanded && (
              <div style={{ padding: '0.625rem 0.75rem', fontSize: '0.75rem' }}>
                {/* Reason */}
                <div style={{ color: 'var(--gray-600)', marginBottom: 'var(--space-2)', lineHeight: 1.5 }}>
                  {rec.reason}
                </div>

                {/* Resources */}
                {rec.resources.length > 0 && (
                  <div style={{ marginBottom: 'var(--space-2)' }}>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--gray-400)', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      相关资源
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {rec.resources.map((res, ri) => (
                        <div
                          key={ri}
                          style={{
                            padding: '0.375rem 0.5rem',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: 'var(--gray-50)',
                            border: '1px solid var(--gray-100)',
                            fontSize: '0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.375rem',
                          }}
                        >
                          <ResourceIcon type={res.resource_type} />
                          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--gray-700)' }}>
                            {res.title}
                          </span>
                          {res.difficulty && (
                            <span style={{ fontSize: '0.65rem', color: 'var(--gray-400)' }}>
                              Lv.{res.difficulty}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suggested actions */}
                {rec.suggested_actions.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--gray-400)', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      建议操作
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      {rec.suggested_actions.map((action, ai) => (
                        <button
                          key={ai}
                          onClick={(e) => {
                            e.stopPropagation()
                            const actionLower = action.toLowerCase()
                            if (actionLower.includes('练习') || actionLower.includes('练习')) {
                              window.location.href = '/banks'
                            } else if (actionLower.includes('学习') || actionLower.includes('路径')) {
                              window.location.href = '/path'
                            } else if (actionLower.includes('对话') || actionLower.includes('ai')) {
                              window.location.href = '/chat/new'
                            } else if (actionLower.includes('资源')) {
                              window.location.href = '/resources'
                            }
                          }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '4px',
                            color: 'var(--app-indigo)', fontSize: '0.75rem',
                            background: 'none', border: 'none', cursor: 'pointer',
                            padding: '2px 0', textAlign: 'left',
                            textDecoration: 'underline',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.color = '#4F46E5' }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'var(--app-indigo)' }}
                        >
                          <ArrowRightIcon size={11} color={config.color} />
                          {action}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ResourceIcon({ type }: { type: string }) {
  const icons: Record<string, React.ReactNode> = {
    mind_map: <BrainIcon size={14} />,
    video: <VideoIcon size={14} />,
    flash_card: <LayersIcon size={14} />,
    explanation: <BookOpenIcon size={14} />,
    review_question: <EditIcon size={14} />,
    memory_card: <BookmarkIcon size={14} />,
    variation_exercise: <RefreshIcon size={14} />,
    knowledge_comic: <PaletteIcon size={14} />,
    infographic: <BarChartIcon size={14} />,
    summary_report: <FileTextIcon size={14} />,
    question: <PuzzleIcon size={14} />,
  }
  return <span style={{ fontSize: '0.9rem' }}>{icons[type] || <FileIcon size={14} />}</span>
}
