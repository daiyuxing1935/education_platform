import { useState, useEffect, useRef } from 'react'
import { resourcesApi } from '../api/resources'
import type { VideoGenStatusResponse } from '../api/resources'
import MarkdownRenderer from './MarkdownRenderer'

/* ── Icons ── */
function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
  )
}

/* ── Modal Wrapper ── */
function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 2000,
      backdropFilter: 'blur(2px)',
    }}>
      <div style={{
        backgroundColor: 'white', borderRadius: 12, padding: 24,
        width: '90%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', padding: 4 }}>
            <CloseIcon />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/* ── Step dots ── */
function StepIndicator({ current }: { current: number }) {
  const steps = ['输入知识点', '预览确认', '生成中', '完成']
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 16, justifyContent: 'center' }}>
      {steps.map((s, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{
            width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 600,
            backgroundColor: i <= current ? 'var(--primary)' : 'var(--gray-200)',
            color: i <= current ? '#fff' : 'var(--gray-400)',
          }}>{i + 1}</div>
          <span style={{ fontSize: 11, color: i <= current ? 'var(--gray-700)' : 'var(--gray-300)' }}>{s}</span>
          {i < steps.length - 1 && <span style={{ color: 'var(--gray-200)', margin: '0 4px', display: 'flex', alignItems: 'center' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg></span>}
        </div>
      ))}
    </div>
  )
}

/* ── Props ── */
interface VideoGenModalProps {
  onClose: () => void
  onDone: (resourceId: string) => void
}

export default function VideoGenModal({ onClose, onDone }: VideoGenModalProps) {
  const [step, setStep] = useState(0) // 0=输入, 1=预览, 2=生成中, 3=完成
  const [genKps, setGenKps] = useState('')
  const [taskId, setTaskId] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ script: string; outline: string } | null>(null)
  const [progressMsg, setProgressMsg] = useState('')
  const [progressPct, setProgressPct] = useState('0%')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const pollRef = useRef<number>()
  const [historyTasks, setHistoryTasks] = useState<VideoGenStatusResponse[]>([])

  /* ── Step 1: 生成预览 ── */
  const handlePreview = async () => {
    const kpList = genKps.split(/[,，、\n]/).map(s => s.trim()).filter(Boolean)
    if (kpList.length === 0) return

    setLoading(true)
    setError('')
    try {
      const res = await resourcesApi.videoPreview({ knowledge_points: kpList })
      setTaskId(res.data.task_id)
      setPreview({
        script: res.data.script_content,
        outline: res.data.outline_content,
      })
      setStep(1)
    } catch (e: any) {
      setError(e.response?.data?.detail || '预览生成失败，请检查 API 配置')
    } finally {
      setLoading(false)
    }
  }

  /* ── Step 2: 确认生成 ── */
  const handleConfirm = async () => {
    if (!taskId) return

    setLoading(true)
    setError('')
    try {
      const res = await resourcesApi.videoGenerate({ task_id: taskId })
      setProgressMsg(res.data.progress_message || '视频生成已开始')
      setProgressPct(res.data.progress_pct || '10%')
      setStep(2)
      startPolling(taskId)
    } catch (e: any) {
      setError(e.response?.data?.detail || '生成启动失败')
    } finally {
      setLoading(false)
    }
  }

  /* ── 轮询 ── */
  const startPolling = (tid: string) => {
    const poll = async () => {
      try {
        const res = await resourcesApi.videoStatus(tid)
        const data = res.data
        setProgressMsg(data.progress_message || '')
        setProgressPct(data.progress_pct || '')

        if (data.status === 'completed') {
          setStep(3)
          setProgressMsg('视频已生成完成')
          setProgressPct('100%')
          if (data.resource_id) {
            onDone(data.resource_id)
          }
          return
        }
        if (data.status === 'failed') {
          setError(data.error_message || '生成失败')
          return
        }
        // 继续轮询
        pollRef.current = window.setTimeout(poll, 2000)
      } catch {
        pollRef.current = window.setTimeout(poll, 3000)
      }
    }
    pollRef.current = window.setTimeout(poll, 2000)
  }

  /* ── 删除历史任务 ── */
  const handleDeleteTask = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await resourcesApi.deleteVideoTask(taskId)
      fetchHistory()
    } catch (e: any) {
      console.error('删除失败', e)
    }
  }

  /* ── 获取视频生成历史 ── */
  const fetchHistory = async () => {
    try {
      const res = await resourcesApi.listVideoTasks()
      setHistoryTasks(res.data || [])
    } catch { /* 静默 */ }
  }

  useEffect(() => { fetchHistory() }, [])

  /* ── 从历史记录恢复 ── */
  const handleResumeTask = (task: VideoGenStatusResponse) => {
    if (task.status === 'preview') {
      setGenKps(task.knowledge_points?.join(', ') || '')
      setTaskId(task.task_id)
      setPreview({ script: task.script_content || '', outline: task.outline_content || '' })
      setError('')
      setStep(1)
    } else if (task.status === 'generating') {
      setTaskId(task.task_id)
      setProgressMsg(task.progress_message || '')
      setProgressPct(task.progress_pct || '0%')
      setError('')
      setStep(2)
      startPolling(task.task_id)
    } else if (task.status === 'completed' && task.resource_id) {
      onDone(task.resource_id)
    } else if (task.status === 'failed') {
      setError(task.error_message || '生成失败')
    }
  }

  useEffect(() => {
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current)
    }
  }, [])

  return (
    <Modal title="生成视频讲解" onClose={onClose}>
      <StepIndicator current={step} />

      {/* Step 0: 输入知识点 */}
      {step === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: '0.8125rem', color: 'var(--gray-500)', margin: 0 }}>
            输入知识点名称，AI 将生成口播稿并制作视频讲解。
            <br />视频生成过程较长，生成后可在资源列表中查看。
          </p>
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
          {error && <p style={{ color: 'var(--app-danger)', fontSize: '0.8125rem', margin: 0 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button className="btn btn-secondary" onClick={onClose}>取消</button>
            <button className="btn btn-primary" onClick={handlePreview} disabled={loading}>
              {loading ? '生成预览中...' : '生成预览'}
            </button>
          </div>

          {historyTasks.length > 0 && (
            <div style={{ borderTop: '1px solid var(--gray-100)', paddingTop: 12, marginTop: 4 }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--gray-500)', marginBottom: 6 }}>
                最近记录
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
                {historyTasks.slice(0, 10).map(task => {
                  const statusColors: Record<string, string> = {
                    preview: 'var(--app-info)', generating: 'var(--app-warning)',
                    completed: '#22c55e', failed: 'var(--app-danger)',
                  }
                  const statusLabels: Record<string, string> = {
                    preview: '预览就绪', generating: '生成中',
                    completed: '已完成', failed: '失败',
                  }
                  const fmtTime = (iso: string | null) => {
                    if (!iso) return ''
                    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
                    if (diff < 1) return '刚刚'
                    if (diff < 60) return `${diff} 分钟前`
                    if (diff < 1440) return `${Math.floor(diff / 60)} 小时前`
                    return new Date(iso).toLocaleDateString('zh-CN')
                  }
                  return (
                    <div key={task.task_id} onClick={() => handleResumeTask(task)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
                        borderRadius: 6, cursor: 'pointer', fontSize: '0.8125rem',
                        border: '1px solid var(--gray-100)',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-50, #f9fafb)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                    >
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {(task.knowledge_points || []).join(', ')}
                      </span>
                      <span style={{
                        fontSize: '0.6875rem', padding: '1px 5px', borderRadius: 8,
                        color: '#fff', background: statusColors[task.status] || 'var(--app-text-secondary)', flexShrink: 0,
                      }}>
                        {statusLabels[task.status] || task.status}
                      </span>
                      <span style={{ fontSize: '0.6875rem', color: 'var(--gray-400)', flexShrink: 0 }}>
                        {fmtTime(task.created_at)}
                      </span>
                      <button
                        onClick={e => handleDeleteTask(task.task_id, e)}
                        title="删除记录"
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: '#ccc', padding: '2px 4px', borderRadius: 4,
                          fontSize: '0.75rem', flexShrink: 0, lineHeight: 1,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--app-danger)'; e.currentTarget.style.background = 'var(--app-bg-danger)' }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#ccc'; e.currentTarget.style.background = 'none' }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 1: 预览确认 */}
      {step === 1 && preview && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: '0.8125rem', color: 'var(--gray-600)', margin: 0 }}>
            请预览口播稿和大纲，确认后开始生成完整视频。
            <br /><span style={{ color: 'var(--orange, #f59e0b)' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: 'middle', marginRight: 3 }}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>视频生成通常需要 1-3 分钟，请耐心等待</span>
          </p>

          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--gray-500)', marginBottom: 4, display: 'block' }}>
              口播稿
            </label>
            <div style={{
              maxHeight: 300, overflowY: 'auto', padding: 12,
              border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-md)',
              background: '#fff',
            }}>
              <MarkdownRenderer content={preview.script} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--gray-500)', marginBottom: 4, display: 'block' }}>
              开发大纲
            </label>
            <div style={{
              maxHeight: 300, overflowY: 'auto', padding: 12,
              border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-md)',
              background: '#fff',
            }}>
              <MarkdownRenderer content={preview.outline} />
            </div>
          </div>

          {error && <p style={{ color: 'var(--app-danger)', fontSize: '0.8125rem', margin: 0 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button className="btn btn-secondary" onClick={() => setStep(0)}>返回修改</button>
            <button className="btn btn-primary" onClick={handleConfirm} disabled={loading}>
              {loading ? '启动中...' : '确认生成视频'}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: 生成中 */}
      {step === 2 && (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{
            width: 48, height: 48, border: '3px solid var(--primary)', borderTopColor: 'transparent',
            borderRadius: '50%', animation: 'vgen-spin 0.8s linear infinite', margin: '0 auto 16px',
          }} />
          <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--gray-700)', marginBottom: 8 }}>
            视频生成中...
          </p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--gray-500)', marginBottom: 12 }}>
            {progressMsg || '正在生成章节内容和演示页面'}
          </p>
          <div style={{
            width: '80%', maxWidth: 300, height: 6, background: 'var(--gray-200)',
            borderRadius: 3, margin: '0 auto', overflow: 'hidden',
          }}>
            <div style={{
              width: progressPct || '0%', height: '100%', background: 'var(--primary)',
              borderRadius: 3, transition: 'width 0.5s ease',
            }} />
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginTop: 8 }}>
            {progressPct || '0%'}
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--orange, #f59e0b)', marginTop: 12 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: 'middle', marginRight: 3 }}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> 视频生成时间较长，请耐心等待，完成后自动跳转
          </p>
          {error && <p style={{ color: 'var(--app-danger)', fontSize: '0.8125rem', margin: 8 }}>{error}</p>}
        </div>
      )}

      {/* Step 3: 完成 */}
      {step === 3 && (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%', background: '#22c55e',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 24, margin: '0 auto 16px',
          }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg></div>
          <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--gray-700)', marginBottom: 8 }}>
            视频生成完成
          </p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--gray-500)', marginBottom: 16 }}>
            可在资源列表中查看和播放
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button className="btn btn-secondary" onClick={onClose}>关闭</button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes vgen-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </Modal>
  )
}
