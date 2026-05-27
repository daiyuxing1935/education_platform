# 个性化学习路径与学习仪表盘系统 PRD（v1.1）

> **版本**：v1.1  
> **日期**：2026-05-17（更新）  
> **关联项目**：Education Agent - 个性化资源生成与学习多智能体系统  
> **对应赛题**：A3-基于大模型的个性化资源生成与学习多智能体系统开发  
> **目标模块**：学习路径可视化升级、学习画像仪表盘、首页重构、智能推荐体验升级

---

## AI 状态维护表

### 人类可读版

| 功能编号 | 功能描述 | 阶段 | 完成 | MCP 测试 | 用户测试 | 备注 |
|---------|---------|------|------|---------|---------|------|
| LP-1 | PRD 文档编写 | P0 | ✅ 是 | 🔴 未测 | 🔴 未测 | 初次编写完成 |
| LP-2 | 交互式知识图谱（ReactFlow DAG 替换 Markmap） | P0 | ✅ 是 | 🟡 进行中 | 🔴 未测 | **增强：Neo4j 真实 PREREQUISITE/RELATED_TO 依赖边替换领域内顺序假边；dagre 自动布局替代手动排列；双模式（DAG数据可用→dagre布局，不可用→领域分组降级）；加权评分排序(w1掌握度/w2重要度/w3考察频率/w4认知负荷)** |
| LP-3 | 学习画像仪表盘（雷达图+热力图+趋势图） | P0 | ✅ 是 | ✅ 通过 | 🔴 未测 | 雷达图含三维度(58%/58%/72%)网格轴标签数据点；趋势图渐变填充+数据点上升趋势；热力图180天含实际练习数据 |
| LP-4 | 首页重构为个人学习中心 | P0 | ✅ 是 | ✅ 通过 | 🔴 未测 | 欢迎横幅+连续学习天数+4统计卡片+今日建议(AI+个性化)+掌握度分布条+快速开始+学习贴士 |
| LP-5 | 智能推荐浮窗升级 | P0 | ✅ 是 | ✅ 通过 | 🔴 未测 | 毛玻璃效果、入场/退场动画、类型颜色标签、关闭/查看详情交互 |
| LP-6 | 学习热力图组件 | P1 | 🔴 否 | 🔴 未测 | 🔴 未测 | GitHub-style contribution graph |
| LP-7 | 学习报告周报系统 | P1 | 🔴 否 | 🔴 未测 | 🔴 未测 | 每周自动生成学习报告 |
| LP-8 | 学习目标设定与追踪 | P1 | 🔴 否 | 🔴 未测 | 🔴 未测 | 用户设定目标，系统追踪进度 |
| LP-9 | 成就/徽章系统 | P2 | 🔴 否 | 🔴 未测 | 🔴 未测 | 学习里程碑成就 |
| LP-10 | 3D 知识图谱增强 | P2 | 🔴 否 | 🔴 未测 | 🔴 未测 | 在 ReactFlow 基础上增加 3D 力导向图视图 |

### JSON 版

```json
{
  "ai_status": {
    "LP-1_prd": {
      "description": "PRD 文档编写（个性化学习路径与仪表盘）",
      "completed": true,
      "mcp_tested": false,
      "user_tested": false,
      "user_feedback": null,
      "notes": "已完成：含10个功能模块、双格式维护表、数据模型、API规范、组件结构、实施路线图"
    },
    "LP-2_knowledge_graph": {
      "description": "交互式知识图谱（ReactFlow DAG，节点=知识点，边=前置依赖，颜色=掌握度）",
      "completed": true,
      "mcp_tested": false,
      "user_tested": false,
      "user_feedback": null,
      "notes": "增强完成：KnowledgeGraph.tsx 双模式—有DAG数据时使用dagre自动布局+真实PREREQUISITE/RELATED_TO边（实线动画/虚线），无DAG数据时降级领域分组排列；PathPlanner新增加权评分函数和深度层级布局；后端/GET /path/current 返回 dag_data 字段（Neo4j不可用时静默降级）。"
    },
    "LP-3_profile_dashboard": {
      "description": "学习画像仪表盘（雷达图-三维度、热力图-学习活跃度、趋势图-掌握度变化）",
      "completed": true,
      "mcp_tested": true,
      "user_tested": false,
      "user_feedback": null,
      "notes": "已完成：RadarChart.tsx(三角雷达图含网格/轴标签/数据点/数值标记)、TrendChart.tsx(渐变填充区域+折线+数据点+坐标轴)、HeatmapCalendar.tsx(GitHub-style矩形热力图+颜色图例)。MCP测试：三个图表在DynamicProfilePage正常渲染，数据正确。"
    },
    "LP-4_homepage_redesign": {
      "description": "首页重构为个人学习中心（学习统计、今日推荐、待办事项、连续学习天数）",
      "completed": true,
      "mcp_tested": true,
      "user_tested": false,
      "user_feedback": null,
      "notes": "已完成：登录后展示个人学习中心(欢迎横幅+连续学习7天+4统计卡片+今日建议6项+掌握度分布条+快速开始4入口+学习贴士)；未登录保留原Hero+功能卡片。MCP测试：所有区域正常渲染，推荐链接可点击。"
    },
    "LP-5_rec_popup_upgrade": {
      "description": "智能推荐浮窗升级（毛玻璃效果、动画、推荐理由直观展示、接受/拒绝交互）",
      "completed": true,
      "mcp_tested": true,
      "user_tested": false,
      "user_feedback": null,
      "notes": "已完成：毛玻璃效果(backdrop-filter)、入场/退场动画、8种推荐类型颜色标签、关闭后120s不重复弹出。MCP测试：弹窗在第3题后出现→显示正常→关闭按钮隐藏弹窗。"
    },
    "LP-6_heatmap": {
      "description": "学习热力图组件（GitHub-style contribution graph 展示学习活跃度）",
      "completed": false,
      "mcp_tested": false,
      "user_tested": false,
      "user_feedback": null,
      "notes": "P1 功能，使用 d3.js 实现"
    },
    "LP-7_weekly_report": {
      "description": "学习报告周报系统（每周自动生成学习报告，含统计数据和建议）",
      "completed": false,
      "mcp_tested": false,
      "user_tested": false,
      "user_feedback": null,
      "notes": "P1 功能，需要后端新增 API"
    },
    "LP-8_goal_tracking": {
      "description": "学习目标设定与追踪（用户设定每日/每周目标，系统追踪进度）",
      "completed": false,
      "mcp_tested": false,
      "user_tested": false,
      "user_feedback": null,
      "notes": "P1 功能"
    },
    "LP-9_achievements": {
      "description": "成就/徽章系统（学习里程碑成就、首次练习、连续学习等）",
      "completed": false,
      "mcp_tested": false,
      "user_tested": false,
      "user_feedback": null,
      "notes": "P2 功能"
    },
    "LP-10_3d_graph": {
      "description": "3D 知识图谱增强（在 ReactFlow 基础上增加 3D 力导向图视图切换）",
      "completed": false,
      "mcp_tested": false,
      "user_tested": false,
      "user_feedback": null,
      "notes": "P2 功能"
    }
  }
}
```

### 状态流转规则

- **完成**：代码实现完成，TypeScript 编译通过，Vite 构建成功
- **MCP 测试**：通过 Playwright 自动化测试验证功能正常
- **用户测试**：用户手动操作验证并反馈

---

## 1. 模块概述与设计原则

### 1.1 模块定位

个性化学习路径与学习仪表盘系统是 Education Agent 的"门面"模块。它承担以下角色：

1. **学习路径可视化**：将知识图谱以直观的交互式图表展示，让学生清楚看到自己的学习进度和知识关联
2. **学习画像仪表盘**：将多维度的学习数据以图表形式展示，让学生一目了然地了解自己的学习状态
3. **个人学习中心**：首页作为学习入口，展示核心信息和引导
4. **智能推荐触达**：在合适的时间、以合适的方式向学生推送学习建议

### 1.2 设计原则

- **可视化优先**：能用图表展示的数据不用表格，能用图形展示的关系不用列表
- **交互性**：所有图表支持交互（悬停提示、点击下钻、缩放拖拽）
- **动效引导**：使用微动画引导用户注意力，提升体验
- **渐进披露**：先展示概览，用户需要时再展示详细信息
- **空状态引导**：数据为空时引导用户开始学习
- **统一设计语言**：毛玻璃卡片、圆角、柔和阴影、一致的颜色体系

### 1.3 与现有模块的关系

| 模块 | 关系 |
|------|------|
| 题库系统 (PRD v5) | 练习数据驱动画像更新，画像数据驱动推荐 |
| AI Chat 系统 | 对话内容分析补充画像数据 |
| 个性化推荐系统 | 推荐内容在此模块展示和触达 |
| 学习路径 V2 | 路径数据在此模块可视化呈现 |

---

## 2. 功能详细设计

### 2.1 LP-2: 交互式知识图谱

#### 2.1.1 概述

将当前 LearningPathPage 右侧的 Markmap 思维导图替换为 ReactFlow 交互式 DAG 图。每个知识点是一个节点，前置依赖关系为有向边，掌握度通过节点颜色/大小体现。

#### 2.1.2 数据来源

复用现有 `GET /path/current` API 返回的 `nodes` 列表 + `path_planner.py` 中的 `plan()` 方法返回的 ReactFlow 格式数据（该功能已实现但前端未使用）。

#### 2.1.3 节点设计

| 属性 | 设计 |
|------|------|
| 形状 | 圆角矩形 |
| 大小 | 固定，选中时缩放 1.05 |
| 颜色 | 掌握度 >= 80: #10B981 (绿)；60-79: #F59E0B (橙)；< 60: #EF4444 (红)；未开始: #D1D5DB (灰) |
| 边框 | 选中时发光效果 (box-shadow) |
| 标签 | 知识点名称 + 掌握度百分比 |
| 图标 | 状态图标 (✅/🔄/⏳/📌) |

#### 2.1.4 边设计

| 属性 | 设计 |
|------|------|
| 类型 | 有向边（箭头） |
| 颜色 | #9CA3AF 灰色 |
| 样式 | 实线（PREREQUISITE）或虚线（RELATED_TO） |
| 动画 | 学习路径建议流动画（虚线滚动） |

#### 2.1.5 交互

- **拖拽**：节点可自由拖拽重新布局
- **缩放**：鼠标滚轮缩放，支持缩放到适应屏幕
- **点击节点**：打开详情抽屉（复用现有 detailDrawer）
- **双击节点**：跳转到对应知识点练习
- **右键菜单**：标记已学习 / 去做题 / 查看详情

#### 2.1.6 布局

使用 ReactFlow 的 `dagre` 布局算法，按领域分组排列，前置依赖从左到右排列。

#### 2.1.7 边界情况

- 空路径：保持现有空状态引导
- 加载中：骨架屏（Skeleton loading）
- 错误：错误提示 + 重试按钮
- 无依赖关系：节点平铺排列

---

### 2.2 LP-3: 学习画像仪表盘

#### 2.2.1 概述

在 DynamicProfilePage 顶部增加三个核心图表，直观展示学习画像数据。

#### 2.2.2 雷达图（Radar Chart）

展示三个核心维度：
- 元认知校准 (metacognitive_calibration)
- 注意力特征 (attention_feature)
- 学习节奏 (learning_rhythm.scalar)

**设计**：
- 三角形雷达图，三轴各对应一个维度
- 填充区域使用半透明渐变
- 数值显示在顶点
- 低于 0.3 的维度红色高亮

#### 2.2.3 学习热力图（Heatmap Calendar）

GitHub-style contribution graph 展示过去 365 天的学习活跃度。

**设计**：
- 每一天一个格子
- 颜色深浅代表学习时长或题目数量
- 悬停显示具体日期和数据
- 空数据时显示 "暂无学习记录"

#### 2.2.4 掌握度趋势图（Trend Chart）

展示近 N 天的掌握度变化趋势。

**设计**：
- 折线图，X 轴为日期，Y 轴为掌握度百分比
- 多条线表示不同知识点或领域
- 可切换查看范围（7天/30天/全部）
- 关键节点标记（开始学习、复习等事件）

#### 2.2.5 数据来源

- 雷达图数据：`profileV2Api.getProfile()` 返回的 metacognitive_calibration、attention_feature、learning_rhythm
- 热力图数据：需要新增 API `GET /profile/learning-heatmap?days=365`
- 趋势图数据：需要新增 API `GET /profile/mastery-trend?days=30`

---

### 2.3 LP-4: 首页重构为个人学习中心

#### 2.3.1 概述

首页在登录后不再显示通用 Hero 页面，而是展示个性化学习中心。

#### 2.3.2 布局

```
┌─────────────────────────────────────────────────┐
│ [Nav Bar]                             用户信息 │
├───────────────────────┬─────────────────────────┤
│ 今日概览              │ 学习统计                │
│ ┌─────────────────┐   │ ┌─────┐ ┌─────┐ ┌────┐ │
│ │ 连续学习 X 天    │   │ 掌握 │ 练习 │ 知识 │   │
│ │ 今日已完成 X 题  │   │ 度   │ 题数 │ 点数 │   │
│ └─────────────────┘   │ └─────┘ └─────┘ └────┘ │
│                       │                         │
│ 待办事项              │ 掌握度分布              │
│ ┌─────────────────┐   │ ┌─────────────────────┐ │
│ │ 📌 待复习 3 项   │   │    [环形图]           │ │
│ │ ⏳ 推荐学习 2 项 │   │                       │ │
│ └─────────────────┘   │ └─────────────────────┘ │
│                       │                         │
│ 今日推荐              │ 活跃热力图(小)           │
│ ┌─────────────────┐   │ ┌─────────────────────┐ │
│ │ 🤖 推荐卡片 1   │   │   ████░░░░ 小图       │ │
│ │ 🤖 推荐卡片 2   │   │                       │ │
│ └─────────────────┘   └─────────────────────────┘
├─────────────────────────────────────────────────┤
│ 核心功能入口 (4 卡片)                             │
└─────────────────────────────────────────────────┘
```

#### 2.3.3 各区域设计

**今日概览**：
- 连续学习天数（Streak）：从 localStorage 或 API 获取
- 今日已完成题目数
- 今日学习时长
- 使用大号数字 + 标签展示

**待办事项**：
- 待复习知识点列表（来自 Agent 推荐）
- 推荐学习内容（来自推荐系统）
- 每项显示优先级标签（高/中/低）
- 点击直接跳转

**学习统计**：
- 三张统计卡片：总掌握度、总练习数、知识点数
- 数字大号显示，带趋势箭头

**掌握度分布**：
- 环形图（donut chart）
- 分段：已掌握(>=80) / 学习中(60-79) / 薄弱(<60) / 未开始
- 显示各段占比

**活跃热力图**：
- 缩略版 GitHub 热力图（30天）
- 点击可跳转到完整画像页面

**今日推荐**：
- 来自 Agent 系统的高优先级推荐
- 显示推荐原因 + 行动按钮

#### 2.3.4 数据来源

- 学习统计：`GET /path/current` 的 summary
- 今日推荐：`GET /path/agent/recommend`
- 热力图：`GET /profile/learning-heatmap`
- 连续天数：`GET /profile/streak`
- 掌握度分布：从 `GET /path/current` 的 nodes 计算

#### 2.3.5 未登录状态

保持现有 Hero 页面设计不变，展示产品介绍和登录/注册按钮。

---

### 2.4 LP-5: 智能推荐浮窗升级

#### 2.4.1 概述

将当前 PracticeRecommendPopup 从简单白底浮动框升级为毛玻璃效果的智能推荐卡片。

#### 2.4.2 设计

**视觉**：
- 毛玻璃效果（backdrop-filter: blur(16px)）
- 背景：rgba(255, 255, 255, 0.7)
- 圆角：16px
- 阴影：大号柔和阴影
- 边框：1px solid rgba(255,255,255,0.3)
- 入场动画：从右下角滑入 + 淡入

**内容**：
- 顶部：推荐类型图标 + 标签 + 关闭按钮
- 中间：推荐标题（大号） + 推荐理由（两行限制）
- 底部：接受按钮 + 忽略按钮
- 推荐类型用不同颜色标签区分

**交互**：
- 点击关闭：平滑右滑消失，2分钟内不重复弹出
- 点击"查看详情"：跳转到学习路径页面相关知识点的弹出详细信息，或直接弹窗展示做题卡片
- 点击忽略：缩小消失，记录偏好

---

## 3. 新增后端 API

### 3.1 `GET /profile/learning-heatmap`

返回用户学习热力图数据。

**响应**：
```json
{
  "heatmap_data": [
    {"date": "2026-05-10", "count": 15, "duration_minutes": 45},
    {"date": "2026-05-11", "count": 0, "duration_minutes": 0}
  ],
  "total_active_days": 45,
  "current_streak": 7,
  "longest_streak": 12
}
```

### 3.2 `GET /profile/mastery-trend`

返回掌握度趋势数据。

**响应**：
```json
{
  "trend_data": [
    {"date": "2026-05-10", "overall_mastery": 45.2, "domain_masteries": {"计算机网络": 60, "操作系统": 40}},
    {"date": "2026-05-11", "overall_mastery": 46.0, "domain_masteries": {"计算机网络": 62, "操作系统": 41}}
  ]
}
```

### 3.3 `GET /profile/streak`

返回学习连续天数。

**响应**：
```json
{
  "current_streak": 7,
  "longest_streak": 12,
  "today_completed": 5,
  "today_minutes": 32
}
```

---

## 4. 前端组件结构

```
src/
├── components/
│   ├── charts/
│   │   ├── RadarChart.tsx          # 雷达图（d3）
│   │   ├── HeatmapCalendar.tsx     # 学习热力图（d3）
│   │   ├── TrendChart.tsx          # 趋势折线图（d3）
│   │   └── DonutChart.tsx          # 环形图（d3）
│   ├── KnowledgeGraph.tsx          # ReactFlow 交互式知识图谱（替换 MindmapRenderer）
│   └── PracticeRecommendPopup.tsx  # 升级版推荐浮窗（已存在，需升级）
├── pages/
│   ├── HomePage.tsx                # 重构为个人学习中心（已存在，需重构）
│   ├── DynamicProfilePage.tsx      # 新增仪表盘图表（已存在，需增强）
│   └── LearningPathPage.tsx        # 使用 KnowledgeGraph（已存在，需修改）
```

---

## 5. 实施路线图

| 阶段 | 功能 | 预计工时 | 说明 |
|------|------|---------|------|
| 1 | LP-2 交互式知识图谱 | 4h | ReactFlow 替换 Markmap，最核心的视觉升级 |
| 2 | LP-5 推荐浮窗升级 | 1h | 小改动，快速见效 |
| 3 | LP-3 画像仪表盘 | 3h | 雷达图 + 热力图 + 趋势图 |
| 4 | LP-4 首页重构 | 3h | 个人学习中心 |
| 5 | 整体联调 + MCP 测试 | 2h | 统一测试所有 P0 功能 |

---

## 6. 设计参考

### 6.1 颜色体系

| 用途 | 颜色 |
|------|------|
| 已掌握 / 高效率 | #10B981 (翡翠绿) |
| 学习中 / 中等 | #F59E0B (琥珀色) |
| 薄弱 / 低效 | #EF4444 (红色) |
| 未开始 | #D1D5DB (灰色) |
| 品牌色 | #1E3A8A (深蓝) |
| 毛玻璃背景 | rgba(255, 255, 255, 0.7) |

### 6.2 动效规范

| 场景 | 动效 |
|------|------|
| 页面进入 | fadeIn 0.3s |
| 卡片出现 | slideUp 0.3s |
| 弹窗出现 | scale + fadeIn 0.2s |
| 节点选中 | box-shadow 发光 0.2s |
| 数据加载 | 骨架屏脉冲动画 |
| 推荐浮窗 | 右下滑入 0.3s ease-out |

---

## 7. 降级策略

| 场景 | 降级方案 |
|------|---------|
| ReactFlow 渲染失败 | 降级为 Markmap 思维导图（保留旧组件） |
| 图表数据为空 | 显示空状态引导，不报错 |
| 热力图 API 不可用 | 隐藏热力图区域，不阻塞页面 |
| 趋势图 API 不可用 | 隐藏趋势图区域，不阻塞页面 |
| 毛玻璃不兼容 | 回退为纯色背景（白底） |

---

*本文档由 AI Agent 维护，最后更新：2026-05-17*
