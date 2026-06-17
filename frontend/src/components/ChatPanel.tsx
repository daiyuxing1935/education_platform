import { useState, useEffect } from 'react'
import LayerSwitcher from './LayerSwitcher'
import ChatMessages from './ChatMessages'
import ChatInputArea from './ChatInputArea'
import MarkdownRenderer from './MarkdownRenderer'
import { CloseIcon } from './Icons'

type Level = 'L1' | 'L2' | 'L3'

interface Message {
  id: string
  conversationId: string
  content: string
  level: Level
  timestamp: number
  role: 'system' | 'assistant' | 'user'
}

const LEVEL_INSTRUCTIONS: Record<Level, string> = {
  L1: '请给出简要思路和关键点提示，不需要详细展开。',
  L2: '请逐步详细解释解题过程，分析核心考点和关键知识点的运用。',
  L3: '请进行拓展延伸，包括：知识点的深入分析、举一反三的类似题型、常见的易错点和避坑建议。',
}

export default function ChatPanel({
  visible, questionId, question, recommendedLevel = 'L2', onClose,
}: {
  visible: boolean
  questionId: string
  question?: { stem: string; type: string; answer?: string; difficulty?: string }
  recommendedLevel?: Level
  onClose: () => void
}) {
  const [currentLevel, setCurrentLevel] = useState<Level>(recommendedLevel)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [conversationId, setConversationId] = useState('')
  const [apiError, setApiError] = useState('')

  useEffect(() => {
    if (visible) {
      setCurrentLevel(recommendedLevel)
      setConversationId(`conv_${questionId}_${Date.now()}`)
      setMessages([{
        id: `msg_welcome_${Date.now()}`,
        conversationId: `conv_${questionId}`,
        content: question
          ? `你好！我来帮你解答这道题目。你可以选择不同的解答层级，或输入你的具体问题。`
          : '你好！我来帮你解答这道题目。你可以选择不同的解答层级，或输入你的具体问题。',
        level: 'L2',
        timestamp: Date.now(),
        role: 'system',
      }])
      setApiError('')
    }
  }, [visible, questionId, recommendedLevel])

  const buildSystemPrompt = (level: Level): string => {
    let prompt = `你是一个专业的智能答疑助手。${LEVEL_INSTRUCTIONS[level]}

重要原则：
1. 根据题目的具体知识点进行个性化讲解，不要给出泛泛而谈的通用回答
2. 明确指出题目考察的核心考点和知识点
3. 结合题目具体内容进行分析，而不是套用模板
4. 用中文回答，条理清晰`

    if (question) {
      prompt += `\n\n当前题目信息：
- 题型：${question.type}
- 难度：${question.difficulty || '未指定'}
- 题干：${question.stem}`
      if (question.answer) {
        prompt += `\n- 正确答案：${question.answer}`
      }
      prompt += `\n\n请围绕这道具体题目进行解答，分析其核心考点，不要给出与题目无关的通用内容。`
    }

    return prompt
  }

  const streamChat = async (userMsg: string, level: Level) => {
    setLoading(true)
    setApiError('')

    try {
      const token = localStorage.getItem('access_token')
      const historyMessages = messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .slice(-10)
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

      const apiMessages = [
        { role: 'system' as const, content: buildSystemPrompt(level) },
        ...historyMessages,
        ...(userMsg ? [{ role: 'user' as const, content: userMsg }] : [{ role: 'user' as const, content: `请以${level === 'L1' ? '简要思路' : level === 'L2' ? '分步详解' : '拓展延伸'}的方式帮我分析这道题` }]),
      ]

      const response = await fetch('/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          model: 'deepseek',
          messages: apiMessages,
          stream: true,
          temperature: 0.7,
        }),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error((errData as any).detail || `请求失败 (${response.status})`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('无法读取响应流')

      const decoder = new TextDecoder()
      let fullContent = ''

      const assistantMsg: Message = {
        id: `msg_${Date.now()}`,
        conversationId,
        content: '',
        level,
        timestamp: Date.now(),
        role: 'assistant',
      }
      setMessages(prev => [...prev, assistantMsg])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n').filter(line => line.trim().startsWith('data:'))

        for (const line of lines) {
          const data = line.replace(/^data:\s*/, '').trim()
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            const content = parsed.choices?.[0]?.delta?.content || ''
            if (content) {
              fullContent += content
              setMessages(prev => prev.map(m =>
                m.id === assistantMsg.id ? { ...m, content: fullContent } : m
              ))
            }
          } catch { /* skip malformed JSON */ }
        }
      }

      if (!fullContent) {
        setMessages(prev => prev.map(m =>
          m.id === assistantMsg.id ? { ...m, content: '抱歉，未能获取到回答，请重试。' } : m
        ))
      }
    } catch (err: any) {
      const errMsg = err.message || '请求失败，请检查网络或 API 配置'
      setApiError(errMsg)
      setMessages(prev => [...prev, {
        id: `msg_err_${Date.now()}`,
        conversationId,
        content: `出错了：${errMsg}`,
        level,
        timestamp: Date.now(),
        role: 'assistant',
      }])
    }
    setLoading(false)
  }

  const handleLevelChange = (level: Level) => {
    if (level === currentLevel) return
    setCurrentLevel(level)
    streamChat('', level)
  }

  const handleSendMessage = (text: string) => {
    const userMsg: Message = {
      id: `msg_user_${Date.now()}`,
      conversationId,
      content: text,
      level: currentLevel,
      timestamp: Date.now(),
      role: 'user',
    }
    setMessages(prev => [...prev, userMsg])
    streamChat(text, currentLevel)
  }

  const handleFeedback = (messageId: string, rating: 1 | -1) => {
    console.log(`Feedback: message=${messageId}, rating=${rating}`)
  }

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.5)',
    }}>
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: '70vh', background: 'var(--app-bg-card-alt)',
        borderRadius: '24px 24px 0 0',
        display: 'flex', flexDirection: 'column',
        animation: 'slideUp 0.3s ease-out',
        ...(window.innerWidth >= 768 ? {
          left: 'auto', right: 0, width: '50%', height: '100%', borderRadius: 0,
        } : {}),
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 20px', background: '#fff',
          borderRadius: '24px 24px 0 0',
          boxShadow: '0 1px 8px rgba(0,0,0,0.05)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '17px', fontWeight: 600, color: 'var(--app-text-heading)' }}>智能答疑</span>
            <span style={{ fontSize: '11px', padding: '3px 12px', background: 'rgba(30,58,138,0.1)', color: 'var(--app-brand)', borderRadius: 10 }}>
              题目 #{questionId.slice(0, 8)}
            </span>
          </div>
          <button onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--app-bg-page)', border: 'none', fontSize: '14px', color: 'var(--app-text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CloseIcon size={16} />
          </button>
        </div>

        {/* Layer Switcher */}
        <div style={{ padding: '12px 16px', background: '#fff', borderBottom: '1px solid #E5E7EB' }}>
          <LayerSwitcher currentLevel={currentLevel} recommendedLevel={recommendedLevel} onSelect={handleLevelChange} />
        </div>

        {/* Question context */}
        {question && (
          <div style={{ padding: '12px 16px', background: 'var(--app-brand-bg)', borderBottom: '1px solid #E5E7EB', fontSize: '13px', color: 'var(--app-text-body)', lineHeight: 1.6, maxHeight: 100, overflow: 'auto' }}>
            <MarkdownRenderer content={question.stem} />
          </div>
        )}

        {/* Error */}
        {apiError && (
          <div style={{ padding: '8px 16px', background: 'var(--app-bg-danger)', color: 'var(--app-danger)', fontSize: '12px', borderBottom: '1px solid #FEE2E2' }}>
            {apiError}
          </div>
        )}

        {/* Messages */}
        <ChatMessages messages={messages} loading={loading} onFeedback={handleFeedback} />

        {/* Input */}
        <ChatInputArea onSend={handleSendMessage} />
      </div>
    </div>
  )
}
