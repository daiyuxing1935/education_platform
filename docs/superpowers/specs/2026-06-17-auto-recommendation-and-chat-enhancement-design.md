# 自动推荐与 AI 对话增强设计文档

> **版本**: v1.0
> **日期**: 2026-06-17
> **关联项目**: Education Agent - 个性化学习资源生成与学习多智能体系统
> **对应赛题**: A3-基于大模型的个性化资源生成与学习多智能体系统开发

---

## 一、功能 A：练习后弹窗推荐

### 1.1 用户流程

```
用户进入练习页 → 完成练习 → 提交答案 → 看到练习结果页
                                              ↓
                                    右下角弹出推荐浮窗
                                     ├── 📌 错题回顾（含错题数）
                                     └── 💻 代码实操案例（根据知识点推荐）
                                              ↓
                                    点击跳转到对应页面
```

### 1.2 新增页面：错题回顾页

**路由**: `/banks/{bankId}/wrong-review`

**页面内容**:
- 顶部：章节名称 + 返回按钮
- 错题列表：每题一张卡片
  - 题干（QuestionCard 组件渲染）
  - 用户提交的答案（红色标注）
  - 正确答案（绿色标注）
  - 关联知识点标签（点击可筛选）
  - 题目类型标签
- 底部操作：重新练习错题（跳转到 PracticePage?onlyWrong=true）

**数据来源**:
- 后端新增 API: `GET /api/v1/question-bank/banks/{bankId}/wrong-records`
- 返回当前用户在该题库下的所有错题记录，含题目内容、用户答案、正确答案、知识点

### 1.3 新增组件：练习结果弹窗

**位置**: `PracticePage.tsx` 结果页右下角

**组件**: `PracticeRecommendPopover.tsx`

**触发条件**: 练习提交成功 → 进入 results phase

**关闭逻辑**:
- 点击弹窗内按钮后自动关闭
- 点击弹窗外区域关闭
- 同一 session 仅弹出一次（localStorage 记录 `practice_recommend_shown_{sessionId}`）

**弹窗内容**:
```
┌─────────────────────────────────┐
│ 📌 错题回顾                     │
│ 本次练习共 X 道错题             │
│ [去回顾 →]                      │
├─────────────────────────────────┤
│ 💻 推荐代码实操                  │
│ 知识点「XXX」的代码案例          │
│ [查看案例 →]                    │
└─────────────────────────────────┘
```

### 1.4 后端 API 变更

#### 新增: `GET /api/v1/question-bank/banks/{bankId}/wrong-records`

**Request**:
```json
{
  "bankId": "章节 UUID"
}
```

**Response**:
```json
{
  "wrong_records": [
    {
      "question_id": "题目 UUID",
      "stem": "题目内容",
      "type": "single_choice | multiple_choice | ...",
      "options": {"A": "...", "B": "...", ...},
      "user_answer": "用户提交的答案",
      "correct_answer": ["正确答案"],
      "knowledge_points": ["知识点1", "知识点2"],
      "wrong_count": 3,
      "last_wrong_at": "2026-06-17T10:00:00"
    }
  ],
  "total": 5
}
```

**查询逻辑**:
1. 查询 `wrong_answer_records` 表获取该用户+该章节的错题
2. 关联 `questions` 表获取题目内容
3. 关联 `student_answers` 表获取用户最近一次错误答案
4. 关联 `question_knowledge_points` 获取知识点名称

### 1.5 前端文件变更

| 文件 | 操作 | 说明 |
|------|------|------|
| `frontend/src/api/questionBank.ts` | 修改 | 新增 `getWrongRecords` API 方法 |
| `frontend/src/pages/PracticePage.tsx` | 修改 | 结果页增加弹窗状态管理 + 弹窗渲染 |
| `frontend/src/components/PracticeRecommendPopover.tsx` | 新建 | 右下角弹窗组件 |
| `frontend/src/pages/ReviewWrongPage.tsx` | 新建 | 错题回顾页面 |

---

## 二、功能 B：AI 对话增强

### 2.1 功能 B-①：生成思维导图按钮

**位置**: ChatPlatform 中 AI 消息流式完成后

**实现**:
1. 在 `ChatPlatform.tsx` 的流式完成逻辑（`finally` 块）中，为最后一条 AI 消息添加操作按钮
2. 按钮文案："🧠 生成思维导图"
3. 点击逻辑：
   - 提取该条 AI 回复内容作为上下文
   - 调用 `POST /api/v1/resources/generate` 创建 `mind_map` 类型资源
   - 成功后在按钮下方显示"✅ 已生成" + 跳转链接
4. 按钮仅在 AI 回复有实质内容（非纯文本问候）时显示

**状态管理**:
- 每个 message 维护 `generatingMindmap: boolean` 和 `mindmapResourceId: string | null`

### 2.2 功能 B-②：推演下次提问

**位置**: ChatPlatform 输入框上方

**时机**: AI 回复流式完成后

**实现**:
1. AI 回复完成后，调用一个轻量 LLM 接口（或直接在系统提示词中要求返回 suggested_questions）
2. 返回 2-3 个可能的追问，显示为可点击标签
3. 点击标签：将文本填入输入框（不自动发送）

**后端变更**:
- `POST /api/v1/chat/next-questions`
  - 输入：当前对话历史（最近 3 轮）
  - 输出：`{ questions: ["追问1", "追问2", "追问3"] }`
  - 使用小模型（qwen-turbo），低 temperature，快速响应

**前端变更**:
- `ChatPlatform.tsx` 维护 `suggestedQuestions: string[]`
- 流式完成后调用 `/chat/next-questions`
- 输入框上方显示标签列表

### 2.3 功能 B-③：图表自动保存云盘

**位置**: ChatPlatform 流式完成后处理 `[PLOT]` 图片 URL

**实现**:
1. 后端 `save_message` 执行 `[PLOT]` 后已生成 PNG URL
2. 前端在流式完成后，检测消息内容中的图片 URL
3. 对每张图片：
   - fetch 图片数据
   - 通过 `cloudDriveApi.createFile()` 或 `cloudDriveApi.uploadFile()` 保存到云盘
   - 创建文件夹 `AI 生成图表/{chat_title}/`
4. 在消息底部追加一行：`✅ 图表已保存到云盘 [查看]`

**注意**:
- 图片必须是已渲染完成的（等待 ReactMarkdown 加载后再触发）
- 失败时静默处理，不影响用户体验
- 云盘路径自动创建，不重复

### 2.4 前端文件变更

| 文件 | 操作 | 说明 |
|------|------|------|
| `frontend/src/api/chat.ts` | 修改 | 新增 `getNextQuestions` API 方法 |
| `frontend/src/components/ChatPlatform.tsx` | 修改 | 三处增强逻辑 |
| `frontend/src/components/MessageList.tsx` | 修改 | 支持消息底部操作按钮区域 |

### 2.5 后端文件变更

| 文件 | 操作 | 说明 |
|------|------|------|
| `app/api/endpoints/chat.py` | 修改 | 新增 `POST /chat/next-questions` 端点 |

---

## 三、AI 状态维护表

### 人类可读版

| 功能编号 | 功能描述 | 阶段 | 完成 | 通过 | 用户反馈 | 备注 |
|---------|---------|------|------|------|---------|------|
| AR1 | 练习后弹窗推荐（错题回顾 + 代码案例） | P0 | 🔴 否 | 🔴 否 | - | 含新页面 ReviewWrongPage |
| AR2 | AI对话-生成思维导图按钮 | P0 | 🔴 否 | 🔴 否 | - | 流式完成后显示 |
| AR3 | AI对话-推演下次提问 | P0 | 🔴 否 | 🔴 否 | - | 轻量 LLM 调用 |
| AR4 | AI对话-图表自动保存云盘 | P0 | 🔴 否 | 🔴 否 | - | 检测图片 URL + 云盘上传 |

### JSON 版

```json
{
  "ai_status": {
    "AR1_practice_popup": {
      "description": "练习后弹窗推荐（错题回顾 + 代码案例推荐）",
      "completed": false,
      "passed": false,
      "user_feedback": null,
      "notes": "含新页面 ReviewWrongPage + 后端 API + 弹窗组件"
    },
    "AR2_mindmap_button": {
      "description": "AI对话-生成思维导图按钮",
      "completed": false,
      "passed": false,
      "user_feedback": null,
      "notes": "流式完成后在消息下方显示生成按钮"
    },
    "AR3_next_questions": {
      "description": "AI对话-推演下次提问",
      "completed": false,
      "passed": false,
      "user_feedback": null,
      "notes": "调用轻量 LLM 返回 2-3 个追问标签"
    },
    "AR4_auto_save_plot": {
      "description": "AI对话-图表自动保存云盘",
      "completed": false,
      "passed": false,
      "user_feedback": null,
      "notes": "检测消息中 [PLOT] 图片 URL 并上传云盘"
    }
  }
}
```

---

## 四、实现顺序

1. **AR1 优先** — 练习后弹窗推荐（错题回顾新页面 + API + 弹窗组件）
2. **AR2 + AR3 并行** — 生成思维导图按钮 + 推演下次提问（都在 ChatPlatform 中）
3. **AR4 最后** — 图表自动保存云盘（依赖前端的图片加载状态检测）

---

*本文档由 AI Agent 维护，最后更新：2026-06-17*
