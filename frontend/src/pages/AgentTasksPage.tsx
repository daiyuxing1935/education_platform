/**
 * 多智能体任务中心页面
 *
 * 展示所有 Agent 任务的列表，支持查看进度和详情。
 */

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  listAgentTasks,
  getAgentTaskStatus,
  cancelAgentTask,
  type TaskListItem,
  type TaskStatusResponse,
  AGENT_LABELS,
  RESOURCE_TYPE_LABELS,
  RESOURCE_TYPE_ICONS,
} from '../api/agent'

function SparklesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/>
      <path d="M18.5 15.5l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5L16 17.5l1.5-.5.5-1.5z"/>
      <path d="M6 16l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z"/>
    </svg>
  )
}

function RefreshIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"/>
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
    </svg>
  )
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  )
}

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: '等待中', color: '#f59e0b', bg: '#fef3c7' },
  running:   { label: '运行中', color: '#3b82f6', bg: '#dbeafe' },
  completed: { label: '已完成', color: '#22c55e', bg: '#dcfce7' },
  failed:    { label: '失败',   color: '#ef4444', bg: '#fee2e2' },
}

export default function AgentTasksPage() {
  const [tasks, setTasks] = useState<TaskListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
  const [selectedTask, setSelectedTask] = useState<TaskStatusResponse | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const loadTasks = async () => {
    setLoading(true)
    try {
      const res = await listAgentTasks({ limit: 20, status_filter: statusFilter })
      setTasks(res.tasks)
    } catch (e) {
      console.error('加载任务列表失败:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTasks()
  }, [statusFilter])

  // 自动刷新运行中的任务
  useEffect(() => {
    const hasRunning = tasks.some(t => t.status === 'running' || t.status === 'pending')
    if (!hasRunning) return
    const timer = setInterval(loadTasks, 3000)
    return () => clearInterval(timer)
  }, [tasks])

  const handleViewDetail = async (taskId: string) => {
    setDetailLoading(true)
    try {
      const detail = await getAgentTaskStatus(taskId)
      setSelectedTask(detail)
    } catch (e) {
      console.error('加载任务详情失败:', e)
    } finally {
      setDetailLoading(false)
    }
  }

  const handleCancel = async (taskId: string) => {
    try {
      await cancelAgentTask(taskId)
      loadTasks()
    } catch (e) {
      console.error('取消任务失败:', e)
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 'var(--space-6)' }}>
      {/* 返回首页 */}
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <Link to="/" style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: '0.875rem' }}>
          ← 返回首页
        </Link>
      </div>

      {/* 标题栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <span style={{ color: 'var(--primary)' }}><SparklesIcon /></span>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>多智能体任务中心</h1>
        </div>
        <button
          onClick={loadTasks}
          style={{ padding: '0.5rem 1rem', background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-md)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '0.875rem' }}
        >
          <RefreshIcon /> 刷新
        </button>
      </div>

      {/* 筛选栏 */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        {[
          { label: '全部', value: undefined },
          { label: '运行中', value: 'running' },
          { label: '已完成', value: 'completed' },
          { label: '失败', value: 'failed' },
        ].map(f => (
          <button
            key={f.label}
            onClick={() => setStatusFilter(f.value)}
            style={{
              padding: '0.35rem 0.85rem',
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${statusFilter === f.value ? 'var(--primary)' : 'var(--gray-200)'}`,
              background: statusFilter === f.value ? 'var(--primary)' : 'white',
              color: statusFilter === f.value ? 'white' : 'var(--gray-600)',
              cursor: 'pointer',
              fontSize: '0.8125rem',
              fontWeight: statusFilter === f.value ? 500 : 400,
              transition: 'all 0.2s',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 任务列表 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--gray-400)' }}>加载中...</div>
      ) : tasks.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 'var(--space-12)',
          background: 'var(--gray-50)', borderRadius: 'var(--radius-lg)',
          border: '1px dashed var(--gray-200)',
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-3)', opacity: 0.4 }}>🤖</div>
          <p style={{ color: 'var(--gray-500)', margin: 0, fontSize: '0.9375rem' }}>
            暂无多智能体任务
          </p>
          <p style={{ color: 'var(--gray-400)', marginTop: 'var(--space-2)', fontSize: '0.8125rem' }}>
            在 AI 对话中点击「一键生成学习资源」即可创建任务
          </p>
          <Link
            to="/chat"
            style={{
              display: 'inline-block', marginTop: 'var(--space-4)',
              padding: '0.5rem 1.25rem', background: 'var(--primary)', color: 'white',
              borderRadius: 'var(--radius-md)', textDecoration: 'none', fontSize: '0.875rem',
            }}
          >
            去 AI 对话
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {tasks.map(task => {
            const st = STATUS_STYLES[task.status] || STATUS_STYLES.pending
            return (
              <div
                key={task.task_id}
                style={{
                  padding: 'var(--space-4)',
                  background: 'white',
                  border: '1px solid var(--gray-100)',
                  borderRadius: 'var(--radius-lg)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onClick={() => handleViewDetail(task.task_id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: '0.9375rem', marginBottom: 'var(--space-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {task.query}
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.75rem', padding: '1px 6px', borderRadius: 'var(--radius-sm)', background: st.bg, color: st.color }}>
                        {st.label}
                      </span>
                      {task.generated_types.length > 0 && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>
                          生成 {task.generated_types.length} 类资源
                        </span>
                      )}
                      {task.status === 'running' && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>
                          进度 {Math.round(task.progress * 100)}%
                        </span>
                      )}
                      <span style={{ fontSize: '0.7rem', color: 'var(--gray-300)' }}>
                        {new Date(task.created_at).toLocaleString('zh-CN')}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                    {task.status === 'running' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCancel(task.task_id) }}
                        style={{ background: 'none', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', padding: '4px 8px', fontSize: '0.75rem', color: 'var(--gray-500)' }}
                      >
                        <XIcon /> 取消
                      </button>
                    )}
                    {task.status === 'running' && (
                      <div style={{ width: 60, height: 4, background: 'var(--gray-100)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.round(task.progress * 100)}%`, height: '100%', background: '#667eea', borderRadius: 2, transition: 'width 0.5s ease' }} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 任务详情抽屉 */}
      {selectedTask && (
        <div style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: 420, maxWidth: '100vw',
          background: 'white', boxShadow: '-4px 0 24px rgba(0,0,0,0.1)',
          zIndex: 1000, overflow: 'auto', padding: 'var(--space-6)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>任务详情</h3>
            <button onClick={() => setSelectedTask(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--gray-400)' }}>×</button>
          </div>

          {detailLoading ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--gray-400)' }}>加载中...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {/* 状态 */}
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginBottom: 'var(--space-1)' }}>任务状态</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                    background: (STATUS_STYLES[selectedTask.status] || STATUS_STYLES.pending).bg,
                    color: (STATUS_STYLES[selectedTask.status] || STATUS_STYLES.pending).color,
                    fontSize: '0.8125rem',
                  }}>
                    {(STATUS_STYLES[selectedTask.status] || STATUS_STYLES.pending).label}
                  </span>
                  {selectedTask.status === 'running' && (
                    <span style={{ fontSize: '0.8125rem', color: 'var(--gray-500)' }}>
                      进度 {Math.round(selectedTask.progress * 100)}%
                    </span>
                  )}
                </div>
              </div>

              {/* 当前 Agent */}
              {selectedTask.current_agent && (
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginBottom: 'var(--space-1)' }}>当前执行</div>
                  <div style={{ fontSize: '0.875rem' }}>
                    {AGENT_LABELS[selectedTask.current_agent] || selectedTask.current_agent}
                  </div>
                </div>
              )}

              {/* 查询 */}
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginBottom: 'var(--space-1)' }}>用户请求</div>
                <div style={{ fontSize: '0.875rem', color: 'var(--gray-700)', background: 'var(--gray-50)', padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)' }}>
                  {selectedTask.query}
                </div>
              </div>

              {/* 知识点 */}
              {selectedTask.knowledge_points.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginBottom: 'var(--space-1)' }}>知识点</div>
                  <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
                    {selectedTask.knowledge_points.map((kp, i) => (
                      <span key={i} style={{ fontSize: '0.75rem', padding: '1px 6px', borderRadius: 'var(--radius-sm)', background: 'oklch(0.55 0.2 250 / 0.1)', color: 'var(--primary)' }}>
                        {kp}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 生成资源 */}
              {selectedTask.generated_types.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginBottom: 'var(--space-1)' }}>生成资源</div>
                  <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
                    {selectedTask.generated_types.map((t, i) => (
                      <span key={i} style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: 'var(--radius-sm)', background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }}>
                        {RESOURCE_TYPE_ICONS[t] || '📄'} {RESOURCE_TYPE_LABELS[t] || t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 资源列表 */}
              {selectedTask.resources.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginBottom: 'var(--space-2)' }}>资源详情</div>
                  {selectedTask.resources.map((r, i) => (
                    <div key={i} style={{ padding: 'var(--space-2)', background: 'var(--gray-50)', borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-1)', fontSize: '0.8125rem' }}>
                      <div style={{ fontWeight: 500 }}>{RESOURCE_TYPE_ICONS[r.resource_type || ''] || '📄'} {r.title}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginTop: 2 }}>
                        {RESOURCE_TYPE_LABELS[r.resource_type || ''] || r.resource_type}
                      </div>
                    </div>
                  ))}
                  {selectedTask.path_id && (
                    <div style={{ marginTop: 'var(--space-2)' }}>
                      <Link to={`/learning-path`} style={{ fontSize: '0.8125rem', color: 'var(--primary)' }}>
                        🗺️ 查看学习路径 →
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {/* 错误信息 */}
              {selectedTask.error && (
                <div style={{ padding: 'var(--space-2)', background: '#fef2f2', borderRadius: 'var(--radius-sm)', color: '#dc2626', fontSize: '0.8125rem' }}>
                  ❌ {selectedTask.error}
                </div>
              )}

              {/* 时间 */}
              {selectedTask.created_at && (
                <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>
                  创建：{new Date(selectedTask.created_at).toLocaleString('zh-CN')}
                  {selectedTask.completed_at && ` | 完成：${new Date(selectedTask.completed_at).toLocaleString('zh-CN')}`}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
