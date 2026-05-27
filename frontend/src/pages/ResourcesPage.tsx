import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { resourcesApi } from '../api/resources'
import type { KnowledgePointGroup, ResourceListItem } from '../api/resources'
import VideoGenModal from '../components/VideoGenModal'
import { FolderIcon, VideoIcon, BarChartIcon } from '../components/Icons'

/* ── Icons ── */
function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
    </svg>
  )
}
function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}
function DeleteIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}
function MapIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
    </svg>
  )
}

/* ── Modal (simple inline) ── */
function Modal({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 2000,
      backdropFilter: 'blur(2px)',
    }}>
      <div style={{
        backgroundColor: 'white', borderRadius: 12, padding: 24,
        width: '90%', maxWidth: 420, maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
      }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>{title}</h2>
        {children}
      </div>
    </div>
  )
}

export default function ResourcesPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialKp = searchParams.get('kp') || ''

  const [groups, setGroups] = useState<KnowledgePointGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState(initialKp)
  const [generateModal, setGenerateModal] = useState(false)
  const [videoGenModal, setVideoGenModal] = useState(false)
  const [genKps, setGenKps] = useState('')
  const [genTitle, setGenTitle] = useState('')
  const [generating, setGenerating] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await resourcesApi.listKnowledgePoints()
      setGroups(res.data.knowledge_points)
    } catch (e) {
      console.error('加载资源失败', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除该资源吗？')) return
    try {
      await resourcesApi.delete(id)
      loadData()
    } catch (e) {
      console.error('删除失败', e)
    }
  }

  const handleGenerate = async () => {
    const kpList = genKps.split(/[,，、\n]/).map(s => s.trim()).filter(Boolean)
    if (kpList.length === 0) return
    setGenerating(true)
    try {
      const res = await resourcesApi.generate({
        knowledge_points: kpList,
        title: genTitle || undefined,
      })
      if (res.data.id) {
        setGenerateModal(false)
        setGenKps('')
        setGenTitle('')
        loadData()
        navigate(`/resources/${res.data.id}`)
      }
    } catch (e: any) {
      alert(e.response?.data?.detail || '生成失败，请检查 API 配置')
    } finally {
      setGenerating(false)
    }
  }

  const filteredGroups = filter
    ? groups.filter(g => g.name.includes(filter))
    : groups

  return (
    <div style={{ padding: 'var(--space-6) var(--space-8)' }}>
      {/* Header */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--gray-500)', fontSize: '0.875rem', marginBottom: 'var(--space-2)' }}>
          <BackIcon /> 返回首页
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-heading)' }}>
            个性化学习资源
          </h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => setVideoGenModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
              生成视频
            </button>
            <button className="btn btn-primary" onClick={() => setGenerateModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <PlusIcon /> 生成思维导图
            </button>
          </div>
        </div>
        <input
          type="text" placeholder="搜索知识点..."
          value={filter} onChange={e => setFilter(e.target.value)}
          style={{
            marginTop: 'var(--space-3)', padding: '6px 12px', width: '100%', maxWidth: 360,
            border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-md)',
            fontSize: '0.875rem', outline: 'none',
          }}
        />
      </div>

      {/* Loading */}
      {loading && <div style={{ textAlign: 'center', padding: 40, color: 'var(--gray-400)' }}>加载中...</div>}

      {/* Empty state */}
      {!loading && filteredGroups.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--gray-400)' }}>
          <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.5 }}><MapIcon /></div>
          <p style={{ fontSize: '1rem', marginBottom: 8 }}>暂无学习资源</p>
          <p style={{ fontSize: '0.875rem', color: 'var(--gray-400)', marginBottom: 'var(--space-4)' }}>
            在 AI 对话中提问知识点，或在题库练习中答错后，系统会自动生成思维导图
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center' }}>
            <Link to="/chat/new" className="btn btn-primary">AI 对话</Link>
            <Link to="/banks" className="btn btn-secondary">前往题库</Link>
          </div>
        </div>
      )}

      {/* Groups */}
      {!loading && filteredGroups.map(group => (
        <section key={group.name} style={{ marginBottom: 'var(--space-6)' }}>
          <h2 style={{
            fontSize: '1rem', fontWeight: 600, marginBottom: 'var(--space-3)',
            color: 'var(--gray-700)', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <FolderIcon size={14} color="var(--primary)" />
            {group.name}
            <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)', fontWeight: 400 }}>
              （{group.resource_count} 个资源）
            </span>
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-3)' }}>
            {group.resources.map(resource => (
              <ResourceCard
                key={resource.id}
                resource={resource}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </section>
      ))}

      {/* Generate Mind Map Modal */}
      {generateModal && (
        <Modal title="生成思维导图">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: '0.8125rem', color: 'var(--gray-600)', marginBottom: 4, display: 'block' }}>
                知识点名称
              </label>
              <textarea
                value={genKps} onChange={e => setGenKps(e.target.value)}
                placeholder="输入知识点名称，多个用逗号隔开"
                rows={3}
                style={{
                  width: '100%', padding: '8px 10px', border: '1px solid var(--gray-200)',
                  borderRadius: 'var(--radius-md)', fontSize: '0.875rem', outline: 'none',
                  resize: 'vertical',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8125rem', color: 'var(--gray-600)', marginBottom: 4, display: 'block' }}>
                标题（可选）
              </label>
              <input
                type="text" value={genTitle} onChange={e => setGenTitle(e.target.value)}
                placeholder="如：Python 核心知识"
                style={{
                  width: '100%', padding: '8px 10px', border: '1px solid var(--gray-200)',
                  borderRadius: 'var(--radius-md)', fontSize: '0.875rem', outline: 'none',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <button className="btn btn-secondary" onClick={() => setGenerateModal(false)} disabled={generating}>
                取消
              </button>
              <button className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
                {generating ? '生成中...' : '开始生成'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Generate Video Modal */}
      {videoGenModal && (
        <VideoGenModal
          onClose={() => setVideoGenModal(false)}
          onDone={(resourceId) => {
            setVideoGenModal(false)
            loadData()
            navigate(`/resources/${resourceId}`)
          }}
        />
      )}
    </div>
  )
}

/* ── Resource Card ── */
function ResourceCard({ resource, onDelete }: { resource: ResourceListItem; onDelete: (id: string) => void }) {
  const navigate = useNavigate()
  const sourceLabels: Record<string, string> = {
    chat_gap: 'AI对话自动生成',
    wrong_answer: '答题推荐',
    manual: '手动生成',
  }

  return (
    <div className="card" style={{
      padding: 'var(--space-4)', cursor: 'pointer',
      transition: 'all 0.15s', position: 'relative',
    }}
      onClick={() => navigate(`/resources/${resource.id}`)}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.boxShadow = '' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            {resource.resource_type === 'video' ? <VideoIcon size={18} /> : <BarChartIcon size={18} />}
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {resource.title}
            </h3>
            {resource.resource_type === 'video' && (
              <span style={{ fontSize: '0.625rem', padding: '1px 5px', borderRadius: 8, background: '#fef3c7', color: '#d97706' }}>视频</span>
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
            {(resource.knowledge_points || []).map(kp => (
              <span key={kp} style={{
                fontSize: '0.6875rem', padding: '1px 6px', borderRadius: 10,
                backgroundColor: 'oklch(0.55 0.2 250 / 0.1)', color: 'var(--primary)',
              }}>
                {kp}
              </span>
            ))}
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--gray-400)', margin: 0 }}>
            {sourceLabels[resource.source || ''] || resource.source || '未知来源'}
            {' · '}
            {resource.created_at ? new Date(resource.created_at).toLocaleDateString('zh-CN') : ''}
          </p>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onDelete(resource.id) }}
          title="删除"
          style={{
            background: 'none', border: 'none', cursor: 'pointer', color: '#ccc',
            padding: '4px 6px', borderRadius: 4, fontSize: '0.875rem', flexShrink: 0,
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--app-danger)'; e.currentTarget.style.background = 'var(--app-bg-danger)' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#ccc'; e.currentTarget.style.background = 'none' }}
        >
          <DeleteIcon />
        </button>
      </div>
    </div>
  )
}
