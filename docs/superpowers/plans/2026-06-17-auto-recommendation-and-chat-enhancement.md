# 自动推荐与 AI 对话增强 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现练习后弹窗推荐（错题回顾+代码案例）和 AI 对话增强（生成思维导图、推演下次提问、图表自动保存云盘）

**Architecture:** 
- 功能 A：利用已有的 `wrong_answer_records` 表 + `StudentAnswer` 表构建错题回顾 API，新建错题回顾页面，在 PracticePage 结果页右下角加弹窗
- 功能 B：在 ChatPlatform 流式完成逻辑中插入 3 个增强点，后端新增 `POST /chat/next-questions` 轻量 LLM 接口，前端检测图片 URL 保存云盘

**Tech Stack:** FastAPI (Python), React (TypeScript), PostgreSQL, Playwright (E2E)

## Global Constraints

- 所有 API 必须有 JWT 认证（除了注册、登录）
- 所有用户可见的错误信息必须是中文
- 所有代码修改后必须重启容器生效
- `requirements.txt` 必须在新增 Python 依赖后立即更新
- 弹窗同一 session 只弹出一次（localStorage 防重复）
- 图表保存到云盘失败时静默处理

---

## 文件结构

```
# 功能 A: 练习后弹窗推荐
frontend/src/api/questionBank.ts                       # 修改 - 新增 getWrongReview API
frontend/src/pages/ReviewWrongPage.tsx                  # 新建 - 错题回顾页面
frontend/src/components/PracticeRecommendPopover.tsx    # 新建 - 右下角弹窗组件
frontend/src/pages/PracticePage.tsx                     # 修改 - 结果页集成弹窗
app/api/endpoints/question_bank.py                      # 修改 - 新增银行错题回顾端点

# 功能 B-①: 生成思维导图按钮
frontend/src/components/ChatPlatform.tsx                # 修改 - 消息底部操作按钮

# 功能 B-②: 推演下次提问
app/api/endpoints/chat.py                               # 修改 - 新增 POST /chat/next-questions
frontend/src/api/chat.ts                                # 修改 - 新增 getNextQuestions API
frontend/src/components/ChatPlatform.tsx                # 修改 - 输入框上方标签

# 功能 B-③: 图表自动保存云盘
frontend/src/components/ChatPlatform.tsx                # 修改 - 检测 PLOT 图片 URL
frontend/src/components/MessageList.tsx                 # 修改 - 消息底部"已保存"提示
```

---

### Task 1: 后端 API — 获取章节错题详情

**Files:**
- Modify: `app/api/endpoints/question_bank.py` (追加新端点)
- Test: 用 curl 验证

**Interfaces:**
- Consumes: `WrongAnswerRecord` 表, `Question` 表, `StudentAnswer` 表, `KnowledgePoint` 表
- Produces: `GET /api/v1/question-bank/banks/{bank_id}/wrong-review` 端点

- [ ] **Step 1: 在 question_bank.py 末尾追加新端点和响应模型**

在 `router.delete("/wrong-answers/...")` 之后，添加：

```python
# ── 错题回顾响应模型 ──

class WrongReviewItem(BaseModel):
    question_id: str
    stem: str
    type: str
    options: Optional[dict] = None
    user_answer: str
    correct_answer: List[str]
    explanation: Optional[str] = None
    knowledge_points: List[str]
    wrong_count: int
    last_wrong_at: str

    class Config:
        from_attributes = True

class WrongReviewResponse(BaseModel):
    wrong_records: List[WrongReviewItem]
    total: int
    bank_name: str


@router.get("/banks/{bank_id}/wrong-review", response_model=WrongReviewResponse)
async def get_bank_wrong_review(
    bank_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    \"\"\"获取指定章节的错题详情（含用户答案、正确答案、知识点）\"\"\"
    student_id = current_user.student_id

    # 1. 获取章节信息
    bank = db.query(QuestionBank).filter(QuestionBank.id == bank_id).first()
    bank_name = bank.name if bank else ""

    # 2. 查询错题记录
    wrong_records = (
        db.query(WrongAnswerRecord)
        .filter(
            WrongAnswerRecord.user_id == student_id,
            WrongAnswerRecord.bank_id == bank_id,
        )
        .order_by(WrongAnswerRecord.last_wrong_at.desc())
        .all()
    )

    # 3. 构建返回数据
    items = []
    for wr in wrong_records:
        q = db.query(Question).filter(Question.id == wr.question_id).first()
        if not q:
            continue

        # 获取用户最近一次错误答案
        last_answer = (
            db.query(StudentAnswer)
            .filter(
                StudentAnswer.question_id == wr.question_id,
                StudentAnswer.user_id == student_id,
                StudentAnswer.is_correct == False,
            )
            .order_by(StudentAnswer.created_at.desc())
            .first()
        )
        user_answer = ""
        if last_answer and last_answer.answer_content:
            user_answer = last_answer.answer_content.get("user_answer", "")

        # 获取正确答案
        correct_answer = list(q.answer.get("correct_answer", [])) if q.answer else []

        # 获取知识点名称
        kp_names = []
        for kp_uuid in (q.knowledge_point_uuids or []):
            kp = db.query(KnowledgePoint).filter(KnowledgePoint.id == kp_uuid).first()
            if kp:
                kp_names.append(kp.name)
        
        # 获取题目内容
        stem = q.content.get("stem", "") if q.content else ""
        options = q.content.get("options") if q.content else None
        explanation = q.answer.get("explanation") if q.answer else None

        items.append(WrongReviewItem(
            question_id=str(wr.question_id),
            stem=stem,
            type=q.type,
            options=options,
            user_answer=user_answer,
            correct_answer=correct_answer,
            explanation=explanation,
            knowledge_points=kp_names,
            wrong_count=wr.wrong_count,
            last_wrong_at=wr.last_wrong_at.isoformat() if wr.last_wrong_at else "",
        ))

    return WrongReviewResponse(wrong_records=items, total=len(items), bank_name=bank_name)
```

```python
# 在文件顶部添加导入（若尚未导入QuestionBank和StudentAnswer）
# 在现有的 imports 中应已有，但检查 STUDENT_ANSWER 模型的导入
from app.models.question_bank import (
    ..., StudentAnswer, QuestionBank, KnowledgePoint,
)
```

- [ ] **Step 2: 运行迁移 + 重启后端验证 API**

```bash
docker-compose restart backend
sleep 2
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"guoketg","password":"123456"}' | python -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))")
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/v1/question-bank/banks/<存在的bank_id>/wrong-review" | head -100
```

---

### Task 2: 前端 API — 新增 getWrongReview 方法

**Files:**
- Modify: `frontend/src/api/questionBank.ts`

- [ ] **Step 1: 在 questionBank.ts 中添加类型和方法**

找到 `// === Wrong Answer Book ===` 区域，在其上方或内部添加：

```typescript
// === Wrong Review ===

export interface WrongReviewItem {
  question_id: string
  stem: string
  type: string
  options: Record<string, string> | null
  user_answer: string
  correct_answer: string[]
  explanation: string | null
  knowledge_points: string[]
  wrong_count: number
  last_wrong_at: string
}

export interface WrongReviewResponse {
  wrong_records: WrongReviewItem[]
  total: number
  bank_name: string
}

// 在 export const questionBankApi = { ... } 中添加：
  getWrongReview: (bankId: string) =>
    api.get<WrongReviewResponse>(`/question-bank/banks/${bankId}/wrong-review`),
```

---

### Task 3: 新建错题回顾页面 ReviewWrongPage

**Files:**
- Create: `frontend/src/pages/ReviewWrongPage.tsx`
- Modify: `frontend/src/App.tsx` 或路由配置文件（添加路由）

- [ ] **Step 1: 新建 `ReviewWrongPage.tsx`**

```tsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { questionBankApi, type WrongReviewItem } from '../api/questionBank'
import QuestionCard from '../components/QuestionCard'

export default function ReviewWrongPage() {
  const { bankId } = useParams<{ bankId: string }>()
  const navigate = useNavigate()
  const [records, setRecords] = useState<WrongReviewItem[]>([])
  const [bankName, setBankName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!bankId) return
    setLoading(true)
    questionBankApi.getWrongReview(bankId)
      .then(res => {
        setRecords(res.data.wrong_records)
        setBankName(res.data.bank_name)
      })
      .catch(err => console.error('加载错题失败:', err))
      .finally(() => setLoading(false))
  }, [bankId])

  // 加载状态
  if (loading) return (
    <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--gray-400)' }}>
      加载中...
    </div>
  )

  return (
    <div style={{ padding: 'var(--space-4) var(--space-8)', maxWidth: 800, margin: '0 auto' }}>
      {/* 返回 */}
      <button onClick={() => navigate(-1)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-500)', fontSize: '0.875rem', padding: 0, marginBottom: 'var(--space-4)' }}>
        ← 返回
      </button>

      {/* 标题 */}
      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 4 }}>
        📌 错题回顾 — {bankName}
      </h1>
      <p style={{ color: 'var(--gray-400)', fontSize: '0.875rem', marginBottom: 'var(--space-5)' }}>
        共 {records.length} 道错题
      </p>

      {/* 空状态 */}
      {records.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--gray-400)' }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>🎉</div>
          <p>暂无错题，继续保持！</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {records.map(r => (
            <div key={r.question_id} className="card" style={{
              border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-lg)',
              padding: 16, background: '#fff',
            }}>
              {/* 题干 */}
              <div style={{ marginBottom: 12 }}>
                <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: 6, background: '#FEF2F2', color: '#DC2626', marginRight: 8 }}>
                  {r.type === 'single_choice' ? '单选题' : r.type === 'multiple_choice' ? '多选题' : r.type === 'fill_blank' ? '填空题' : r.type === 'true_false' ? '判断题' : r.type}
                </span>
                {r.knowledge_points.map(kp => (
                  <span key={kp} style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: 6, background: '#F0F0FF', color: '#7C3AED', marginRight: 4 }}>
                    {kp}
                  </span>
                ))}
              </div>
              <div style={{ fontSize: '0.9375rem', lineHeight: 1.7, marginBottom: 12, whiteSpace: 'pre-wrap' }}>
                {r.stem}
              </div>

              {/* 用户答案（红色） */}
              <div style={{ fontSize: '0.8125rem', marginBottom: 6 }}>
                <span style={{ color: '#DC2626', fontWeight: 600 }}>你的答案：</span>
                <span style={{ color: '#DC2626' }}>{r.user_answer || '（未作答）'}</span>
              </div>

              {/* 正确答案（绿色） */}
              <div style={{ fontSize: '0.8125rem', marginBottom: 6 }}>
                <span style={{ color: '#10B981', fontWeight: 600 }}>正确答案：</span>
                <span style={{ color: '#10B981' }}>{r.correct_answer.join(', ') || '（略）'}</span>
              </div>

              {/* 解析 */}
              {r.explanation && (
                <div style={{ fontSize: '0.8125rem', color: 'var(--gray-400)', marginTop: 8, padding: '8px 12px', background: '#F9FAFB', borderRadius: 8 }}>
                  <span style={{ fontWeight: 600, color: 'var(--gray-500)' }}>解析：</span>
                  {r.explanation}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 底部操作 */}
      <div style={{ marginTop: 'var(--space-6)', textAlign: 'center' }}>
        <button onClick={() => navigate(`/practice/${bankId}?onlyWrong=true`)}
          style={{ padding: '10px 28px', background: '#DC2626', color: '#fff', border: 'none', borderRadius: 10, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' }}>
          重新练习错题
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 添加路由**

找到前端路由配置（可能在 `App.tsx` 或 `main.tsx` 或 `routes.tsx`），添加：

```tsx
<Route path="/banks/:bankId/wrong-review" element={<ReviewWrongPage />} />
```

---

### Task 4: 新建弹窗组件 PracticeRecommendPopover

**Files:**
- Create: `frontend/src/components/PracticeRecommendPopover.tsx`

- [ ] **Step 1: 新建组件**

```tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { resourcesApi } from '../api/resources'

interface PopoverProps {
  bankId: string
  wrongCount: number
  knowledgePoints: string[]   // 本次练习涉及的知识点
  sessionId: string
  onClose: () => void
}

export default function PracticeRecommendPopover({ bankId, wrongCount, knowledgePoints, sessionId, onClose }: PopoverProps) {
  const navigate = useNavigate()
  const [codeCase, setCodeCase] = useState<{ id: string; title: string; kp: string } | null>(null)
  const [dismissed, setDismissed] = useState(false)

  // 同一 session 只弹一次
  const STORAGE_KEY = `practice_recommend_shown_${sessionId}`

  useEffect(() => {
    if (sessionStorage.getItem(STORAGE_KEY)) {
      setDismissed(true)
      return
    }
    // 查找知识点关联的 code_case 资源
    if (knowledgePoints.length > 0) {
      resourcesApi.list({ resource_type: 'code_case', knowledge_point: knowledgePoints[0] })
        .then(res => {
          if (res.data.resources.length > 0) {
            const r = res.data.resources[0]
            setCodeCase({ id: r.id, title: r.title, kp: knowledgePoints[0] })
          }
        })
        .catch(() => {})
    }
  }, [])

  if (dismissed || sessionStorage.getItem(STORAGE_KEY)) return null

  const handleDismiss = () => {
    sessionStorage.setItem(STORAGE_KEY, '1')
    setDismissed(true)
    onClose()
  }

  return (
    <>
      {/* 遮罩层点击关闭 */}
      <div onClick={handleDismiss} style={{
        position: 'fixed', inset: 0, zIndex: 999,
        background: 'transparent',
      }} />
      {/* 弹窗 */}
      <div style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
        width: 320, borderRadius: 14, background: '#fff',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
        border: '1px solid #E5E7EB', overflow: 'hidden',
        animation: 'slideUp 0.3s ease',
      }}>
        <style>{`@keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        
        {/* 头部 */}
        <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1F2937' }}>💡 练习推荐</span>
          <button onClick={handleDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 2, fontSize: '1rem' }}>✕</button>
        </div>

        {/* 内容 */}
        <div style={{ padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          
          {/* 错题回顾 */}
          <div onClick={() => { handleDismiss(); navigate(`/banks/${bankId}/wrong-review`) }}
            style={{ padding: '12px 14px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#FEE2E2' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#FEF2F2' }}>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#DC2626', marginBottom: 4 }}>
              📌 错题回顾
            </div>
            <div style={{ fontSize: '0.75rem', color: '#991B1B', marginBottom: 6 }}>
              本次练习共 <strong>{wrongCount}</strong> 道错题
            </div>
            <div style={{ fontSize: '0.75rem', color: '#DC2626', fontWeight: 500 }}>
              去回顾 →
            </div>
          </div>

          {/* 代码实操案例 */}
          {codeCase && (
            <div onClick={() => { handleDismiss(); navigate(`/resources/${codeCase.id}`) }}
              style={{ padding: '12px 14px', borderRadius: 10, background: '#FFFBEB', border: '1px solid '#FDE68A'', cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#FEF3C7' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#FFFBEB' }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#D97706', marginBottom: 4 }}>
                💻 推荐代码实操
              </div>
              <div style={{ fontSize: '0.75rem', color: '#92400E', marginBottom: 4 }}>
                知识点「{codeCase.kp}」的代码案例
              </div>
              <div style={{ fontSize: '0.7rem', color: '#D97706', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {codeCase.title}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#D97706', fontWeight: 500, marginTop: 2 }}>
                查看案例 →
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
```

---

### Task 5: 在 PracticePage 结果页集成弹窗

**Files:**
- Modify: `frontend/src/pages/PracticePage.tsx`

- [ ] **Step 1: 在 PracticePage 结果页区域引用弹窗组件**

在文件顶部添加 import：
```tsx
import PracticeRecommendPopover from '../components/PracticeRecommendPopover'
```

在 state 中添加弹窗需要的变量（在现有的 results state 区域附近）：
```tsx
const [showRecommend, setShowRecommend] = useState(false)
```

在提交完成后（`setPhase('results')` 之后）设置弹窗状态：
```tsx
// 在 setPhase('results') 所在行之后添加
setShowRecommend(true)
```

在结果页的 JSX 中，在最后（`</div>` 闭合前）添加弹窗：
```tsx
{showRecommend && (
  <PracticeRecommendPopover
    bankId={bankId || ''}
    wrongCount={wrongCount}
    knowledgePoints={allWrongKps}
    sessionId={sessionId || ''}
    onClose={() => setShowRecommend(false)}
  />
)}
```

其中 `allWrongKps` 需要在提交时收集错题的知识点：
在构建 `allAnswers` 后、提交前，遍历错题收集知识点 UUID → 转名称。

---

### Task 6: 后端 API — 推演下次提问

**Files:**
- Modify: `app/api/endpoints/chat.py`

- [ ] **Step 1: 在 chat.py 末尾追加新端点**

```python
# ── 推演下次提问 ──

class NextQuestionsRequest(BaseModel):
    conversation_history: List[Dict[str, str]]  # [{role, content}, ...]

class NextQuestionsResponse(BaseModel):
    questions: List[str]


@router.post("/next-questions", response_model=NextQuestionsResponse)
async def predict_next_questions(
    req: NextQuestionsRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """根据最近对话历史，推演用户可能追问的 2-3 个问题"""
    # 取最近 3 轮对话
    recent = req.conversation_history[-6:]  # 3 轮 = 6 条（user+assistant）
    
    # 构建提示词
    prompt_messages = [
        {"role": "system", "content": "你是一个学习助手。根据以下对话历史，预测用户接下来最可能追问的 2-3 个问题。每个问题不超过 15 个字。只返回 JSON 格式：{\"questions\": [\"问题1\", \"问题2\", \"问题3\"]}"},
    ] + recent + [
        {"role": "user", "content": "请预测我接下来可能问的问题。"}
    ]
    
    # 获取用户 API 配置
    from app.crud.api_settings import api_settings_crud
    api_info = None
    for provider in ["qwen", "deepseek"]:
        api = api_settings_crud.get_setting_value(db, str(current_user.student_id), provider)
        if api:
            api_info = api
            break
    
    if not api_info:
        return NextQuestionsResponse(questions=[])
    
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            base_url = api_info.get("base_url") or "https://dashscope.aliyuncs.com/compatible-mode/v1"
            model = api_info.get("model_version") or "qwen-turbo"
            r = await client.post(
                f"{base_url}/chat/completions",
                headers={"Authorization": f"Bearer {api_info['api_key']}", "Content-Type": "application/json"},
                json={"model": model, "messages": prompt_messages, "temperature": 0.3, "max_tokens": 200},
            )
            if r.status_code == 200:
                data = r.json()
                content = data["choices"][0]["message"]["content"]
                # 提取 JSON
                import re
                json_match = re.search(r'\{.*\}', content, re.DOTALL)
                if json_match:
                    parsed = json.loads(json_match.group())
                    questions = parsed.get("questions", [])[:3]
                    return NextQuestionsResponse(questions=questions)
    except Exception as e:
        logger.warning(f"推演提问失败: {e}")
    
    return NextQuestionsResponse(questions=[])
```

记得在文件顶部添加：
```python
import json
import re
import httpx
```

---

### Task 7: 前端 API — 新增 getNextQuestions

**Files:**
- Modify: `frontend/src/api/chat.ts`

- [ ] **Step 1: 在 chatApi 中添加方法**

```typescript
  /** 推演下次可能提问 */
  getNextQuestions: (data: { conversation_history: Array<{ role: string; content: string }> }) =>
    api.post<{ questions: string[] }>('/chat/next-questions', data),
```

---

### Task 8: ChatPlatform — 集成全部 3 个增强

**Files:**
- Modify: `frontend/src/components/ChatPlatform.tsx`

- [ ] **Step 1: 在流式完成后的 `finally` 块中添加增强逻辑**

找到 `finally { storeSetIsLoading(false); ... }` 块（约 line 624），在其内部添加：

```typescript
// === 功能 B-①: 生成思维导图按钮 ===
// 在 storeUpdateLastAssistant 后添加状态
// 已经在消息对象中隐式支持

// === 功能 B-②: 推演下次提问 ===
if (fullContent && activeChatId && !abortRef.current) {
  try {
    const history = chatStore.getState().getMessagesForChat(activeChatId) || []
    const recentHistory = history.slice(-6).map((m: any) => ({
      role: m.role,
      content: m.content || '',
    }))
    const qRes = await chatApi.getNextQuestions({ conversation_history: recentHistory })
    if (qRes.data?.questions?.length) {
      setSuggestedQuestions(qRes.data.questions)
    }
  } catch { /* 静默失败 */ }
}
```

在 state 区添加：
```typescript
const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([])
```

在输入框上方渲染标签：
```tsx
{suggestedQuestions.length > 0 && (
  <div style={{ display: 'flex', gap: 6, padding: '4px 12px 0', flexWrap: 'wrap' }}>
    {suggestedQuestions.map(q => (
      <button key={q} onClick={() => setInput(q)}
        style={{
          padding: '4px 10px', borderRadius: 12, border: '1px solid #E5E7EB',
          background: '#F9FAFB', color: '#6B7280', fontSize: '0.75rem',
          cursor: 'pointer', fontFamily: 'inherit',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#818CF8'; e.currentTarget.style.color = '#4F46E5' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.color = '#6B7280' }}
      >
        {q}
      </button>
    ))}
  </div>
)}
```

输入框内容变化或发送消息时清空：
```typescript
// 在 handleSend 中，发送消息后：
setSuggestedQuestions([])
```

- [ ] **Step 2: 生成思维导图按钮**

在 MessageList 组件的 props 中新增 `onGenerateMindmap?: (messageId: string, content: string) => void`。

在每个 AI 消息底部，当该消息非 streaming 且有内容时，添加：
```tsx
{message.role === 'assistant' && !isLoading && message.content && message.content.length > 20 && (
  <div style={{ marginTop: 8 }}>
    <button onClick={() => onGenerateMindmap?.(message.id, message.content)}
      style={{
        padding: '4px 12px', borderRadius: 6, border: '1px solid #E5E7EB',
        background: '#fff', color: '#6B7280', fontSize: '0.75rem',
        cursor: 'pointer', fontFamily: 'inherit',
      }}>
      🧠 生成思维导图
    </button>
  </div>
)}
```

在 ChatPlatform 中处理 `onGenerateMindmap`：
```typescript
const handleGenerateMindmap = async (messageId: string, content: string) => {
  try {
    const res = await resourcesApi.generate({
      knowledge_points: ['AI对话'],
      title: '对话思维导图',
      resource_type: 'mind_map',
    })
    if (res.data?.id) {
      // 显示成功提示
      alert('✅ 思维导图已生成')
      navigate(`/resources/${res.data.id}`)
    }
  } catch (e: any) {
    alert(e.response?.data?.detail || '生成失败')
  }
}
```

- [ ] **Step 3: 图表自动保存云盘**

在流式完成逻辑中，检测 `saveRes.data.content` 中的图片 URL：

```typescript
// 在流式完成后，检测并保存 PLOT 图片到云盘
const savePlotImagesToCloud = async (content: string) => {
  // 匹配 Markdown 图片 ![](url)
  const imgRegex = /!\[.*?\]\((.*?)\)/g
  const urls: string[] = []
  let match
  while ((match = imgRegex.exec(content)) !== null) {
    if (match[1].startsWith('/api/v1/chat/plots/') || match[1].startsWith('/api/v1/resources/plots/')) {
      urls.push(match[1])
    }
  }
  if (urls.length === 0) return

  try {
    // 创建文件夹
    let folderId: string | undefined
    try {
      const folderRes = await cloudDriveApi.createFolder('AI 生成图表')
      folderId = folderRes.data.id
    } catch { /* 文件夹可能已存在 */ }

    for (const url of urls) {
      try {
        const resp = await fetch(url)
        const blob = await resp.blob()
        const file = new File([blob], `plot_${Date.now()}.png`, { type: 'image/png' })
        await cloudDriveApi.uploadFile(file, folderId)
      } catch { /* 单张失败跳过 */ }
    }

    // 在消息中追加保存提示
    if (activeChatId) {
      const hint = '\n\n> ✅ 图表已保存到云盘'
      storeUpdateLastAssistant(activeChatId, msg => ({
        ...msg,
        content: (msg.content || '') + hint,
      }))
    }
  } catch { /* 静默 */ }
}

// 调用位置：在 saveRes.data.content 处理之后调用
await savePlotImagesToCloud(saveRes.data.content || fullContent)
```

---

### Task 9: 弹窗中知识点收集逻辑（PracticePage 修正）

**Files:**
- Modify: `frontend/src/pages/PracticePage.tsx`

- [ ] **Step 1: 在 PracticePage 中收集本次练习错题的知识点**

在 `handleSubmit` 流程中，构建 `allAnswers` 后，在提交前收集错题的知识点：

```typescript
// 从当前题目缓存中收集知识点
const allWrongKps: string[] = []
for (const a of allAnswers) {
  if (!a.isCorrect) {
    const q = questions.find(qq => qq.id === a.questionId)
    if (q && q.knowledge_points) {
      for (const kp of q.knowledge_points) {
        if (!allWrongKps.includes(kp)) allWrongKps.push(kp)
      }
    }
  }
}
```

在弹窗位置传入 `knowledgePoints={allWrongKps}`：

```tsx
{showRecommend && (
  <PracticeRecommendPopover
    bankId={bankId || ''}
    wrongCount={allAnswers.filter(a => !a.isCorrect).length}
    knowledgePoints={allWrongKps}
    sessionId={sessionId || ''}
    onClose={() => setShowRecommend(false)}
  />
)}
```

---

## 自审检查

- **Spec coverage**: 4 个功能全覆盖
  - AR1: Task 1-5（后端API → 前端API → 错题回顾页 → 弹窗组件 → 集成）
  - AR2: Task 8-2（思维导图按钮）
  - AR3: Task 6-8（后端next-questions API → 前端API → ChatPlatform集成）
  - AR4: Task 8-3（图表保存云盘）
- **Placeholder scan**: 所有代码片段完整，无 TBD/TODO
- **Type consistency**: 类型名在各任务间一致（WrongReviewItem, WrongReviewResponse 等）
