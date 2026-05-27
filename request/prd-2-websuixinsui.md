## PRD-002-随学随新：学习画像自动更新机制

**版本**：v1.0
**优先级**：P1（画像系统核心体验闭环）
**关联PRD**：PRD-002（学习画像构建与动态维护系统）、PRD-006（题库系统）

---

## AI 状态维护表（人类可读版）

| 功能编号 | 功能描述 | 阶段 | 完成 | 通过 | 用户反馈 | 备注 |
|---------|---------|------|------|------|---------|------|
| auto_profile_answer | 答题后自动更新画像（知识掌握度、易错点、行为事件、活跃时段） | P1 | ✅ 是 | ✅ 是 | - | 已完成 submit 和 batch 端点嵌入，Playwright + API 测试通过 |
| profile_knowledge_hierarchy | 知识掌握度按 学科→章节→知识点 层级展示 | P1 | ✅ 是 | ✅ 是 | - | Neo4j 查询扩展 + CRUD 层级重组 + 前端可折叠渲染，2026-05-15 完成 |
| profile_error_prone_hierarchy | 易错点按 学科→章节→知识点 层级展示 | P1 | ✅ 是 | ✅ 是 | - | 复用知识点层级关系，OPTIONAL MATCH 通过名称关联 Topic→KnowledgePoint，CRUD 层级重组 + 前端可折叠渲染，2026-05-15 完成 |
| auto_profile_practice | 练习完成后更新学习节奏 | P2 | 🔴 否 | 🔴 否 | - | 后续迭代 |
| frontend_event_tracker | 前端埋点（失焦、空闲、页面卸载）自动上传行为事件 | P2 | 🔴 否 | 🔴 否 | - | 后续迭代 |
| profile_dashboard_refresh | 画像仪表盘实时刷新已变更数据 | P1 | 🟡 部分 | 🔴 否 | - | 需前端配合自动刷新 |

## AI 状态维护表（JSON版）

```json
{
  "ai_status": {
    "auto_profile_answer": {
      "description": "答题后自动更新画像（知识掌握度、易错点、行为事件、活跃时段）",
      "completed": true,
      "passed": true,
      "user_feedback": null,
      "notes": "已完成 submit_answer 和 submit_answers_batch 两个端点的嵌入，API 和 Playwright 测试均通过"
    },
    "profile_knowledge_hierarchy": {
      "description": "知识掌握度按 学科→章节→知识点 层级展示",
      "completed": true,
      "passed": true,
      "user_feedback": null,
      "notes": "Neo4j 查询扩展 HAS_SUB/BELONGS_TO 关系遍历 + CRUD _build_knowledge_hierarchy 层级重组 + 前端 SubjectSection/DomainSection 可折叠渲染"
    },
    "profile_error_prone_hierarchy": {
      "description": "易错点按 学科→章节→知识点 层级展示",
      "completed": true,
      "passed": true,
      "user_feedback": null,
      "notes": "get_error_prone_topics 增加 OPTIONAL MATCH 关联知识点层级 + CRUD _build_error_prone_hierarchy 层级重组 + 前端 ErrorProneSubjectSection/ErrorProneDomainSection 可折叠渲染"
    },
    "auto_profile_practice": {
      "description": "练习完成后更新学习节奏",
      "completed": false,
      "passed": false,
      "user_feedback": null,
      "notes": ""
    },
    "frontend_event_tracker": {
      "description": "前端埋点（失焦、空闲、页面卸载）自动上传行为事件",
      "completed": false,
      "passed": false,
      "user_feedback": null,
      "notes": ""
    },
    "profile_dashboard_refresh": {
      "description": "画像仪表盘实时刷新已变更数据",
      "completed": false,
      "passed": false,
      "user_feedback": null,
      "notes": "需前端配合自动刷新"
    }
  }
}
```

---

## 1. 概述

**随学随新** 是学习画像系统的核心体验闭环。用户在题库中完成答题后，画像无需手动操作即可自动更新。每次答题都是画像的一次"信号输入"，系统实时调整知识掌握度、易错点、行为事件和活跃时段，实现"学即所现"。

---

## 2. 更新维度与规则

| 画像维度 | 更新时机 | 更新规则 |
|---------|---------|---------|
| 知识掌握度 | 每次答题提交 | 正确：score +0.05（上限 1.0）；错误：score -0.1（下限 0.0）；confidence +0.02 |
| 易错点 | 答错时 | 对应知识点错误计数 +1，Neo4j `ERROR_PRONE` 关系累加 |
| 行为事件 | 每次答题提交 | MongoDB `behavior_events` 集合记录 `answer_submit` 事件（含题型、难度、耗时、关联知识点） |
| 画像时间线 | 每次答题提交 | MongoDB `student_profiles.timeline` 追加同一条事件 |
| 活跃时段 | 每次答题提交 | 指数移动平均更新当前时段占比（α=0.1）；归一化保持四时段和为 1 |

### 2.1 知识掌握度调整公式

```
score_new = clamp(score_old + delta, 0.0, 1.0)

delta = +0.05  (回答正确)
delta = -0.10  (回答错误)

confidence_new = min(1.0, confidence_old + 0.02)
```

默认起始值：score = 0.5, confidence = 0.3（学生首次接触知识点时）

### 2.2 活跃时段更新公式

```
period = 根据当前时间 hour 判断：
  06-11 → morning
  12-17 → afternoon  
  18-21 → evening
  22-05 → night

ah[period] = ah[period] * 0.9 + 1.0 * 0.1
归一化：ah[k] = ah[k] / sum(ah.values())
```

---

## 3. 技术实现

### 3.1 后端架构

```
用户答题 → POST /api/v1/question-bank/questions/{id}/submit-answer
              ↓
         记录 StudentAnswer（PostgreSQL）
              ↓
         调用 _update_profile_after_answer()
              ├─ Neo4j: 更新知识掌握度 / 易错点
              ├─ MongoDB: 记录行为事件 + 时间线
              └─ MongoDB: 更新活跃时段
```

### 3.2 核心函数

```python
def _update_profile_after_answer(
    student_id: str,
    question: Question,
    is_correct: bool,
    time_spent_seconds: Optional[int],
    db: Session,
    neo4j: Neo4jConnection,
    mongodb: MongoDBConnection,
):
    """答题后自动更新学习画像"""
    # 1. 查询题目关联的知识点名称（从 PostgreSQL KnowledgePoint 表）
    # 2. 遍历知识点：调整掌握度 score ± delta
    # 3. 答错时：累加易错点计数
    # 4. 记录 answer_submit 行为事件到 MongoDB
    # 5. 更新活跃时段（指数移动平均）
```

### 3.3 容错设计

- 所有画像更新操作包裹在 `try/except` 中
- 任一步骤失败不影响答题主流程（PostgreSQL 记录已提交）
- 画像不存在时自动创建初始数据

### 3.4 涉及后端文件

| 文件 | 变更内容 |
|------|---------|
| `app/api/endpoints/question_bank.py` | 新增 `_update_profile_after_answer`；修改 `submit_answer`、`submit_answers_batch` |
| `app/db/neo4j.py` | 无变更（复用现有 `add_knowledge_mastery`、`add_error_prone_topic`） |
| `app/db/mongodb.py` | 无变更（复用现有 `record_behavior_event`、`add_timeline_event`、`update_student_profile`） |

---

## 4. API 变更

**无新增 API**。随学随新在现有答题提交端点内部加入自动更新逻辑。

### 变更端点

| 方法 | 路径 | 变更 |
|------|------|------|
| POST | `/api/v1/question-bank/questions/{id}/submit-answer` | 新增 `neo4j`、`mongodb` 依赖注入；新增 `_update_profile_after_answer` 调用 |
| POST | `/api/v1/question-bank/banks/{bank_id}/submit-answers` | 同上（批量），循环中对每题调用 helper |

---

## 5. 前端配合

### 5.1 实时刷新（推荐）

画像仪表盘页面 `/profile/dynamic` 在用户从练习页面返回时自动重新加载数据，展示最新的知识掌握度和易错点。

### 5.2 后续埋点（P2）

| 事件 | 采集方式 | 触发动作 |
|------|----------|---------|
| 页面失焦 | `visibilitychange` | `attention_drift` 事件上报 |
| 用户空闲 >5min | `setInterval` 检测 | `idle` 事件上报 |
| 页面离开 | `beforeunload` | 停留 >30s 则上报 `resource_view` |

---

## 6. 数据流示例

```
用户 guoketg 在「计算机组成原理」题库练习：
  第1题答对（知识点：Cache映射方式）
    → Neo4j: Cache映射方式 score 0.5→0.55, confidence 0.3→0.32
    → MongoDB: behavior_events {event_type: "answer_submit", is_correct: true}
    → MongoDB: active_hours afternoon 更新

  第2题答错（知识点：流水线冒险）
    → Neo4j: 流水线冒险 score 0.5→0.40, confidence 0.3→0.32
    → Neo4j: ERROR_PRONE 流水线冒险 error_count +1
    → MongoDB: behavior_events {event_type: "answer_submit", is_correct: false}
```

---

## 7. 验收标准

- [ ] 答题后 Neo4j 知识掌握度正确更新（正确+0.05，错误-0.1）
- [ ] 答错后 Neo4j 易错点错误计数递增
- [ ] MongoDB `behavior_events` 集合可查到 `answer_submit` 事件
- [ ] MongoDB `student_profiles.timeline` 可查到对应时间线
- [ ] 活跃时段分布随时间推进而动态变化
- [ ] 画像不存在时自动创建，不报错
- [ ] 画像更新异常不影响答题正常流程

---

## 8. 与 PRD-002 的关系

随学随新是 PRD-002 "信号累积触发画像演化" 的轻量实现：

- **前置**：PRD-002 定义了 8 维画像和存储层（已完成）
- **当前**：随学随新实现了事件驱动的自动更新（"信号"=单次答题），省略了 LangGraph Agent 的复杂阈值逻辑
- **后续**：LangGraph ProfileUpdateAgent 可在此基础上增加信号累积和阈值触发，替换当前的即时更新策略

---

*文档版本: v1.0*
*更新日期: 2026-05-14*
