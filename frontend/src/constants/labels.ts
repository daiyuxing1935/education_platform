export const QTYPE_LABELS: Record<string, string> = {
  single_choice: '单选题', multiple_choice: '多选题', fill_blank: '填空题',
  true_false: '判断题', short_answer: '简答题', programming: '编程题', essay: '论述题',
}

export const MODE_LABELS: Record<string, string> = {
  random: '随机练习', sequential: '顺序练习', exam: '模拟考试',
  weak_point: '薄弱点练习', adaptive: '自适应练习',
}

export const DIFF_LABELS: Record<string, string> = {
  beginner: '入门', basic: '基础', intermediate: '进阶', advanced: '挑战', competition: '竞赛',
}

export const STATUS_LABELS: Record<string, string> = {
  mastered: '已掌握', learning: '学习中', not_started: '未开始', reviewing: '待复习',
}
