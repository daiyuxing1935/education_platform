import { useState, useMemo, useCallback } from 'react'

/* ── Types ── */

interface Question {
  id: number
  stem: string
  options: { label: string; text: string }[]
  correct: string
  explanation?: string
}

interface ExerciseData {
  title: string
  description: string
  questions: Question[]
}

/* ── Parser ── */

function parseExerciseContent(md: string): ExerciseData | null {
  const lines = md.split('\n')
  const title = lines[0]?.replace(/^#+\s*/, '').trim() || '练习题'
  const descEnd = md.indexOf('## ') > 0 ? md.indexOf('## ') : md.length
  const description = md.substring(md.indexOf('\n'), descEnd).trim()

  const questions: Question[] = []
  const qBlocks = md.split(/^##+/m).slice(1) // split by ## headers
  let qId = 0

  for (const block of qBlocks) {
    const lines = block.trim().split('\n')
    if (lines.length < 2) continue

    // First line is stem
    const stem = lines[0].replace(/^Q?\d*[\.\)、]\s*/, '').trim()
    // Parse correct answer line
    const correctLine = lines.find(l => /^(\*{0,2}（?\s*(正确答案|答案|Correct|Answer)\s*[:：]?\s*)\**\s*([A-Da-d])/.test(l.trim()))
    const correctMatch = correctLine?.match(/[A-Da-d]/)
    if (!correctMatch) continue

    const correct = correctMatch[0].toUpperCase()
    // Parse options (lines with A), B), C), D) or A., B., C., D.)
    const options: { label: string; text: string }[] = []
    for (const line of lines) {
      const optMatch = line.trim().match(/^([A-Da-d])[\.\)、]\s*(.+)/)
      if (optMatch) {
        options.push({ label: optMatch[1].toUpperCase(), text: optMatch[2].trim() })
      }
    }
    if (options.length === 0) continue

    // Parse explanation line
    const explLine = lines.find(l => /^(\*{0,2}（?\s*(解析|解释|Explanation|解析)\s*[:：]?\s*)/.test(l.trim()))
    const explanation = explLine?.replace(/^(\*{0,2}（?\s*(解析|解释|Explanation|解析)\s*[:：]?\s*)\*{0,2}/, '').trim()

    qId++
    questions.push({ id: qId, stem, options, correct, explanation })
  }

  if (questions.length === 0) return null
  return { title, description, questions }
}

/* ── Component ── */

interface ExercisePlayerProps {
  content: string
}

export default function ExercisePlayer({ content }: ExercisePlayerProps) {
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [showResult, setShowResult] = useState(false)

  const exercise = useMemo(() => parseExerciseContent(content), [content])

  const handleSelect = useCallback((qId: number, label: string) => {
    if (submitted) return
    setAnswers(prev => ({ ...prev, [qId]: label }))
  }, [submitted])

  const handleSubmit = useCallback(() => {
    setSubmitted(true)
    setShowResult(true)
  }, [])

  const handleReset = useCallback(() => {
    setAnswers({})
    setSubmitted(false)
    setShowResult(false)
  }, [])

  if (!exercise) {
    return (
      <div style={{ padding: 24, color: 'var(--gray-500)', textAlign: 'center' }}>
        未能解析题目内容，请检查格式
      </div>
    )
  }

  const total = exercise.questions.length
  const answered = Object.keys(answers).length
  const correct = exercise.questions.filter(q => answers[q.id] === q.correct).length
  const score = total > 0 ? Math.round((correct / total) * 100) : 0

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #EEF2FF, #E0E7FF)',
        borderRadius: 12, padding: '16px 20px', marginBottom: 16,
        border: '1px solid #C7D2FE',
      }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#1E293B' }}>
          📝 {exercise.title}
        </h2>
        {exercise.description && (
          <p style={{ margin: '6px 0 0', fontSize: '0.85rem', color: '#475569', lineHeight: 1.6 }}>
            {exercise.description}
          </p>
        )}
        {showResult && (
          <div style={{
            marginTop: 10, padding: '8px 14px', borderRadius: 8,
            background: score >= 80 ? '#DCFCE7' : score >= 50 ? '#FEF9C3' : '#FEE2E2',
            color: score >= 80 ? '#166534' : score >= 50 ? '#854D0E' : '#991B1B',
            fontSize: '0.875rem', fontWeight: 600,
          }}>
            {correct}/{total} 正确 ({score}%)
            {score >= 80 ? ' 🎉' : score >= 50 ? ' 💪' : ' 📚'}
          </div>
        )}
      </div>

      {/* Questions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {exercise.questions.map((q, qi) => {
          const selected = answers[q.id]
          const isCorrect = submitted && selected === q.correct
          const isWrong = submitted && selected && selected !== q.correct
          const isSkipped = submitted && !selected

          return (
            <div key={q.id} style={{
              borderRadius: 10, border: '1px solid #E5E7EB', overflow: 'hidden',
              background: isCorrect ? '#F0FDF4' : isWrong ? '#FEF2F2' : isSkipped ? '#FEFCE8' : '#fff',
              borderColor: isCorrect ? '#BBF7D0' : isWrong ? '#FECACA' : isSkipped ? '#FDE68A' : '#E5E7EB',
            }}>
              {/* Stem */}
              <div style={{
                padding: '12px 16px', fontWeight: 600, fontSize: '0.9rem',
                background: isCorrect ? '#DCFCE7' : isWrong ? '#FEE2E2' : '#F8FAFC',
                color: '#1E293B',
              }}>
                {qi + 1}. {q.stem}
              </div>

              {/* Options */}
              <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {q.options.map(opt => {
                  const isSelected = selected === opt.label
                  const isCorrectOpt = submitted && q.correct === opt.label
                  const isWrongOpt = submitted && isSelected && !isCorrectOpt

                  return (
                    <div key={opt.label}
                      onClick={() => handleSelect(q.id, opt.label)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 12px', borderRadius: 8, cursor: submitted ? 'default' : 'pointer',
                        border: '1px solid',
                        borderColor: isCorrectOpt ? '#4ADE80' : isWrongOpt ? '#F87171' : '#E5E7EB',
                        background: isCorrectOpt ? '#DCFCE7' : isWrongOpt ? '#FEE2E2' : isSelected ? '#EFF6FF' : '#fff',
                        transition: 'all 0.15s',
                        opacity: submitted && !isCorrectOpt && !isWrongOpt ? 0.5 : 1,
                      }}
                    >
                      <div style={{
                        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.72rem', fontWeight: 700,
                        background: isCorrectOpt ? '#4ADE80' : isWrongOpt ? '#F87171' : isSelected ? '#3B82F6' : '#F1F5F9',
                        color: (isCorrectOpt || isWrongOpt || isSelected) ? '#fff' : '#64748B',
                      }}>
                        {isCorrectOpt ? '✓' : isWrongOpt ? '✗' : opt.label}
                      </div>
                      <span style={{ fontSize: '0.875rem', color: '#374151' }}>{opt.text}</span>
                    </div>
                  )
                })}
              </div>

              {/* Explanation */}
              {submitted && q.explanation && (
                <div style={{
                  padding: '10px 16px', fontSize: '0.8rem', color: '#475569',
                  background: '#F8FAFC', borderTop: '1px solid #E5E7EB', lineHeight: 1.6,
                }}>
                  💡 {q.explanation}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 20, marginBottom: 24 }}>
        {!submitted ? (
          <button onClick={handleSubmit} disabled={answered === 0}
            style={{
              padding: '10px 32px', borderRadius: 8, border: 'none', fontSize: '0.9rem', fontWeight: 600,
              background: answered > 0 ? '#4F46E5' : '#9CA3AF', color: '#fff', cursor: answered > 0 ? 'pointer' : 'default',
              fontFamily: 'inherit',
            }}>
            提交答案 ({answered}/{total})
          </button>
        ) : (
          <button onClick={handleReset}
            style={{
              padding: '10px 24px', borderRadius: 8, border: '1px solid #D1D5DB',
              fontSize: '0.85rem', background: '#fff', color: '#374151', cursor: 'pointer',
              fontFamily: 'inherit',
            }}>
            🔄 重新答题
          </button>
        )}
      </div>
    </div>
  )
}
