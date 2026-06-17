import api from './auth'

export interface RecommenderResource {
  resource_type: string
  title: string
  id?: string
  category?: string | null
  difficulty?: number | null
  source?: string | null
  question_id?: string
  stem?: string
}

export interface Recommendation {
  type: string
  priority: number
  title: string
  reason: string
  knowledge_point: string | null
  point_id: string | null
  resources: RecommenderResource[]
  suggested_actions: string[]
  metadata?: Record<string, any>
}

export interface VariationQuestion {
  question_id: string
  stem: string
  difficulty: string
  type: string
  has_wrong_record: boolean
}

export interface VariationResponse {
  knowledge_point: string
  total_questions: number
  questions: VariationQuestion[]
}

export interface MarkImportantResponse {
  success: boolean
  marked_by_count: number
  is_official_important: boolean
}

export interface SummaryResponse {
  summary: Recommendation | null
  message?: string
}

export const recommendApi = {
  /** 获取所有推荐（按优先级排序） */
  getAll: (params?: Record<string, any>) =>
    api.get<{ recommendations: Recommendation[]; total: number }>('/recommend', { params }),

  /** 薄弱点推荐 */
  getWeakPoints: () =>
    api.get<{ recommendations: Recommendation[]; total: number }>('/recommend/weak-points'),

  /** 艾宾浩斯复习推荐 */
  getReview: () =>
    api.get<{ recommendations: Recommendation[]; total: number }>('/recommend/review'),

  /** 变式练习推荐 */
  getVariations: (pointId: string) =>
    api.get<VariationResponse>(`/recommend/variations/${pointId}`),

  /** 周期性总结报告 */
  getSummary: () =>
    api.get<SummaryResponse>('/recommend/summary'),

  /** 难度自适应推荐 */
  getDifficulty: () =>
    api.get<{ recommendations: Recommendation[]; total: number }>('/recommend/difficulty'),

  /** 疲劳检测推荐 */
  getFatigue: () =>
    api.get<{ recommendations: Recommendation[]; total: number }>('/recommend/fatigue'),

  /** 重要资源推荐 */
  getImportant: () =>
    api.get<{ recommendations: Recommendation[]; total: number }>('/recommend/important'),

  /** 标记资源为重要 */
  markImportant: (resourceId: string) =>
    api.post<MarkImportantResponse>(`/recommend/resource/${resourceId}/mark-important`),

  /** 忽略某类推荐 */
  ignoreType: (recType: string) =>
    api.post<{ success: boolean; message: string }>(`/recommend/${recType}/ignore`),
}
