import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { questionBankApi } from '../api/questionBank'
import { FileTextIcon } from '../components/Icons'
import { PageHeader, EmptyState, Pagination, LoadingState, ErrorState } from '../components/shared'
import { formatDateTime, formatDuration } from '../utils/time'
import { MODE_LABELS } from '../constants/labels'

export default function TestHistoryPage() {
  const { bankId } = useParams<{ bankId: string }>()
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await questionBankApi.listPracticeSessions({
        bank_id: bankId,
        page,
        page_size: pageSize,
      })
      setSessions(res.data.sessions)
      setTotal(res.data.total)
    } catch {
      setError('加载测试历史失败')
    }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [bankId, page])

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--app-bg-page)', padding: '24px 16px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <PageHeader
          backTo={bankId ? `/banks/${bankId}` : '/banks'}
          title="测试历史"
          subtitle={total > 0 ? <span style={{ fontSize: '13px', color: 'var(--app-text-muted)' }}>共 {total} 条记录</span> : undefined}
        />

        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} />
        ) : sessions.length === 0 ? (
          <EmptyState icon={<FileTextIcon size={48} />} title="暂无测试记录" description="完成一次练习后，记录会显示在这里" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {sessions.map(s => {
              const totalQ = s.stats?.total || 0
              const correct = s.stats?.correct || 0
              const incorrect = s.stats?.incorrect || 0
              const answered = correct + incorrect
              const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0
              const isCompleted = s.status === 'completed'

              return (
                <div key={s.id} onClick={() => navigate(`/banks/${s.bank_id}/history/${s.id}`)}
                  style={{
                    background: '#fff', borderRadius: 14, padding: '16px 20px',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.04)', cursor: 'pointer',
                    transition: 'box-shadow 0.15s',
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--app-text-heading)', marginBottom: '4px' }}>
                        {MODE_LABELS[s.mode] || s.mode}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--app-text-muted)' }}>
                        {formatDateTime(s.started_at)}
                        {isCompleted && s.finished_at && (
                          <span> · {formatDuration(s.started_at, s.finished_at)}</span>
                        )}
                      </div>
                    </div>
                    {isCompleted && (
                      <div style={{
                        padding: '4px 14px', borderRadius: 12, fontSize: '13px', fontWeight: 700,
                        background: accuracy >= 80 ? 'rgba(16,185,129,0.1)' : accuracy >= 60 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                        color: accuracy >= 80 ? 'var(--app-success)' : accuracy >= 60 ? 'var(--app-warning)' : 'var(--app-danger)',
                      }}>
                        {accuracy}%
                      </div>
                    )}
                    {!isCompleted && (
                      <div style={{ padding: '4px 14px', borderRadius: 12, fontSize: '12px', background: 'var(--app-bg-page)', color: 'var(--app-text-muted)' }}>
                        未完成
                      </div>
                    )}
                  </div>
                  {isCompleted && (
                    <div style={{ display: 'flex', gap: '20px', fontSize: '13px' }}>
                      <span>总题: <strong>{totalQ}</strong></span>
                      <span style={{ color: 'var(--app-success)' }}>正确: <strong>{correct}</strong></span>
                      <span style={{ color: 'var(--app-danger)' }}>错误: <strong>{incorrect}</strong></span>
                    </div>
                  )}
                  {isCompleted && totalQ > 0 && (
                    <div style={{ marginTop: '8px', height: 4, background: 'var(--app-border)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(correct / totalQ) * 100}%`, background: accuracy >= 80 ? 'var(--app-success)' : accuracy >= 60 ? 'var(--app-warning)' : 'var(--app-danger)', borderRadius: 2 }} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>
    </div>
  )
}
