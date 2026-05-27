import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import KnowledgeGraph from '../components/KnowledgeGraph'
import RecommendationPanel from '../components/RecommendationPanel'
import { pathApi, type PathNodeStatus, type AgentRecommendation, type DagData } from '../api/path'
import { CheckCircleIcon, RefreshIcon, ClockIcon, FlagIcon, FileTextIcon, BookIcon, BotIcon, BrainIcon, BookOpenIcon, EditIcon, AlertTriangleIcon, ArrowRightIcon, CloseIcon } from '../components/Icons'
import { STATUS_LABELS } from '../constants/labels'

const STATUS_ICONS: Record<string, React.ReactNode> = {
  mastered: <CheckCircleIcon size={14} />,
  learning: <RefreshIcon size={14} className="icon-spin" />,
  not_started: <ClockIcon size={14} />,
  reviewing: <FlagIcon size={14} />,
}

const PRIORITY_COLORS: Record<string, string> = {
  high: 'var(--app-danger)',
  normal: 'var(--app-warning)',
  low: 'var(--app-text-secondary)',
}

function groupByDomain(nodes: PathNodeStatus[]): { domain: string; nodes: PathNodeStatus[] }[] {
  const map = new Map<string, PathNodeStatus[]>()
  for (const n of nodes) {
    const key = n.domain_name || '未分类'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(n)
  }
  return Array.from(map.entries()).map(([domain, items]) => ({ domain, nodes: items }))
}

function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  )
}

export default function LearningPathPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nodes, setNodes] = useState<PathNodeStatus[]>([])
  const [summary, setSummary] = useState<Record<string, number>>({})
  const [dagData, setDagData] = useState<DagData | undefined>(undefined)
  const [recommendations, setRecommendations] = useState<AgentRecommendation[]>([])
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set())
  const [selectedNode, setSelectedNode] = useState<PathNodeStatus | null>(null)
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailData, setDetailData] = useState<any>(null)
  const [studiedSet, setStudiedSet] = useState<Set<string>>(new Set())

  const fetchPath = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await pathApi.getCurrentPath()
      const data = res.data
      setNodes(data.nodes)
      setSummary(data.summary)
      if (data.dag_data?.nodes?.length > 0) {
        setDagData(data.dag_data)
      }

      // Expand all domains by default
      const groups = groupByDomain(data.nodes)
      setExpandedDomains(new Set(groups.map(g => g.domain)))
    } catch (err: any) {
      setError(err.response?.data?.detail || '获取学习路径失败')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchRecommendations = useCallback(async () => {
    try {
      const res = await pathApi.getAgentRecommendations()
      setRecommendations(res.data.recommendations)
    } catch {
      // silent
    }
  }, [])

  // Initialize studiedSet from nodes
  useEffect(() => {
    const studied = new Set(
      nodes.filter(n => n.status !== 'not_started').map(n => n.point_id)
    )
    setStudiedSet(studied)
  }, [nodes])

  // Auto-refresh on page focus
  useEffect(() => {
    const handleFocus = () => {
      fetchPath()
      fetchRecommendations()
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [fetchPath, fetchRecommendations])

  useEffect(() => {
    fetchPath()
    fetchRecommendations()
  }, [fetchPath, fetchRecommendations])

  const handleNodeClick = async (node: PathNodeStatus) => {
    setSelectedNode(node)
    setDetailDrawerOpen(true)
    setDetailLoading(true)

    // Fetch detail
    try {
      const res = await pathApi.getKnowledgeDetail(node.point_id)
      setDetailData(res.data)
    } catch {
      setDetailData(null)
    }
    setDetailLoading(false)
  }

  const handleToggleStudy = async (pointId: string) => {
    const isStudied = studiedSet.has(pointId)
    try {
      await pathApi.recordKnowledgeStudy(pointId, 30, isStudied ? 'unmark' : 'mark')
      setStudiedSet(prev => {
        const next = new Set(prev)
        if (isStudied) next.delete(pointId)
        else next.add(pointId)
        return next
      })
      fetchPath()
    } catch {
      // silent
    }
  }

  const handleDirectPractice = (pointId: string) => {
    // Navigate to bank list first, user selects a bank
    navigate(`/banks?point=${pointId}`)
  }

  const toggleDomain = (name: string) => {
    setExpandedDomains(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const handleAccept = async (rec: AgentRecommendation) => {
    try {
      await pathApi.acceptRecommendation({
        recommendation_type: rec.type,
        point_id: rec.related_point_id ?? undefined,
      })
      setRecommendations(prev => prev.filter(r => r !== rec))
      if (rec.related_point_id) {
        await handleToggleStudy(rec.related_point_id)
      }
      fetchRecommendations()

      // 实践类推荐跳转到练习
      const practiceTypes = ['practice', 'variation_exercise', 'weak_point', 'review', 'ebbinghaus_review', 'breakthrough']
      if (practiceTypes.includes(rec.type) && rec.related_point_id) {
        navigate(`/banks?point=${rec.related_point_id}`)
      }
    } catch {
      // silent
    }
  }

  const handleReject = async (rec: AgentRecommendation) => {
    try {
      await pathApi.rejectRecommendation({
        recommendation_type: rec.type,
        point_id: rec.related_point_id ?? undefined,
      })
      setRecommendations(prev => prev.filter(r => r !== rec))
    } catch {
      // silent
    }
  }

  const handleRefresh = () => {
    fetchPath()
    fetchRecommendations()
  }

  // Build groups for the left tree
  const groups = groupByDomain(nodes)

  // Loading state
  if (loading) {
    return (
      <div style={{ padding: '24px', minHeight: '100vh', background: 'var(--app-bg-page)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <button onClick={() => navigate(-1)} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--app-brand)', cursor: 'pointer', border: 'none', background: 'none', fontSize: '13px', marginBottom: 16 }}>
            <BackIcon /> 返回首页
          </button>
          <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: 24 }}>学习路径</h1>
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--app-text-muted)' }}>加载中...</div>
        </div>
      </div>
    )
  }

  // Error state
  if (error && nodes.length === 0) {
    return (
      <div style={{ padding: '24px', minHeight: '100vh', background: 'var(--app-bg-page)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <button onClick={() => navigate(-1)} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--app-brand)', cursor: 'pointer', border: 'none', background: 'none', fontSize: '13px', marginBottom: 16 }}>
            <BackIcon /> 返回首页
          </button>
          <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: 24 }}>学习路径</h1>
          <div style={{ background: '#fff', borderRadius: 16, padding: '60px', textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
            <p style={{ color: 'var(--app-danger)', marginBottom: 16 }}>{error}</p>
            <button onClick={handleRefresh}
              style={{ padding: '10px 24px', background: 'var(--app-brand)', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer' }}>
              重试
            </button>
          </div>
        </div>
      </div>
    )
  }

  const isEmpty = nodes.length === 0

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--app-bg-page)' }}>
      {/* Header */}
      <div style={{
        padding: '12px 24px', background: '#fff', borderBottom: '1px solid #E5E7EB',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate(-1)} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--app-brand)', cursor: 'pointer', border: 'none', background: 'none', fontSize: '13px' }}>
            <BackIcon /> 返回
          </button>
          <h1 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>个性化学习路径</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={() => navigate('/path/history')}
            style={{ padding: '6px 12px', background: 'transparent', color: 'var(--app-text-secondary)', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: '12px', cursor: 'pointer' }}>
            <FileTextIcon size={14} /> 历史记录
          </button>
          <span style={{ fontSize: '12px', color: 'var(--app-text-muted)' }}>
            总计: {summary.total || 0} 知识点 · 已完成 {summary.mastered || 0} · 学习中 {summary.learning || 0} · 困难 {summary.difficult || 0}
          </span>
          <button onClick={handleRefresh}
            style={{ padding: '6px 16px', background: 'var(--app-brand)', color: '#fff', border: 'none', borderRadius: 8, fontSize: '12px', cursor: 'pointer' }}>
            刷新
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left panel: Knowledge tree + Agent */}
        <div style={{
          width: 360, minWidth: 360, borderRight: '1px solid #E5E7EB',
          background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Knowledge tree */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{
              padding: '10px 16px', fontSize: '13px', fontWeight: 600,
              color: 'var(--app-text-body)', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span><FileTextIcon size={14} /></span> 知识点目录
              {!isEmpty && <span style={{ color: 'var(--app-text-muted)', fontWeight: 400, fontSize: 11 }}>({nodes.length})</span>}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
              {isEmpty ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--app-text-placeholder)', fontSize: '13px' }}>
                  暂无学习路径<br />
                  <span style={{ fontSize: 11 }}>开始练习或学习后，这里将自动生成</span>
                </div>
              ) : (
                groups.map(group => (
                  <div key={group.domain}>
                    <div
                      onClick={() => toggleDomain(group.domain)}
                      style={{
                        padding: '8px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                        fontSize: '13px', fontWeight: 600, color: 'var(--app-text-heading)',
                        borderBottom: '1px solid #F9FAFB',
                        background: expandedDomains.has(group.domain) ? 'var(--app-bg-card-alt)' : '#fff',
                      }}
                    >
                      <span style={{
                        display: 'inline-block', transition: 'transform 0.15s',
                        transform: expandedDomains.has(group.domain) ? 'rotate(90deg)' : 'rotate(0deg)',
                        color: 'var(--app-text-muted)',
                      }}>
                        <ArrowRightIcon size={10} />
                      </span>
                      <BookIcon size={13} /> {group.domain}
                    </div>
                    {expandedDomains.has(group.domain) && group.nodes.map(node => {
                      const icon = node.is_difficult ? <AlertTriangleIcon size={14} /> : node.needs_review ? <FlagIcon size={14} /> : STATUS_ICONS[node.status] || <ClockIcon size={14} />
                      const isSelected = selectedNode?.point_id === node.point_id
                      return (
                        <div
                          key={node.point_id}
                          onClick={() => handleNodeClick(node)}
                          style={{
                            padding: '6px 16px 6px 40px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                            fontSize: '13px', color: 'var(--app-text-body)', borderBottom: '1px solid #F9FAFB',
                            background: isSelected ? 'var(--app-brand-bg)' : 'transparent',
                          }}
                        >
                          <span>{icon}</span>
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {node.point_name}
                          </span>
                          {node.mastery_score > 0 && (
                            <span style={{
                              fontSize: '10px', padding: '1px 6px', borderRadius: 6,
                              background: node.mastery_score >= 80 ? '#D1FAE5' : node.mastery_score >= 60 ? '#FEF3C7' : '#FEE2E2',
                              color: node.mastery_score >= 80 ? 'var(--app-green-dark)' : node.mastery_score >= 60 ? 'var(--app-amber-dark)' : 'var(--app-danger-dark)',
                            }}>
                              {node.mastery_score}%
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Agent recommendation cards */}
          {recommendations.length > 0 && (
            <div style={{
              borderTop: '2px solid #EEF2FF', padding: '10px 12px', maxHeight: 240, overflowY: 'auto',
              background: 'linear-gradient(180deg, #EEF2FF 0%, #fff 20%)',
            }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--app-brand)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                <BotIcon size={14} /> Agent 建议
              </div>
              {recommendations.map((rec, i) => (
                <div key={i} style={{
                  padding: '10px 12px', marginBottom: 6, borderRadius: 10,
                  background: '#fff', border: `1px solid ${rec.priority === 'high' ? '#FEE2E2' : 'var(--app-border)'}`,
                  borderLeft: `3px solid ${PRIORITY_COLORS[rec.priority] || 'var(--app-text-secondary)'}`,
                }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--app-text-heading)', marginBottom: 2 }}>
                    {rec.title}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--app-text-secondary)', marginBottom: 6, lineHeight: 1.4 }}>
                    {rec.description}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => handleAccept(rec)}
                      style={{ padding: '3px 12px', background: 'var(--app-brand)', color: '#fff', border: 'none', borderRadius: 6, fontSize: '11px', cursor: 'pointer' }}>
                      {rec.action_label}
                    </button>
                    <button onClick={() => handleReject(rec)}
                      style={{ padding: '3px 12px', background: 'var(--app-bg-page)', color: 'var(--app-text-secondary)', border: 'none', borderRadius: 6, fontSize: '11px', cursor: 'pointer' }}>
                      忽略
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Resource Recommendation Panel */}
          <div style={{
            borderTop: '1px solid #E5E7EB', padding: '10px 12px', maxHeight: 300, overflowY: 'auto',
          }}>
            <RecommendationPanel />
          </div>
        </div>

        {/* Right panel: Mindmap */}
        <div style={{ flex: 1, padding: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{
            flex: 1, background: '#fff', borderRadius: 16, overflow: 'hidden',
            boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
          }}>
            {isEmpty ? (
              <div style={{
                display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
                height: '100%', color: 'var(--app-text-placeholder)',
              }}>
                <div style={{ marginBottom: 16, opacity: 0.3 }}><BrainIcon size={48} /></div>
                <p style={{ fontSize: '15px', marginBottom: 8 }}>暂无学习路径</p>
                <p style={{ fontSize: '13px', textAlign: 'center', maxWidth: 300, lineHeight: 1.6 }}>
                  前往题库练习或与 AI 对话，系统将自动为你生成个性化学习路径
                </p>
                <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
                  <button onClick={() => navigate('/banks')} style={{ padding: '8px 20px', background: 'var(--app-brand)', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer' }}>
                    题库练习
                  </button>
                  <button onClick={() => navigate('/chat/new')} style={{ padding: '8px 20px', background: 'var(--app-bg-page)', color: 'var(--app-text-body)', border: 'none', borderRadius: 10, cursor: 'pointer' }}>
                    AI 对话
                  </button>
                </div>
              </div>
            ) : (
              <KnowledgeGraph nodes={nodes} dagData={dagData} onNodeClick={handleNodeClick} />
            )}
          </div>
        </div>
      </div>

      {/* Detail drawer */}
      {detailDrawerOpen && selectedNode && (
        <div style={{
          position: 'fixed', right: 0, top: 0, bottom: 0, width: 380,
          background: '#fff', boxShadow: '-4px 0 20px rgba(0,0,0,0.1)',
          zIndex: 50, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{
            padding: '16px 20px', borderBottom: '1px solid #E5E7EB',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>知识点详情</h3>
            <button onClick={() => { setDetailDrawerOpen(false); setSelectedNode(null) }}
              style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--app-text-muted)', padding: 4 }}>
              <CloseIcon size={20} />
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
            {detailLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--app-text-muted)', fontSize: '13px' }}>加载中...</div>
            ) : detailData ? (
              <div>
                {/* Status badge */}
                <div style={{
                  display: 'inline-block', padding: '3px 12px', borderRadius: 10,
                  fontSize: '12px', fontWeight: 600, marginBottom: 12,
                  background: detailData.status === 'mastered' ? '#D1FAE5' : detailData.status === 'learning' ? '#FEF3C7' : 'var(--app-bg-page)',
                  color: detailData.status === 'mastered' ? 'var(--app-green-dark)' : detailData.status === 'learning' ? 'var(--app-amber-dark)' : 'var(--app-text-secondary)',
                }}>
                  {STATUS_ICONS[detailData.status] || <ClockIcon size={14} />} {STATUS_LABELS[detailData.status] || '未开始'}
                </div>

                <h2 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 4px', color: 'var(--app-text-heading)' }}>
                  {detailData.point_name}
                </h2>
                {detailData.domain_name && (
                  <p style={{ fontSize: '12px', color: 'var(--app-text-muted)', marginBottom: 16 }}>
                    {detailData.domain_name} {detailData.subject_name ? `· ${detailData.subject_name}` : ''}
                  </p>
                )}

                {/* Mastery progress bar */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--app-text-secondary)', marginBottom: 4 }}>
                    <span>掌握度</span>
                    <span style={{
                      fontWeight: 600,
                      color: detailData.mastery_score >= 80 ? 'var(--app-green-dark)' : detailData.mastery_score >= 60 ? 'var(--app-amber-dark)' : 'var(--app-danger-dark)',
                    }}>
                      {detailData.mastery_score}%
                    </span>
                  </div>
                  <div style={{ height: 8, background: 'var(--app-border)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 4,
                      background: detailData.mastery_score >= 80 ? 'var(--app-success)' : detailData.mastery_score >= 60 ? 'var(--app-warning)' : 'var(--app-danger)',
                      width: `${detailData.mastery_score}%`,
                      transition: 'width 0.3s',
                    }} />
                  </div>
                </div>

                {/* Stats grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                  {[
                    { label: '已练习', value: `${detailData.total_practiced} 题` },
                    { label: '正确率', value: `${detailData.recent_accuracy}%` },
                    { label: '连续错误', value: `${detailData.consecutive_errors} 次`, warn: detailData.consecutive_errors >= 3 },
                    { label: '学习次数', value: `${detailData.study_count} 次` },
                    { label: '总学习时长', value: `${Math.floor(detailData.total_time_spent_seconds / 60)} 分` },
                    { label: '最后练习', value: detailData.last_practice_at ? new Date(detailData.last_practice_at).toLocaleDateString('zh-CN') : '未练习' },
                  ].map((stat, i) => (
                    <div key={i} style={{
                      padding: '10px', borderRadius: 8, background: 'var(--app-bg-card-alt)',
                      border: stat.warn ? '1px solid #FEE2E2' : '1px solid transparent',
                    }}>
                      <div style={{ fontSize: '11px', color: 'var(--app-text-muted)', marginBottom: 2 }}>{stat.label}</div>
                      <div style={{
                        fontSize: '14px', fontWeight: 600,
                        color: stat.warn ? 'var(--app-danger)' : 'var(--app-text-heading)',
                      }}>{stat.value}</div>
                    </div>
                  ))}
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => handleToggleStudy(selectedNode.point_id)}
                    style={{
                      flex: 1, padding: '10px',
                      background: studiedSet.has(selectedNode.point_id) ? '#D1FAE5' : 'var(--app-brand-bg)',
                      color: studiedSet.has(selectedNode.point_id) ? 'var(--app-green-dark)' : 'var(--app-brand)',
                      border: studiedSet.has(selectedNode.point_id) ? '1px solid #059669' : 'none',
                      borderRadius: 10, fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                    }}>
                    {studiedSet.has(selectedNode.point_id) ? <><CheckCircleIcon size={14} /> 已学习（点击取消）</> : <><BookOpenIcon size={14} /> 标记已学习</>}
                  </button>
                  <button onClick={() => handleDirectPractice(selectedNode.point_id)}
                    style={{ flex: 1, padding: '10px', background: 'var(--app-brand)', color: '#fff', border: 'none', borderRadius: 10, fontSize: '12px', cursor: 'pointer' }}>
                    <EditIcon size={14} /> 去做题
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--app-text-muted)', fontSize: '13px' }}>
                暂无学习数据
              </div>
            )}
          </div>
        </div>
      )}

      {/* Backdrop for drawer */}
      {detailDrawerOpen && (
        <div
          onClick={() => { setDetailDrawerOpen(false); setSelectedNode(null) }}
          style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.15)' }}
        />
      )}
    </div>
  )
}
