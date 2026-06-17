import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { questionBankApi, type DailyStatsItem } from '../api/questionBank'
import AccuracyChart from '../components/AccuracyChart'
import { BarChartIcon } from '../components/Icons'
import { PageHeader, EmptyState, LoadingState, ErrorState } from '../components/shared'

export default function DailyStatsPage() {
  const { bankId: paramsBankId } = useParams<{ bankId: string }>()
  const [items, setItems] = useState<DailyStatsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [days, setDays] = useState(7)
  const [banks, setBanks] = useState<{ id: string; name: string }[]>([])
  const [selectedBankId, setSelectedBankId] = useState(paramsBankId || '')
  const [selectedMode, setSelectedMode] = useState('')

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
      const res = await questionBankApi.getDailyStats({
        bank_id: selectedBankId || undefined,
        mode: selectedMode || undefined,
        days,
      })
      setItems(res.data.items)
    } catch {
      setError('加载统计数据失败')
    }
    setLoading(false)
  }

  useEffect(() => { if (!paramsBankId) loadBanks(); else loadData() }, [])
  useEffect(() => { loadData() }, [selectedBankId, selectedMode, days])

  const totalDays = items.length
  const totalQ = items.reduce((s, i) => s + i.total_questions, 0)
  const totalCorrect = items.reduce((s, i) => s + i.correct_count, 0)
  const overallAccuracy = totalQ > 0 ? Math.round((totalCorrect / totalQ) * 100) : 0
  const avgDaily = totalDays > 0 ? Math.round(totalQ / totalDays) : 0

  return (
    <div style={{ minHeight: '100vh', background: 'var(--app-bg-page)', padding: '24px 16px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <PageHeader
          backTo={paramsBankId ? `/banks/${paramsBankId}` : '/banks'}
          title="练习统计"
        />

        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {!paramsBankId && (
            <select value={selectedBankId} onChange={e => setSelectedBankId(e.target.value)}
              style={{ padding: '8px 14px', border: '2px solid #E5E7EB', borderRadius: 12, fontSize: '13px', outline: 'none', background: '#fff', minWidth: 160 }}>
              <option value="">全部题库</option>
              {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <select value={selectedMode} onChange={e => setSelectedMode(e.target.value)}
            style={{ padding: '8px 14px', border: '2px solid #E5E7EB', borderRadius: 12, fontSize: '13px', outline: 'none', background: '#fff' }}>
            <option value="">全部模式</option>
            <option value="random">随机练习</option>
            <option value="sequential">顺序练习</option>
            <option value="exam">模拟考试</option>
          </select>
          <div style={{ display: 'flex', gap: '4px' }}>
            {[7, 30, 90].map(d => (
              <button key={d} onClick={() => setDays(d)}
                style={{
                  padding: '8px 16px', border: '2px solid', borderRadius: 12, fontSize: '13px', cursor: 'pointer',
                  background: days === d ? 'rgba(30,58,138,0.1)' : '#fff',
                  borderColor: days === d ? 'var(--app-brand)' : 'var(--app-border)',
                  color: days === d ? 'var(--app-brand)' : 'var(--app-text-secondary)',
                  fontWeight: days === d ? 600 : 400,
                }}>
                {d}天
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} />
        ) : items.length === 0 ? (
          <EmptyState icon={<BarChartIcon size={48} />} title="暂无练习记录" description="开始练习后，这里会显示你的学习趋势" />
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px', marginBottom: '20px' }}>
              {[
                { label: '练习天数', value: totalDays, color: 'var(--app-brand)' },
                { label: '总答题数', value: totalQ, color: 'var(--app-text-body)' },
                { label: '总正确率', value: `${overallAccuracy}%`, color: 'var(--app-success)' },
                { label: '日均题数', value: avgDaily, color: 'var(--app-warning)' },
              ].map(s => (
                <div key={s.label} className="card-hover" style={{ background: '#fff', borderRadius: 14, padding: '16px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: '12px', color: 'var(--app-text-muted)', marginTop: '4px' }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div className="card-hover" style={{ background: '#fff', borderRadius: 16, padding: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--app-text-heading)', margin: '0 0 16px' }}>正确率趋势</h3>
              <AccuracyChart data={items.map(i => ({ date: i.date, accuracy: i.accuracy, total_questions: i.total_questions }))} />
            </div>

            <div className="card-hover" style={{ background: '#fff', borderRadius: 16, padding: '20px 24px', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--app-text-heading)', margin: '0 0 12px' }}>每日明细</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #E5E7EB' }}>
                      <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--app-text-secondary)', fontWeight: 600 }}>日期</th>
                      <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--app-text-secondary)', fontWeight: 600 }}>总题</th>
                      <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--app-success)', fontWeight: 600 }}>正确</th>
                      <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--app-danger)', fontWeight: 600 }}>错误</th>
                      <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--app-text-secondary)', fontWeight: 600 }}>正确率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(i => (
                      <tr key={i.date} style={{ borderBottom: '1px solid #F3F4F6' }}>
                        <td style={{ padding: '10px 12px', color: 'var(--app-text-body)' }}>{i.date}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--app-text-body)' }}>{i.total_questions}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--app-success)' }}>{i.correct_count}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--app-danger)' }}>{i.incorrect_count}</td>
                        <td style={{
                          padding: '10px 12px', textAlign: 'right', fontWeight: 600,
                          color: i.accuracy >= 80 ? 'var(--app-success)' : i.accuracy >= 60 ? 'var(--app-warning)' : 'var(--app-danger)',
                        }}>
                          {i.accuracy}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
