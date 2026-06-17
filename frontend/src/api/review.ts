import api from './auth'

export interface DueKnowledgePoint {
  point_id: string
  point_name: string
  mastery_score: number
  recent_accuracy: number
  consecutive_errors: number
  total_practiced: number
  study_count: number
  status: string
  last_study_at: string | null
  next_review_at: string | null
  review_label: string
}

export interface DashboardResponse {
  due_points: DueKnowledgePoint[]
  wrong_answer_count: number
  today_progress: {
    reviewed: number
    total_due: number
  }
}

export interface KnowledgePointData {
  point_id: string | null
  point_name: string
  mastery_score: number
  recent_accuracy: number
  consecutive_errors: number
  total_practiced: number
  study_count: number
  status: string
  last_practice_at: string | null
  next_review_at: string | null
  needs_review: boolean
}

export interface KnowledgeDomainData {
  id: string
  name: string
  points: KnowledgePointData[]
}

export interface SubjectData {
  id: string
  name: string
  total_points: number
  avg_mastery: number
  domains: KnowledgeDomainData[]
}

export const reviewApi = {
  getDashboard: () => api.get<DashboardResponse>('/review/dashboard'),
  markComplete: (pointId: string) => api.post(`/review/${pointId}/complete`),
  getKnowledgePoints: (subjectId?: string) =>
    api.get<{subjects: SubjectData[]}>('/review/knowledge-points', { params: subjectId ? { subject_id: subjectId } : {} }),
}
