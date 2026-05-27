import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { questionBankApi, type WrongAnswerItem, type QuestionItem } from '../api/questionBank'
import { BookmarkIcon } from '../components/Icons'
import MarkdownRenderer from '../components/MarkdownRenderer'
import { PageHeader, EmptyState, Pagination, LoadingState, ErrorState } from '../components/shared'
import { QTYPE_LABELS } from '../constants/labels'

export default function WrongAnswerPage() {
  const navigate = useNavigate()
  const { bankId: paramsBankId } = useParams<{ bankId: string }>()
  const [items, setItems] = useState<WrongAnswerItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [banks, setBanks] = useState<{ id: string; name: string }[]>([])
  const [selectedBankId, setSelectedBankId] = useState(paramsBankId || '')

  const loadBanks = async () => {
    try {
      const res = await questionBankApi.listBanks({ page_size: 100 })
      setBanks(res.data.banks)
    } catch { /* ignore */ }
  }

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await questionBankApi.listWrongAnswers({
        bank_id: selectedBankId || undefined,
        page,
        page_size: pageSize,
      })
      setItems(res.data.items)
      setTotal(res.data.total)
    } catch {
      setError('加载错题本失败')
    }
    setLoading(false)
  }

  useEffect(() => { if (!paramsBankId) loadBanks(); else loadData() }, [])
  useEffect(() => { loadData() }, [selectedBankId, page])

  const handleRemove = async (recordId: string) => {
    try {
      await questionBankApi.removeWrongAnswer(recordId)
      setItems(prev => prev.filter(i => i.id !== recordId))
      setTotal(prev => prev - 1)
    } catch {
      alert('移出错题本失败')
    }
  }

  const handleGeneratePractice = async () => {
    if (!selectedBankId) { alert('请先选择一个题库'); return }
    try {
      const res = await questionBankApi.generatePracticeFromWrongAnswers({
        bank_id: selectedBankId,
      })
      if (res.data.length === 0) { alert('该题库暂无错题'); return }
      const sessionRes = await questionBankApi.createPracticeSession(selectedBankId, {
        mode: 'random',
        answer_mode: 'during',
        question_order: res.data.map((q: QuestionItem) => q.id),
      })
      navigate(`/banks/${selectedBankId}/practice?session_id=${sessionRes.data.id}`)
    } catch {
      alert('生成错题练习失败')
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--app-bg-page)', padding: '24px 16px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <PageHeader
          backTo={paramsBankId ? `/banks/${paramsBankId}` : '/banks'}
          title="错题本"
          subtitle={total > 0 ? <span style={{ fontSize: '13px', color: 'var(--app-text-muted)' }}>共 {total} 题</span> : undefined}
        />

        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          {!paramsBankId && (
            <select value={selectedBankId} onChange={e => { setSelectedBankId(e.target.value); setPage(1) }}
              style={{ padding: '8px 14px', border: '2px solid #E5E7EB', borderRadius: 12, fontSize: '13px', outline: 'none', background: '#fff', minWidth: 160 }}>
              <option value="">全部题库</option>
              {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          {selectedBankId && items.length > 0 && (
            <button onClick={handleGeneratePractice}
              style={{ padding: '8px 20px', background: 'var(--app-success)', color: '#fff', border: 'none', borderRadius: 12, fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
              生成错题练习
            </button>
          )}
        </div>

        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} />
        ) : items.length === 0 ? (
          <EmptyState icon={<BookmarkIcon size={48} />} title="暂无错题" description="继续努力，保持好状态！" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {items.map(item => {
              const isExpanded = expandedId === item.id
              return (
                <div key={item.id} className="card-hover" style={{ background: '#fff', borderRadius: 16, padding: '16px 20px', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', color: 'var(--app-text-body)', lineHeight: 1.6, marginBottom: '6px' }}>
                        <span style={{ padding: '2px 10px', borderRadius: 8, background: 'var(--app-brand-bg)', color: 'var(--app-brand)', fontSize: '11px', fontWeight: 600, marginRight: '8px' }}>
                          {QTYPE_LABELS[item.question.type] || item.question.type}
                        </span>
                        <MarkdownRenderer content={item.question.content?.stem || '无题干'} />
                      </div>
                      <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--app-text-muted)' }}>
                        <span>错题 <strong style={{ color: 'var(--app-danger)' }}>{item.wrong_count}</strong> 次</span>
                        <span>最近错误: {new Date(item.last_wrong_at + 'Z').toLocaleString('zh-CN')}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                    <button onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      style={{ padding: '6px 14px', border: '1px solid #E5E7EB', borderRadius: 10, background: '#fff', cursor: 'pointer', fontSize: '12px', color: 'var(--app-brand)' }}>
                      {isExpanded ? '收起答案' : '查看答案'}
                    </button>
                    <button onClick={() => handleRemove(item.id)}
                      style={{ padding: '6px 14px', border: '1px solid #FEE2E2', borderRadius: 10, background: '#FFF', cursor: 'pointer', fontSize: '12px', color: 'var(--app-danger)' }}>
                      移出错题本
                    </button>
                    <button onClick={() => navigate(`/banks/${item.bank_id}/practice?only_wrong=true`)}
                      style={{ padding: '6px 14px', border: '1px solid #E5E7EB', borderRadius: 10, background: '#fff', cursor: 'pointer', fontSize: '12px', color: 'var(--app-text-body)' }}>
                      练习此题
                    </button>
                  </div>

                  {isExpanded && (
                    <div style={{ marginTop: '12px', padding: '14px', background: 'var(--app-bg-card-alt)', borderRadius: 12, border: '1px solid #E5E7EB' }}>
                      <div style={{ marginBottom: '10px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--app-success)', marginBottom: '4px' }}>正确答案</div>
                        <div style={{ fontSize: '13px', color: 'var(--app-text-body)', lineHeight: 1.6 }}>
                          <MarkdownRenderer content={(item.question.answer?.correct_answer || []).join(', ') || '见解析'} />
                        </div>
                      </div>
                      {item.question.answer?.explanation && (
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--app-brand)', marginBottom: '4px' }}>解析</div>
                          <div style={{ fontSize: '13px', color: 'var(--app-text-secondary)', lineHeight: 1.7 }}>
                            <MarkdownRenderer content={item.question.answer.explanation} />
                          </div>
                        </div>
                      )}
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
