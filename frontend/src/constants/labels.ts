export const QTYPE_LABELS: Record<string, string> = {
  single_choice: '单选题', multiple_choice: '多选题', fill_blank: '填空题',
  true_false: '判断题', short_answer: '简答题', programming: '编程题', essay: '论述题',
}

export const MODE_LABELS: Record<string, string> = {
  random: '随机练习', sequential: '顺序练习', exam: '模拟考试',
  weak_point: '薄弱点练习', adaptive: '自适应练习',
  wrong_answer: '错题练习',
}

export const DIFF_LABELS: Record<string, string> = {
  beginner: '入门', basic: '基础', intermediate: '进阶', advanced: '挑战', competition: '竞赛',
}

/** 获取难度标签，兼容字符串型（beginner）和数字型（1-5） */
export function getDifficultyLabel(diff: string | number | undefined | null): string {
  if (diff === undefined || diff === null) return '未知'
  // 数字型难度 1-5
  const num = typeof diff === 'string' ? parseInt(diff) : diff
  if (!isNaN(num) && num >= 1 && num <= 5) {
    return ['', '入门', '基础', '进阶', '挑战', '竞赛'][num] || '未知'
  }
  // 字符串型难度
  return DIFF_LABELS[diff] || String(diff)
}

export const STATUS_LABELS: Record<string, string> = {
  mastered: '已掌握', learning: '学习中', not_started: '未开始', reviewing: '待复习',
}
