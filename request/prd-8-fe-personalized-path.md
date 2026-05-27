# PRD-008-FE：个性化学习路径与资源推送前端模块

**版本**：v1.0
**日期**：2026-05-15
**优先级**：P0（赛题核心功能展示）
**技术栈**：React18 + TypeScript + Zustand + ReactFlow（路径图渲染）+ SSE
**关联PRD**：PRD-003 (AI Chat)、PRD-006 (题库)、PRD-007 (多智能体)、PRD-009-BE (本系统后端)
**目标模块**：学生端个性化学习路径看板、AI Chat 知识盲区检测与资源推送、资源推荐中心

---

## AI 状态维护表

### 人类可读版

| 功能编号 | 功能描述 | 阶段 | 完成 | 通过 | 用户反馈 | 备注 |
|---------|---------|------|------|------|---------|------|
| FE-01 | 个性化学习路径看板（ReactFlow 渲染 DAG、缩放拖拽、进度高亮） | P0 | ✅ 是 | 🟡 进行中 | - | **增强：dagre自动布局替代手动排列；使用后端PathPlanner输出的Neo4j真实PREREQUISITE/RELATED_TO依赖边（实线动画/虚线降级）；双模式降级（无DAG数据→领域分组排列）** |
| FE-02 | 路径节点点击展开详情（右侧抽屉展示关联资源列表） | P0 | ✅ 是 | 🔴 否 | - | 抽屉含进度操作按钮、掌握度展示、资源列表 |
| FE-03 | 路径更新时间戳与手动重新规划按钮 | P0 | ✅ 是 | 🔴 否 | - | 已实现 |
| FE-04 | AI Chat 知识盲区检测反馈 | P0 | 🔴 否 | 🔴 否 | - | 需在 AI Chat SSE 事件中增加 `knowledge_gap_detected` 处理 |
| FE-05 | 无关内容警告条（浅黄色提示） | P0 | 🔴 否 | 🔴 否 | - | 未实现 |
| FE-06 | 资源卡片组件（折叠/展开、文档摘要、习题链接、视频脚本） | P0 | 🔴 否 | 🔴 否 | - | 未实现 |
| FE-07 | 资源卡片"加入我的学习路径"一键操作 | P0 | 🔴 否 | 🔴 否 | - | 未实现 |
| FE-08 | 个性化资源推送中心（今日推荐、类型筛选、反馈按钮） | P0 | 🔴 否 | 🔴 否 | - | 未实现 |
| FE-09 | 顶部通知栏（新路径/新资源小红点提醒） | P0 | 🔴 否 | 🔴 否 | - | 未实现 |
| FE-10 | 进度同步（练习完成后自动更新路径看板节点状态） | P0 | 🔴 否 | 🔴 否 | - | 需对接题库练习完成事件 |

### JSON 版

```json
{
  "ai_status": {
    "FE-01_path_dashboard": {
      "description": "个性化学习路径看板（ReactFlow 渲染 DAG、缩放拖拽、进度高亮）",
      "completed": true,
      "passed": false,
      "user_feedback": null,
      "notes": "增强完成：dagre自动布局（@dagrejs/dagre）；从后端dag_data字段消费Neo4j真实PREREQUISITE/RELATED_TO依赖边（实线动画/虚线降级）；KnowledgeGraph双模式：DAG数据可用→dagre布局，不可用→领域分组排列降级"
    },
    "FE-02_node_detail": {
      "description": "路径节点点击展开详情（右侧抽屉展示关联资源列表）",
      "completed": true,
      "passed": false,
      "user_feedback": null,
      "notes": "抽屉含进度操作按钮（completed/in_progress/not_started）、掌握度展示、资源列表"
    },
    "FE-03_replan_button": {
      "description": "路径更新时间戳与手动重新规划按钮",
      "completed": true,
      "passed": false,
      "user_feedback": null,
      "notes": "已实现"
    },
    "FE-04_knowledge_gap_feedback": {
      "description": "AI Chat 知识盲区检测反馈（SSE 事件处理、推荐按钮）",
      "completed": false,
      "passed": false,
      "user_feedback": null,
      "notes": "需在 AI Chat SSE 事件中增加 knowledge_gap_detected 处理"
    },
    "FE-05_irrelevant_warning": {
      "description": "无关内容警告条（浅黄色提示）",
      "completed": false,
      "passed": false,
      "user_feedback": null,
      "notes": "未实现"
    },
    "FE-06_resource_card": {
      "description": "资源卡片组件（折叠/展开、文档摘要、习题链接、视频脚本）",
      "completed": false,
      "passed": false,
      "user_feedback": null,
      "notes": "未实现"
    },
    "FE-07_add_to_path": {
      "description": "资源卡片'加入我的学习路径'一键操作",
      "completed": false,
      "passed": false,
      "user_feedback": null,
      "notes": "未实现"
    },
    "FE-08_recommendation_center": {
      "description": "个性化资源推送中心（今日推荐、类型筛选、反馈按钮）",
      "completed": false,
      "passed": false,
      "user_feedback": null,
      "notes": "未实现"
    },
    "FE-09_notification_bar": {
      "description": "顶部通知栏（新路径/新资源小红点提醒）",
      "completed": false,
      "passed": false,
      "user_feedback": null,
      "notes": "未实现"
    },
    "FE-10_progress_sync": {
      "description": "进度同步（练习完成后自动更新路径看板节点状态）",
      "completed": false,
      "passed": false,
      "user_feedback": null,
      "notes": "需对接题库练习完成事件"
    }
  }
}
```

---

## 1. 功能概述

本模块是学生接收个性化学习服务的核心交互界面。它通过可视化方式展示由后端多智能体系统生成的**动态学习路径**和**多模态学习资源**，并依据从 AI Chat 和题库交互中实时更新的学生画像，实现资源的"千人千面"精准推送。

**核心流程**：
```
用户与 AI Chat 对话 → 后端实时分析意图
  → 若为学习相关问题且暴露知识盲区 → 后端触发资源生成与路径规划
  → SSE 推送事件 → 前端展示推荐按钮/资源卡片/路径更新
  → 用户学习并反馈 → 画像更新 → 下一轮推荐
```

---

## 2. 核心界面与组件

### 2.1 个性化学习路径看板（独立页面或主面板 Tab）

使用 `reactflow`（React Flow）库渲染有向无环图（DAG），展示后端规划的学习路径。

| 功能 | 说明 |
|------|------|
| **路径概览图** | ReactFlow 渲染 DAG，节点为"知识点/学习任务"，边为"前置依赖"（`:PREREQUISITE`）。支持鼠标拖拽画布、滚轮缩放 |
| **节点进度高亮** | 绿色边框 = 已完成，黄色边框 = 学习中，灰色 = 未开始。进度数据来自后端 `GET /api/v1/path/current` |
| **节点点击交互** | 点击任一节点，右侧弹出 Drawer（抽屉），展示该知识点的关联资源列表（文档、视频、练习题、代码案例） |
| **路径时间戳** | 看板底部显示最近一次路径规划时间，右上角提供"手动重新规划"按钮 |
| **空状态** | 尚无学习路径时，显示引导文案："开始与 AI 对话或进行练习，系统将为你生成个性化学习路径" |

### 2.2 AI Chat 智能检测与资源推送（集成到 ChatPlatform）

在现有 PRD-003（AI Chat）基础上新增以下交互：

**无关内容警告**（`FE-05`）
- 后端 SSE 事件 `irrelevant_content` 触发时，聊天区顶部显示浅黄色警告条：
  > "当前为学习助手，请提问学科相关问题"
- 不打断对话，不触发资源生成，仅提示

**知识盲区检测反馈**（`FE-04`）
- 后端 SSE 事件 `knowledge_gap_detected` 携带 `{knowledge_points: [], gap_confidence: number}`
- 前端在最后一条 AI 回复下方，自动生成 **"📚 为你生成学习资源"** 按钮
- 点击按钮 → 调用 `POST /api/v1/agent/generate`（PRD-007 接口）→ 进入资源生成流程
- 资源生成期间显示加载进度条（SSE 流式，参考 PRD-007 第 6.3 节）
- 生成完成后，自动在按钮位置展开**资源卡片**

**资源卡片**（`FE-06`）
- 折叠/展开样式，每张卡片包含：知识点标签、文档摘要、思维导图预览缩略图、练习题链接、视频脚本片段
- 卡片底部提供 **"加入我的学习路径"** 按钮（`FE-07`），调用 `PUT /api/v1/path/nodes/{node_id}/bind-resource`

### 2.3 个性化资源推送中心（侧边栏或独立页面）

**智能推荐列表**（`FE-08`）
- 基于最新画像（薄弱知识点、易错点、活跃时段）推送"今日推荐资源"
- 支持按类型筛选：文档、思维导图、题库、视频脚本、代码案例
- 每条资源显示：知识点标签、难度星级、预计学习时长、来源（基于哪次对话或错题生成）
- 每条资源提供 **"有用" / "无用"** 反馈按钮（`POST /api/v1/recommendations/{id}/feedback`）

**空状态**：暂无推荐时显示："完成更多练习和对话，系统将为你推荐学习资源"

### 2.4 学习路径与资源同步状态（`FE-09`、`FE-10`）

- **顶部通知栏**：后端生成了新的学习路径或推送了新资源时，前端导航栏显示小红点提醒；点击跳转到路径看板或推送中心
- **进度同步**：用户在 PracticePage 完成某知识点的练习后，通过 WebSocket 或轮询触发路径节点状态更新；调用 `PUT /api/v1/path/nodes/{node_id}/progress` 同步到后端

---

## 3. 前端状态管理（Zustand Store）

新增以下 Store，统一管理个性化相关状态：

### pathStore

```typescript
interface PathStore {
  nodes: PathNode[];          // ReactFlow 节点数组
  edges: PathEdge[];          // ReactFlow 边数组
  nodeProgress: Record<string, 'not_started' | 'in_progress' | 'completed'>;
  lastUpdated: string | null; // ISO 时间戳
  loading: boolean;

  fetchPath: () => Promise<void>;
  updateNodeProgress: (nodeId: string, progress: string) => Promise<void>;
  replanPath: () => Promise<void>;
}
```

### pushStore

```typescript
interface PushStore {
  recommendations: ResourceItem[];
  total: number;
  unreadCount: number;
  filter: { type?: string };

  fetchRecommendations: (params?: { type?: string; page?: number }) => Promise<void>;
  markAsRead: (id: string) => void;
  sendFeedback: (id: string, useful: boolean) => Promise<void>;
}
```

### chatDetectionStore

```typescript
interface ChatDetectionStore {
  lastGap: {
    knowledgePoints: string[];
    confidence: number;
  } | null;
  showGenerateButton: boolean;
  generationTaskId: string | null;
  generationProgress: number;

  clearGap: () => void;
  setGenerationTask: (taskId: string) => void;
  updateProgress: (progress: number) => void;
}
```

---

## 4. 页面/组件路由

| 路由 | 页面 | 说明 |
|------|------|------|
| `/path` | 学习路径看板 | 新页面，独立于题库和 AI Chat |
| `/recommendations` | 资源推送中心 | 新页面，展示推荐资源列表 |
| 集成到 ChatPlatform | AI Chat 内 | 在现有聊天页面中新增推荐按钮、资源卡片、警告条 |

---

## 5. 与后端交互接口

| 前端动作 | 后端 API | 说明 |
|---------|---------|------|
| 发送聊天消息 | `POST /api/v1/chat/completions`（已有） | 增加 SSE 事件 `knowledge_gap_detected`、`irrelevant_content`、`resource_recommendation` |
| 请求生成资源 | `POST /api/v1/agent/generate`（来自 PRD-007） | 传入 `trigger_type: "chat_gap"` 和 `knowledge_points` |
| 获取学习路径 | `GET /api/v1/path/current` | 返回 JSON 格式的 ReactFlow 图数据 |
| 更新节点进度 | `PUT /api/v1/path/nodes/{node_id}/progress` | 用户标记完成或系统自动同步 |
| 绑定资源到节点 | `PUT /api/v1/path/nodes/{node_id}/bind-resource` | 资源卡片"加入学习路径"操作 |
| 手动重新规划 | `POST /api/v1/path/replan` | 强制重新规划路径 |
| 获取推送资源 | `GET /api/v1/recommendations/personalized` | 分页返回资源列表，支持 type 筛选 |
| 反馈资源 | `POST /api/v1/recommendations/{id}/feedback` | 传递 `useful: true/false` |
| 查询未读通知数 | `GET /api/v1/notifications/unread-count` | 返回小红点计数 |

---

## 6. 非功能需求

| 需求 | 说明 |
|------|------|
| **响应性能** | 从用户 AI Chat 提问到弹出推荐按钮 ≤ 3 秒（SSE 事件延迟） |
| **离线支持** | 路径图数据可缓存到 localStorage，网络恢复后与后端同步 |
| **可访问性** | 支持键盘导航，资源卡片提供 ARIA 标签 |
| **加载状态** | 路径看板加载时显示 Skeleton 骨架屏；资源列表加载时显示 loading spinner |
| **空数据引导** | 路径看板、推荐中心均需提供空状态提示文案及引导操作 |

---

## 7. 验收标准

1. **学习路径看板**：正确渲染 ReactFlow DAG 图，节点颜色反映进度（绿/黄/灰），支持拖拽和缩放
2. **路径节点交互**：点击节点弹出 Drawer，展示关联资源列表；Drawer 内"加入路径"按钮生效
3. **手动重新规划**：点击"手动重新规划"按钮，调用后端 API 并更新看板
4. **AI Chat 知识盲区检测**：用户输入"我不懂傅里叶变换"，AI 回复下方出现"📚 为你生成学习资源"按钮
5. **无关内容警告**：输入"今天天气真好"，显示浅黄色警告条，不生成资源
6. **资源生成进度**：点击推荐按钮后，正确调用后端并展示 SSE 加载进度条，生成后自动展开资源卡片
7. **资源推荐中心**：显示基于画像的资源列表，支持类型筛选，可提交有用/无用反馈
8. **小红点提醒**：新路径/新资源生成后，导航栏显示小红点
9. **进度同步**：在题库完成某知识点练习后，路径看板对应节点状态自动更新
10. **空状态**：路径看板和推荐中心在无数据时均显示引导文案

---

## 8. 开发任务与工时

| 任务编号 | 任务内容 | 工时 | 前置依赖 |
|---------|---------|------|---------|
| FE-01 | 学习路径看板页面（ReactFlow 集成、节点渲染、缩放拖拽） | 8h | 后端 PRD-009-BE path API |
| FE-02 | 节点详情 Drawer（关联资源列表展示） | 4h | FE-01 |
| FE-03 | 路径更新时间戳 + 手动重新规划按钮 | 2h | FE-01 |
| FE-04 | AI Chat 集成：SSE 事件处理（knowledge_gap_detected）、推荐按钮 | 6h | 已有 ChatPlatform + 后端 SSE 改造 |
| FE-05 | AI Chat 无关内容警告条 | 2h | FE-04 |
| FE-06 | 资源卡片组件（折叠/展开 + 各类资源展示） | 6h | 后端 PRD-007 资源数据格式 |
| FE-07 | "加入我的学习路径"按钮 + API 对接 | 2h | FE-06 |
| FE-08 | 资源推送中心页面（推荐列表 + 类型筛选 + 反馈按钮） | 6h | 后端 recommendation API |
| FE-09 | 顶部通知栏小红点 | 3h | FE-08 + 后端 notification API |
| FE-10 | 进度同步（轮询/WebSocket + 节点状态更新） | 4h | FE-01 + 题库练习完成事件 |
| | **合计** | **43h** | |
