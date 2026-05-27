# PRD-009-BE：个性化学习路径规划与资源推送后端模块

**版本**：v1.0
**日期**：2026-05-15
**优先级**：P0（赛题核心功能展示）
**技术栈**：Python3.11 + FastAPI + LangGraph v0.1.x + Qwen/DeepSeek + PostgreSQL + Neo4j + MongoDB + Redis
**关联PRD**：PRD-001 (用户)、PRD-002 (画像)、PRD-003 (AI Chat)、PRD-006 (题库)、PRD-007 (多智能体)、PRD-008-FE (本系统前端)
**前置依赖**：PRD-007 多智能体框架（SchedulerAgent / ProfileAgent / ResourceGenAgent / PathPushAgent）需先完成基础实现
**目标模块**：意图检测与知识盲区提取、学习路径规划算法、个性化资源推荐、与 AI Chat / 题库 / 画像系统集成

---

## AI 状态维护表

### 人类可读版

| 功能编号 | 功能描述 | 阶段 | 完成 | 通过 | 用户反馈 | 备注 |
|---------|---------|------|------|------|---------|------|
| BE-01 | IntentDetectorAgent（意图检测 + 无关内容过滤 + 知识盲区提取） | P0 | 🔴 否 | 🔴 否 | - | 需插入 LangGraph 工作流；依赖 PRD-007 |
| BE-02 | 无关内容检测规则（正则 + 小模型分类 + 自定义黑名单） | P0 | 🔴 否 | 🔴 否 | - | 置信度 < 0.3 判定为无关 |
| BE-03 | 知识盲区提取（LLM 抽取 + Neo4j 知识点映射 + 答题记录验证） | P0 | 🔴 否 | 🔴 否 | - | 输出 (知识点, 紧急程度) 对 |
| BE-04 | 学习路径规划算法（Neo4j 子图抽取 + 拓扑排序 + 个性化调整） | P0 | ✅ 是 | 🟡 进行中 | - | **增强：新增加权评分函数 Score=w1*(1-mastery)+w2*importance+w3*exam_freq-w4*cognitive_load；新增深度层级布局替代单列排列；GET /path/current 返回 dag_data 字段连通前端** |
| BE-05 | 学习路径 CRUD API（获取、更新进度、重新规划、绑定资源） | P0 | ✅ 是 | 🟡 进行中 | - | **增强：GET /path/current 新增 dag_data 响应字段（DagNode/DagEdge/DagData 模型）；Neo4j降级自动处理** |
| BE-06 | 个性化资源推荐 API（画像召回 + 协同过滤 + 热度加权） | P0 | 🔴 否 | 🔴 否 | - | 50% 画像 / 30% 协同 / 20% 热度 |
| BE-07 | 资源推荐反馈收集 API | P0 | 🔴 否 | 🔴 否 | - | recommendation_feedbacks 表 |
| BE-08 | AI Chat SSE 事件扩展（knowledge_gap_detected / irrelevant_content） | P0 | 🔴 否 | 🔴 否 | - | 改造已有 `POST /api/v1/chat/completions` |
| BE-09 | 内部接口（意图分析、触发资源生成） | P1 | 🔴 否 | 🔴 否 | - | `/internal/chat/intent` 等 |
| BE-10 | 通知计数 API | P1 | 🔴 否 | 🔴 否 | - | 小红点数据源 |
| BE-11 | 降级与异常处理策略 | P0 | 🔴 否 | 🔴 否 | - | LLM 超时 / 图谱查询失败 / 资源生成失败 |

### JSON 版

```json
{
  "ai_status": {
    "BE-01_intent_detector": {
      "description": "IntentDetectorAgent（意图检测 + 无关内容过滤 + 知识盲区提取）",
      "completed": false,
      "passed": false,
      "user_feedback": null,
      "notes": "需插入 LangGraph 工作流；依赖 PRD-007"
    },
    "BE-02_irrelevant_filter": {
      "description": "无关内容检测规则（正则 + 小模型分类 + 自定义黑名单）",
      "completed": false,
      "passed": false,
      "user_feedback": null,
      "notes": "置信度 < 0.3 判定为无关"
    },
    "BE-03_gap_extraction": {
      "description": "知识盲区提取（LLM 抽取 + Neo4j 知识点映射 + 答题记录验证）",
      "completed": false,
      "passed": false,
      "user_feedback": null,
      "notes": "输出 (知识点, 紧急程度) 对"
    },
    "BE-04_path_planning": {
      "description": "学习路径规划算法（Neo4j 子图抽取 + 拓扑排序 + 个性化调整）",
      "completed": true,
      "passed": false,
      "user_feedback": null,
      "notes": "增强完成：新增加权评分函数_score (w1=0.4掌握度差距/w2=0.25重要度/w3=0.2考察频率/w4=0.15认知负荷)；新增_compute_depth深度层级布局（多列替换单列）；新增domain_name/subject_name元数据传递；Safe fallback names异常处理"
    },
    "BE-05_path_api": {
      "description": "学习路径 CRUD API（获取、更新进度、重新规划、绑定资源）",
      "completed": true,
      "passed": false,
      "user_feedback": null,
      "notes": "增强完成：GET /path/current 新增 dag_data 响应字段；新增 DagNode/DagEdge/DagData schema模型；Neo4j连通时自动附DAG数据，不可用时静默降级不阻塞页面"
    },
    "BE-06_recommendation_api": {
      "description": "个性化资源推荐 API（画像召回 + 协同过滤 + 热度加权）",
      "completed": false,
      "passed": false,
      "user_feedback": null,
      "notes": "50% 画像 / 30% 协同 / 20% 热度"
    },
    "BE-07_feedback_api": {
      "description": "资源推荐反馈收集 API",
      "completed": false,
      "passed": false,
      "user_feedback": null,
      "notes": "recommendation_feedbacks 表"
    },
    "BE-08_sse_extension": {
      "description": "AI Chat SSE 事件扩展（knowledge_gap_detected / irrelevant_content）",
      "completed": false,
      "passed": false,
      "user_feedback": null,
      "notes": "改造已有 POST /api/v1/chat/completions"
    },
    "BE-09_internal_apis": {
      "description": "内部接口（意图分析、触发资源生成）",
      "completed": false,
      "passed": false,
      "user_feedback": null,
      "notes": "/internal/chat/intent 等"
    },
    "BE-10_notification_api": {
      "description": "通知计数 API",
      "completed": false,
      "passed": false,
      "user_feedback": null,
      "notes": "小红点数据源"
    },
    "BE-11_degradation": {
      "description": "降级与异常处理策略",
      "completed": false,
      "passed": false,
      "user_feedback": null,
      "notes": "LLM 超时 / 图谱查询失败 / 资源生成失败"
    }
  }
}
```

---

## 1. 功能概述

本模块是"个性化学习路径规划与资源推送"的后端核心。它负责：

- 实时分析用户在 AI Chat 中的提问，判断是否为学习内容、是否暴露知识盲区
- 结合题库练习记录（错题、掌握度）和画像数据，动态更新学生的知识薄弱点
- 调用 PRD-007 中定义的多智能体系统（LangGraph 工作流）生成针对性的多模态资源
- 规划科学的学习路径（知识点顺序、依赖关系），并将生成的资源绑定到路径节点上
- 提供个性化资源推荐 API，基于画像 + 协同过滤 + 热度加权

**先决条件**：本模块依赖 PRD-007 提供的 LangGraph 多智能体框架（SchedulerAgent / ProfileAgent / ResourceGenAgent / PathPushAgent）作为资源生成能力底座。

---

## 2. LangGraph 工作流扩展

### 2.1 新增节点：IntentDetectorAgent

在现有 LangGraph 工作流（PRD-007 第 4 节）的入口处，新增 `IntentDetectorAgent` 节点，在 `SchedulerAgent` 之前执行。

**调整后的执行流**：
```
用户消息(SSE) → IntentDetectorAgent
  → (若为学习盲区) → SchedulerAgent → ProfileAgent → ResourceGenAgent → PathPushAgent
  → (若为无关内容) → 直接返回，不进入后续流程
  → (若为学习但无盲区) → 仅记录日志，不触发资源生成
```

**输入**：用户消息文本、当前会话上下文（可选）、学生画像快照（来自 Redis）
**输出**（JSON）：

```json
{
  "is_learning_related": true,
  "knowledge_gaps": [
    { "knowledge_point": "Cache映射", "confidence": 0.85 }
  ],
  "trigger_resource_generation": true,
  "suggested_resource_types": ["document", "mindmap", "exercise", "video_script", "code_case"]
}
```

### 2.2 无关内容检测规则（BE-02）

| 层级 | 方法 | 说明 |
|------|------|------|
| L1 | 黑名单关键词 | 自定义关键词匹配（"游戏"、"娱乐"、"天气"等），即时判定 |
| L2 | 正则学科匹配 | 匹配预设学科关键词（数学、计算机、物理等），提高可信度 |
| L3 | LLM 分类 | 调用 Qwen-Turbo 一次轻量分类："学习相关" / "无关"，耗时 ≤ 500ms |

- 若 L1 命中黑名单词且无学科关键词 → 直接判定无关
- 若 LLM 置信度 < 0.3 → 判定为无关，直接返回提示信息
- **不进入后续 Agent 流程**，不消耗画像更新额度

### 2.3 知识盲区提取方法（BE-03）

**步骤**：
1. **LLM 抽取**：从用户消息中提取明确表达"不懂"、"不理解"、"没学过"的短语
2. **Neo4j 映射**：将提取的短语与 Neo4j 中的 `KnowledgePoint` 节点进行模糊匹配（使用 `apoc.text.levenshteinDistance` 或 LLM 映射）
3. **答题记录验证**：查询 `StudentAnswer` 表，检查该知识点在题库中掌握度分数（正确率 < 0.4 则强化盲区置信度）
4. **输出**：一个或多个 `(knowledge_point, urgency_score)` 对，`urgency_score` 取 max(LLM 置信度, 1 - 掌握度)

### 2.4 触发资源生成策略（BE-01 → PRD-007）

当 `trigger_resource_generation = true` 时：
1. 调用 PRD-007 的 `ResourceGenAgent`，传入参数：
   ```json
   {
     "focus_knowledge_points": knowledge_gaps,
     "resource_types": ["document", "mindmap", "exercise", "video_script", "code_case"]
   }
   ```
2. 一次生成任务同时产出 5 类资源（复用 PRD-007 的 `parallel_nodes` 并行机制）
3. 资源生成后自动存入存储，并建立与知识点的 Neo4j 关联

---

## 3. 学习路径规划算法（BE-04）

### 3.1 基础知识图谱依赖

利用 Neo4j 中已有的知识图谱结构，依赖以下关系：
- `(:KnowledgePoint)-[:PREREQUISITE]->(:KnowledgePoint)` — 前置依赖
- `(:KnowledgePoint)-[:RELATED_TO]->(:KnowledgePoint)` — 相关关系（非严格依赖）

### 3.2 算法步骤

```
输入：学生画像（薄弱知识点列表，掌握度 < 0.5）

1. 从薄弱知识点出发，沿 [:PREREQUISITE] 向上游扩展 2 层，找出所有未掌握的前置知识点
2. 沿 [:RELATED_TO] 向上下游各扩展 1 层，找出关联知识点
3. 合并上述两个集合，构建子图（DAG）
4. 对子图执行拓扑排序，生成推荐学习顺序
5. 将已有掌握度 > 0.7 的知识点标记为"已完成"
6. 将薄弱知识点标记为"待学习"，并在排序中优先安排基础前置知识

输出：符合 ReactFlow 格式的 JSON
```

### 3.3 动态更新时机

| 触发事件 | 更新方式 | 说明 |
|---------|---------|------|
| 学生完成一批练习 | 增量更新 | 仅更新涉及知识点的节点进度 |
| AI Chat 暴露新盲区 | 全量重新规划 | 重新执行 3.2 算法 |
| 手动触发重新规划 | 全量重新规划 | 用户点击"手动重新规划"按钮 |

---

## 4. API 设计

### 4.1 内部接口（供 AI Chat 后端调用）

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | `/internal/chat/intent` | 分析聊天消息，返回意图和盲区（不触发资源生成） |
| POST | `/internal/chat/trigger-generate` | 接受前端确认后触发资源生成（实际调用 PRD-007 Agent 工作流） |

### 4.2 学习路径 API

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/v1/path/current` | 获取当前用户最新学习路径（ReactFlow JSON 格式） |
| PUT | `/api/v1/path/nodes/{node_id}/progress` | 更新节点进度。请求体：`{"progress": "completed"}` |
| PUT | `/api/v1/path/nodes/{node_id}/bind-resource` | 绑定资源到路径节点。请求体：`{"resource_id": "uuid"}` |
| POST | `/api/v1/path/replan` | 强制重新规划路径（基于最新画像） |

### 4.3 个性化推荐 API

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/v1/recommendations/personalized` | 推荐资源列表，支持 `?type=document&page=1&page_size=20` |
| POST | `/api/v1/recommendations/{id}/feedback` | 提交反馈。请求体：`{"useful": true}` |

### 4.4 通知 API

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/v1/notifications/unread-count` | 获取未读通知数（新路径、新资源），返回 `{"count": 3}` |

---

## 5. 推荐算法（BE-06）

### 5.1 权重分配

| 因子 | 权重 | 数据来源 |
|------|------|---------|
| 画像薄弱点召回 | 50% | Neo4j 查询该知识点关联的未学习资源 |
| 协同过滤 | 30% | 相似学生也学习/反馈有用的资源 |
| 热度 | 20% | 所有学生反馈"有用"次数，按时间衰减 |

### 5.2 画像薄弱点召回

```
1. 从学生画像获取掌握度 < 0.5 的知识点列表
2. 对每个知识点，查询 Neo4j: MATCH (kp:KnowledgePoint {name: $kp})<-[:TEACHES]-(r:Resource)
3. 过滤掉该学生已学习/已反馈过的资源
4. 按知识点掌握度升序排列（越薄弱越优先）
```

### 5.3 协同过滤（基础版）

```
1. 在 Neo4j 中找到与当前学生有相似薄弱点模式的其他学生
   MATCH (s1:Student {student_id: $sid})-[:ANSWERED_WRONG]->(q:Question)<-[:ANSWERED_WRONG]-(s2:Student)
   WHERE s1 <> s2
   RETURN s2, count(q) AS shared
   ORDER BY shared DESC LIMIT 5
2. 查找这些相似学生反馈"有用"的资源
3. 按相似度加权排序
```

### 5.4 多样性去重

- 同一知识点最多推荐 3 条资源
- 相邻推荐结果不来自同一知识点
- 最终列表按混合分数降序

---

## 6. 数据库变更

### 6.1 PostgreSQL 新增表

```sql
-- 学习路径表
CREATE TABLE learning_paths (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    path_data JSONB NOT NULL,       -- 符合 ReactFlow 格式的完整图数据
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_learning_paths_user_id ON learning_paths(user_id);

-- 资源推荐反馈表
CREATE TABLE recommendation_feedbacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resource_id UUID NOT NULL,       -- 关联到 PRD-007 的 resources 表
    useful BOOLEAN NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_rec_feedback_user ON recommendation_feedbacks(user_id);
CREATE INDEX idx_rec_feedback_resource ON recommendation_feedbacks(resource_id);
```

### 6.2 Neo4j 关系补充

确保已有 `[:ASKED_ABOUT]` 关系（PRD-006 v4.0 已定义），用于记录用户曾在对话中问及某个知识点：

```cypher
// 当用户提问涉及知识点时，建立关系
MATCH (s:Student {student_id: $sid})
MATCH (kp:KnowledgePoint {name: $kp_name})
MERGE (s)-[:ASKED_ABOUT {asked_at: datetime()}]->(kp)
```

---

## 7. 与现有模块的集成点

| 模块 | 集成方式 | 说明 |
|------|---------|------|
| AI Chat 后端 | SSE 事件扩展 | 在 `POST /api/v1/chat/completions` 流中增加 `knowledge_gap_detected` 和 `irrelevant_content` 事件 |
| 题库系统 | 掌握度查询 | 通过 `GET /api/v1/question-bank/students/me/statistics` 获取各知识点掌握度（已实现） |
| 画像系统 | 薄弱点读取 | 通过 `GET /api/v1/profile/dynamic` 获取 6 维画像，特别是薄弱点和易错点（已实现） |
| PRD-007 多智能体 | Agent 调用 | 复用 SchedulerAgent / ResourceGenAgent / PathPushAgent，新增 IntentDetectorAgent |

---

## 8. 降级与异常处理（BE-11）

| 异常场景 | 处理方式 |
|---------|---------|
| 意图分类 LLM 超时 | 默认判定为学习相关但不产生盲区，仅记录日志，不触发资源生成 |
| 知识图谱 Neo4j 查询失败 | 回退到 PostgreSQL 中的 `KnowledgePoint` 父子关系，降级为简单线性路径 |
| 资源生成 API 失败 | 返回 202 Accepted 并异步重试，前端显示"生成中，请稍后查看" |
| 无关内容误判 | 允许前端用户手动标记"这是学习问题"，并将消息重新提交分析 |
| 推荐算法无数据 | 返回空列表 + 引导文案，不报错 |

---

## 9. 验收标准

1. **意图检测**：用户 AI Chat 提问"什么是红黑树"，IntentDetectorAgent 识别知识点"红黑树"，输出 `knowledge_gaps` 数组
2. **无关内容过滤**：用户提问"今天天气真好"，返回 `is_learning_related: false`，不触发资源生成
3. **知识盲区验证**：若该知识点在题库中掌握度 < 0.4，confidence 自动提升
4. **资源生成触发**：触发资源生成后，正确调用 PRD-007 Agent 工作流，并行产出 5 类资源
5. **学习路径规划**：基于薄弱点生成 DAG 子图，拓扑排序合理（基础知识点在前）
6. **动态更新**：练习完成后，路径节点进度自动更新；新盲区暴露后路径全量重新规划
7. **个性化推荐**：推荐列表优先包含薄弱知识点资源，反馈后权重调整生效
8. **SSE 事件**：AI Chat 流中正确发送 `knowledge_gap_detected` 事件，前端可接收
9. **降级**：Neo4j 异常时路径规划不崩溃，降级为 PG 线性路径
10. **认证**：所有 API 均支持 JWT 认证

---

## 10. 开发任务与工时

| 任务编号 | 任务内容 | 工时 | 前置依赖 |
|---------|---------|------|---------|
| BE-01 | IntentDetectorAgent（LLM 调用 + LangGraph 节点注册 + 工作流插入） | 6h | PRD-007 多智能体框架 |
| BE-02 | 无关内容检测规则（L1 黑名单 + L2 正则 + L3 LLM 分类） | 3h | 无 |
| BE-03 | 知识盲区提取（LLM 抽取 + Neo4j 映射 + 答题记录验证） | 4h | BE-02 |
| BE-04 | 学习路径规划算法（Neo4j 子图 + 拓扑排序 + 个性化调整） | 6h | Neo4j 中 PREREQUISITE 关系数据 |
| BE-05 | 学习路径 CRUD API（4 个端点 + learning_paths 表） | 4h | BE-04 |
| BE-06 | 个性化推荐 API（画像召回 + 协同过滤 + 热度 + 多样性去重） | 5h | 画像 API + Neo4j |
| BE-07 | 推荐反馈 API + recommendation_feedbacks 表 | 2h | BE-06 |
| BE-08 | AI Chat SSE 事件扩展（改造已有 chat completions 端点） | 4h | BE-01 |
| BE-09 | 内部接口（/internal/chat/intent + trigger-generate） | 3h | BE-01 |
| BE-10 | 通知计数 API | 2h | BE-05 + BE-06 |
| BE-11 | 降级与异常处理策略实现 | 3h | BE-01 ~ BE-10 |
| | **合计** | **42h** | |
