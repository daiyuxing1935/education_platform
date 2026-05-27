import { useState, useEffect } from 'react'
import { pathApi, type PathHistoryItem } from '../api/path'
import { FileTextIcon } from '../components/Icons'
import { PageHeader, EmptyState, LoadingState, ErrorState } from '../components/shared'
import { formatDateTime } from '../utils/time'

export default function PathHistoryPage() {
  const [items, setItems] = useState<PathHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await pathApi.getPathHistory()
      setItems(res.data.items)
    } catch {
      setError('获取路径历史失败')
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--app-bg-page)', padding: '24px 16px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <PageHeader
          backTo="/path"
          title="路径调整历史"
          subtitle={items.length > 0 ? <span style={{ fontSize: '13px', color: 'var(--app-text-muted)' }}>共 {items.length} 条</span> : undefined}
        />

        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={fetchData} />
        ) : items.length === 0 ? (
          <EmptyState icon={<FileTextIcon size={48} />} title="暂无路径调整记录" description="Agent 调整学习路径后，调整记录会显示在这里" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {items.map(item => {
              const isExpanded = expandedId === item.id
              return (
                <div key={item.id} className="card-hover" style={{
                  background: '#fff', borderRadius: 16, padding: '16px 20px',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', color: 'var(--app-text-body)', marginBottom: '4px' }}>
                        {item.agent_reason || '路径调整'}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--app-text-muted)' }}>
                        {formatDateTime(item.created_at)}
                      </div>
                    </div>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      style={{
                        padding: '4px 12px', border: '1px solid #E5E7EB', borderRadius: 8,
                        background: '#fff', cursor: 'pointer', fontSize: '12px', color: 'var(--app-brand)',
                      }}
                    >
                      {isExpanded ? '收起' : '查看详情'}
                    </button>
                  </div>

                  {isExpanded && (
                    <div style={{
                      marginTop: '12px', padding: '14px', background: 'var(--app-bg-card-alt)',
                      borderRadius: 12, border: '1px solid #E5E7EB',
                    }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--app-brand)', marginBottom: '8px' }}>
                        调整快照
                      </div>
                      <pre style={{
                        fontSize: '11px', color: 'var(--app-text-secondary)', lineHeight: 1.6,
                        whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                        margin: 0, fontFamily: 'monospace',
                      }}>
                        {JSON.stringify(item.snapshot_data, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
