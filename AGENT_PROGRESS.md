# 多智能体系统开发进度追踪

> 最后更新：2026-06-08

---

## 一、多智能体系统（PRD-7）— 冲刺国一核心模块

### ✅ 已完成

| 模块 | 状态 | 说明 |
|------|------|------|
| LangGraph 依赖安装 | ✅ | `langgraph>=1.2.0`, `langchain-core>=1.4.0` |
| 状态定义 (`state.py`) | ✅ | `AgentState` 含 20+ 字段、6 种资源类型常量、Agent 名称常量 |
| LLM 调用助手 (`llm.py`) | ✅ | 封装 DeepSeek API，支持 `chat()` 和 `chat_json()` 两种模式 |
| SchedulerAgent (`scheduler.py`) | ✅ | 参数校验、LLM 提取知识点、状态初始化 |
| ProfileAgent (`profile.py`) | ✅ | 从 Neo4j + PostgreSQL 读取画像、薄弱点、认知风格 |
| ResourceGenAgent (`resource_gen.py`) | ✅ | `asyncio.gather` 并行生成 6 类资源、自动保存到数据库 |
| PathPushAgent (`path_push.py`) | ✅ | Neo4j PathPlanner 路径规划 + LLM 降级、路径持久化 |
| 工作流图 (`workflow.py`) | ✅ | StateGraph 编排 4 Agent、MemorySaver 持久化、条件路由 |
| Agent API 端点 | ✅ | `POST /agent/generate`, `GET /agent/task/{id}`, `GET /agent/tasks`, `GET /agent/task/{id}/sse` (SSE), `POST /agent/task/{id}/cancel` |
| AgentTask 模型 | ✅ | `agent_tasks` 表，含状态快照 JSONB |
| 数据库迁移 SQL | ✅ | `migrations/010_create_agent_tasks.sql` |
| 路由注册 | ✅ | `main.py` 已注册 `agent.router` |
| 前端 API 客户端 | ✅ | `frontend/src/api/agent.ts` - 完整的 TypeScript 类型定义和 API 封装 |
| 前端 Agent 任务页面 | ✅ | `frontend/src/pages/AgentTasksPage.tsx` - 任务列表 + 详情抽屉 |
| 路由注册（前端） | ✅ | `App.tsx` 已添加 `/agent/tasks` 路由 |
| 知识盲区检测集成 | ✅ | Chat SSE 流已包含 `knowledge_gap_detected` 事件 |
| 一键生成学习资源按钮 | ✅ | ChatPlatform 知识盲区提示条中新增"一键生成学习资源"按钮 |
| Agent 进度指示条 | ✅ | ChatPlatform 中显示 Agent 执行进度条和状态 |
| 导航链接 | ✅ | HomePage 下拉导航增加"多智能体任务"入口 |

### ❌ 待完成 / 可优化

| 模块 | 优先级 | 说明 |
|------|--------|------|
| 学习效果评估（加分项） | 🟡 中 | 行为追踪 → 画像动态更新 → 策略自动调整 |
| 前端 Agent 进度实时动效 | 🟢 低 | Agent 执行状态的可视化流式动画（类似 LangGraph 实时图） |
| 3D 知识图谱（LP-10） | 🟢 低 | 展示效果加分项 |
| 学习报告周报（LP-7） | 🟢 低 | 每周自动生成学习报告 |

---

## 二、赛题要求覆盖情况

### 2.1 基本功能需求

| 赛题要求 | 状态 | 说明 |
|---------|------|------|
| ① 对话式学习画像自主构建（6维+） | ✅ | 已实现 8 维画像，含 LLM 对话初始化 |
| ② 多智能体协同资源生成（5种+） | ✅ **新完成** | LangGraph 4 Agent + 并行生成 6 类资源 |
| ③ 个性化学习路径规划与资源推送 | ✅ | Neo4j PathPlanner + Agent 驱动路径推送 |
| ④ 智能辅导（可选加分项） | 🟡 部分 | 基础 Chat 答疑，缺少多模态解答 |
| ⑤ 学习效果评估（可选加分项） | 🔴 未开始 | 需实现行为追踪与策略调优 |

### 2.2 多智能体架构要求

| LangGraph 方法 | 赛题要求 | 状态 |
|---------------|---------|------|
| `StateGraph` | 构建工作流有向图 | ✅ |
| `MessagesState` | 标准化消息与状态结构 | ✅ |
| `add_node()` | 注册 4 大 Agent 节点 | ✅ |
| `add_edge()` | 定义串行执行链路 | ✅ |
| `add_conditional_edges()` | 异常降级路由 | ✅ |
| `parallel_nodes()` / `asyncio.gather` | 并行资源生成 | ✅ |
| `MemorySaver` | 状态持久化 | ✅ |
| `get_state()`/`update_state()` | 前端查询任务状态 | ✅ |
| SSE 推送 | 任务进度实时推送 | ✅ |

### 2.3 资源类型覆盖

| 资源类型 | 状态 | 说明 |
|---------|------|------|
| 思维导图 | ✅ | markmap 渲染，LLM 生成 Markdown |
| 知识讲解文档 | ✅ **新增** | LLM 生成 Markdown 文档 |
| 练习题目 | ✅ **新增** | LLM 生成 JSON 格式题目（含多题型） |
| 代码实操案例 | ✅ **新增** | LLM 生成代码 + 注释 + 说明 |
| 教学视频 | ✅ | 11 种视觉类型 + TTS 语音合成 |
| 拓展阅读 | ✅ **新增** | LLM 推荐经典资源 |

---

## 三、评分标准对应策略

| 评分维度 | 权重 | 已覆盖 | 待加强 |
|---------|------|--------|--------|
| 创新价值与实用性 | 35% | 多智能体协同、动态画像、多模态资源 | 需突出差异化亮点 |
| 功能实现及技术要求 | 45% | 多智能体框架、5+资源类型、学习路径 | 学习效果评估 |
| 配套文档丰富度 | 10% | PRD文档齐全 | 使用手册、架构图 |
| 演示视频与PPT效果 | 10% | 功能完整 | 需录制精彩演示 |

---

## 四、验证测试清单

- [ ] 启动项目：`docker-compose up`
- [ ] 注册/登录测试账号
- [ ] POST `/api/v1/agent/generate` 创建任务：
  ```json
  {"query": "帮我生成关于反向传播的学习资源", "resource_types": ["mind_map", "document", "exercise"]}
  ```
- [ ] GET `/api/v1/agent/task/{task_id}` 查询状态
- [ ] GET `/api/v1/agent/tasks` 获取任务列表
- [ ] SSE 端点能正常推送进度
- [ ] 前端 /agent/tasks 页面能正常渲染
- [ ] AI Chat 中出现知识盲区检测提示
- [ ] 点击"一键生成学习资源"触发多智能体任务
- [ ] Agent 进度条正常显示

---

## 五、12 天冲刺剩余任务线

```
Day 1-2 ✅ 多智能体框架搭建
Day 3   ✅ Agent API + SSE
Day 4   ✅ 前端集成 + 意图检测
Day 5   🔄 智能辅导 + 学习效果评估 (当前)
Day 6-7   前端体验打磨
Day 8-9   录演示视频
Day 10    做PPT + 写文档
Day 11-12 预演 + 修改
```
