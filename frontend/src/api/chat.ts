import api from './auth'

export const chatApi = {
  /** 推演下次可能提问 */
  getNextQuestions: (data: { conversation_history: Array<{ role: string; content: string }> }) =>
    api.post<{ questions: string[] }>('/chat/next-questions', data),
}
