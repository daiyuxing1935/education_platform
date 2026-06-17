import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { questionBankApi, type SessionAnswerItem } from '../api/questionBank'
import MarkdownRenderer from '../components/MarkdownRenderer'
import { formatDateTime, formatDuration } from '../utils/time'
import { QTYPE_LABELS, MODE_LABELS } from '../constants/labels'
import { PageHeader, LoadingState, ErrorState } from '../components/shared'

export default function TestHistoryDetailPage() {
  const { bankId, sessionId } = useParams<{ bankId: string; sessionId: string }>()
  const navigate = useNavigate()
  const [session, setSession] = useState<any>(null)
  const [answers, setAnswers] = useState<SessionAnswerItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!sessionId || !bankId) return
    loadData()
  }, [sessionId, bankId])

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const [sessionRes, answersRes] = await Promise.all([
        questionBankApi.getPracticeSession(sessionId!),
        questionBankApi.getSessionAnswers(sessionId!),
      ])
      setSession(sessionRes.data)
      setAnswers(answersRes.data.items)
    } catch {
      setError('加载测试详情失败')
    }
    setLoading(false)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--app-bg-page)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <LoadingState />
    </div>
  )

  if (error) return (
    <div style={{ minHeight: '100vh', background: 'var(--app-bg-page)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <ErrorState message={error} />
    </div>
  )

  if (!session) return null

  const totalQ = session.stats?.total || 0
  const correct = session.stats?.correct || 0
  const incorrect = session.stats?.incorrect || 0
  const answered = correct + incorrect
  const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0
  const isCompleted = session.status === 'completed'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--app-bg-page)', padding: '24px 16px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <PageHeader backTo={`/banks/${bankId}/history`} backLabel="返回历史列表" />

        {/* Summary Card */}
        <div className="card-hover" style={{ background: '#fff', borderRadius: 16, padding: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--app-text-heading)', margin: '0 0 4px' }}>
                {MODE_LABELS[session.mode] || session.mode}
              </h2>
              <div style={{ fontSize: '13px', color: 'var(--app-text-muted)' }}>
                {formatDateTime(session.started_at)}
                {isCompleted && session.finished_at && (
                  <span> · {formatDuration(session.started_at, session.finished_at)}</span>
                )}
              </div>
            </div>
            {isCompleted && (
              <div style={{
                padding: '6px 20px', borderRadius: 16, fontSize: '18px', fontWeight: 700,
                background: accuracy >= 80 ? 'rgba(16,185,129,0.1)' : accuracy >= 60 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                color: accuracy >= 80 ? 'var(--app-success)' : accuracy >= 60 ? 'var(--app-warning)' : 'var(--app-danger)',
              }}>
                {accuracy}%
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '32px', fontSize: '14px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--app-text-heading)' }}>{totalQ}</div>
              <div style={{ fontSize: '12px', color: 'var(--app-text-muted)' }}>总题数</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--app-success)' }}>{correct}</div>
              <div style={{ fontSize: '12px', color: 'var(--app-text-muted)' }}>正确</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--app-danger)' }}>{incorrect}</div>
              <div style={{ fontSize: '12px', color: 'var(--app-text-muted)' }}>错误</div>
            </div>
          </div>
          <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
            <button onClick={() => navigate(`/banks/${bankId}/practice?session_id=${sessionId}&review=1`)}
              style={{ flex: 1, padding: '8px 20px', background: 'var(--app-brand)', color: '#fff', border: 'none', borderRadius: 12, fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
              回看此练习
            </button>
            {totalQ > 0 && (
              <button onClick={async () => {
                try {
                  const res = await questionBankApi.createPracticeSession(bankId!, {
                    mode: session.mode || 'random',
                    answer_mode: 'during',
                    question_order: session.question_order || [],
                  })
                  navigate(`/banks/${bankId}/practice?session_id=${res.data.id}`)
                } catch {
                  navigate(`/banks/${bankId}/practice`)
                }
              }}
                style={{ flex: 1, padding: '8px 20px', background: 'var(--app-success)', color: '#fff', border: 'none', borderRadius: 12, fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
                重新练习（产生新记录）
              </button>
            )}
          </div>
        </div>

        {/* Answer Details */}
        <div className="card-hover" style={{ background: '#fff', borderRadius: 16, padding: '20px 24px', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--app-text-heading)', margin: '0 0 16px' }}>答题详情</h3>
          {answers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--app-text-placeholder)', fontSize: '14px' }}>暂无答题记录</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {answers.map((ans, i) => {
                const userAnswer = ans.answer_content?.user_answer || '(未作答)'
                const rawCorrect = ans.question?.answer?.correct_answer || []
                const correctAnswer = (Array.isArray(rawCorrect) ? rawCorrect.join(', ') : String(rawCorrect)) || '见解析'

                return (
                  <div key={ans.answer_id} style={{
                    padding: '14px 16px', borderRadius: 12,
                    background: ans.is_correct ? 'rgba(16,185,129,0.04)' : 'rgba(239,68,68,0.04)',
                    border: `1px solid ${ans.is_correct ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                  }}>
                    {/* Question header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '12px', fontWeight: 600, background: ans.is_correct ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                          color: ans.is_correct ? 'var(--app-success)' : 'var(--app-danger)',
                        }}>
                          {i + 1}
                        </span>
                        {ans.question && (
                          <span style={{ padding: '2px 10px', borderRadius: 8, background: 'var(--app-brand-bg)', color: 'var(--app-brand)', fontSize: '11px', fontWeight: 600 }}>
                            {QTYPE_LABELS[ans.question.type] || ans.question.type}
                          </span>
                        )}
                      </div>
                      <span style={{
                        padding: '2px 12px', borderRadius: 10, fontSize: '11px', fontWeight: 500,
                        background: ans.is_correct ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                        color: ans.is_correct ? 'var(--app-success)' : 'var(--app-danger)',
                      }}>
                        {ans.is_correct ? '正确' : '错误'}
                      </span>
                    </div>

                    {/* Question stem */}
                    {ans.question && (
                      <div style={{ fontSize: '13px', color: 'var(--app-text-body)', lineHeight: 1.6, marginBottom: '10px' }}>
                        <MarkdownRenderer content={ans.question.content?.stem || '无题干'} />
                      </div>
                    )}

                    {/* Answers comparison */}
                    <div style={{ fontSize: '13px' }}>
                      <div style={{ marginBottom: '4px', overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                        <span style={{ color: 'var(--app-text-muted)', marginRight: '4px' }}>你的答案:</span>
                        <span style={{ color: ans.is_correct ? 'var(--app-success)' : 'var(--app-danger)', fontWeight: 500 }}>{userAnswer}</span>
                      </div>
                      {!ans.is_correct && (
                        <div style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                          <span style={{ color: 'var(--app-text-muted)', marginRight: '4px' }}>正确答案:</span>
                          <span style={{ color: 'var(--app-success)', fontWeight: 500 }}><MarkdownRenderer content={correctAnswer} /></span>
                        </div>
                      )}
                    </div>

                    {/* Explanation */}
                    {!ans.is_correct && ans.question?.answer?.explanation && (
                      <div style={{ marginTop: '8px', padding: '10px 12px', background: 'var(--app-bg-card-alt)', borderRadius: 8, fontSize: '13px', color: 'var(--app-text-secondary)', lineHeight: 1.6, overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                        <div style={{ fontWeight: 600, color: 'var(--app-brand)', marginBottom: '4px', fontSize: '12px' }}>解析</div>
                        <MarkdownRenderer content={ans.question.answer.explanation} />
                      </div>
                    )}

                    {ans.time_spent_seconds != null && (
                      <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--app-text-placeholder)' }}>
                        用时: {ans.time_spent_seconds}秒
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
