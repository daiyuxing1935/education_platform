/**
 * 多智能体系统 API 客户端
 *
 * 提供创建任务、查询状态、SSE 流式监听等功能。
 */

import api from './auth'

// ── 类型定义 ──

export interface GenerateRequest {
  query: string
  knowledge_points?: string[]
  resource_types?: string[]
  subject_id?: string
}

export interface GenerateResponse {
  task_id: string
  status: string
  message: string
}

export interface ResourceSummary {
  id?: string
  title?: string
  resource_type?: string
  knowledge_points: string[]
}

export interface ProfileSummary {
  total_knowledge_points: number
  total_weak_points: number
  cognitive_style: string | null
}

export interface TaskStatusResponse {
  task_id: string
  status: string
  progress: number
  current_agent: string
  error: string | null
  query: string
  knowledge_points: string[]
  generated_types: string[]
  resources: ResourceSummary[]
  profile_summary: ProfileSummary | null
  path_id: string | null
  created_at: string | null
  completed_at: string | null
}

export interface TaskListItem {
  task_id: string
  query: string
  status: string
  progress: number
  generated_types: string[]
  created_at: string
}

export interface TaskListResponse {
  tasks: TaskListItem[]
  total: number
}

// ── Agent 名称映射 ──

export const AGENT_LABELS: Record<string, string> = {
  scheduler: '调度分析',
  profile: '画像读取',
  resource_gen: '资源生成',
  path_push: '路径规划',
}

export const AGENT_LABELS_EN: Record<string, string> = {
  scheduler: 'Scheduler',
  profile: 'Profile',
  resource_gen: 'Resource Generator',
  path_push: 'Path Planner',
}

// ── 资源类型中文标签 ──

export const RESOURCE_TYPE_LABELS: Record<string, string> = {
  mind_map: '思维导图',
  document: '知识讲解文档',
  exercise: '练习题',
  code_case: '代码实操案例',
  video: '教学视频',
  extra_reading: '拓展阅读',
}

export const RESOURCE_TYPE_ICONS: Record<string, string> = {
  mind_map: '🧠',
  document: '📄',
  exercise: '✏️',
  code_case: '💻',
  video: '🎬',
  extra_reading: '📖',
}

// ── API 方法 ──

/**
 * 创建多智能体资源生成任务
 */
export async function createAgentTask(
  data: GenerateRequest
): Promise<GenerateResponse> {
  const res = await api.post<GenerateResponse>('/agent/generate', data)
  return res.data
}

/**
 * 查询任务状态
 */
export async function getAgentTaskStatus(
  taskId: string
): Promise<TaskStatusResponse> {
  const res = await api.get<TaskStatusResponse>(`/agent/task/${taskId}`)
  return res.data
}

/**
 * 获取用户所有任务列表
 */
export async function listAgentTasks(params?: {
  limit?: number
  offset?: number
  status_filter?: string
}): Promise<TaskListResponse> {
  const res = await api.get<TaskListResponse>('/agent/tasks', { params })
  return res.data
}

/**
 * 取消任务
 */
export async function cancelAgentTask(taskId: string): Promise<void> {
  await api.post(`/agent/task/${taskId}/cancel`)
}

/**
 * 通过 EventSource 监听任务 SSE 进度
 *
 * @returns 返回 EventSource 实例，调用方需在适当时机 close()
 */
export function subscribeTaskSSE(
  taskId: string,
  onProgress: (data: {
    task_id: string
    status: string
    progress: number
    current_agent: string
    error: string | null
  }) => void,
  onComplete: (data: any) => void,
  onError?: (error: any) => void
): EventSource {
  const token = localStorage.getItem('access_token')
  const url = `/api/v1/agent/task/${taskId}/sse?token=${token}`

  const eventSource = new EventSource(url)

  eventSource.addEventListener('progress', (event) => {
    try {
      const data = JSON.parse(event.data)
      onProgress(data)
    } catch (e) {
      console.error('[AgentSSE] 解析进度数据失败:', e)
    }
  })

  eventSource.addEventListener('complete', (event) => {
    try {
      const data = JSON.parse(event.data)
      onComplete(data)
    } catch (e) {
      console.error('[AgentSSE] 解析完成数据失败:', e)
    }
    eventSource.close()
  })

  eventSource.addEventListener('error', (event) => {
    console.error('[AgentSSE] 连接错误:', event)
    onError?.(event)
    eventSource.close()
  })

  return eventSource
}
