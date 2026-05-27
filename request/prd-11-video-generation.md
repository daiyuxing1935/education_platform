# AI 视频演示生成系统 PRD（v1.0）

> **版本**：v1.0  
> **日期**：2026-05-19  
> **关联项目**：Education Agent - 个性化学习资源生成与学习多智能体系统  
> **对应赛题**：A3-基于大模型的个性化资源生成与学习多智能体系统开发  
> **目标模块**：AI 视频演示生成、可视化图表集成、图片搜索配图

---

## AI 状态维护表

### 人类可读版

| 功能编号 | 功能描述 | 阶段 | 完成 | 通过 | 用户反馈 | 备注 |
|---------|---------|------|------|------|---------|------|
| V1 | 口播稿生成 | P0 | ✅ 是 | ✅ 是 | - | LLM 生成，口语化脚本，含视觉提示标记 |
| V2 | 开发大纲生成 | P0 | ✅ 是 | ✅ 是 | - | LLM 生成，章节划分 + step 计划 |
| V3 | 章节数据生成（含多视觉类型） | P0 | ✅ 是 | ✅ 是 | - | 支持 11 种 visual_type：icon_text/image/table/bar_chart/line_chart/pie_chart/donut_chart/timeline/mindmap/flowchart/gantt |
| V4 | 自包含 HTML 演示页面 | P0 | ✅ 是 | ✅ 是 | - | 1920x1080 舞台，CSS 缩放，转场动画，背景音乐，进度控制 |
| V5 | TTS 音频合成 | P1 | ✅ 是 | ✅ 是 | - | 阿里云 DashScope QWEN TTS，可选，每步独立合成 |
| V6 | 视频播放器（React 组件） | P0 | ✅ 是 | ✅ 是 | - | 幻灯片模式，键盘快捷键，进度拖拽，脚本面板 |
| V7 | 任务管理系统 | P0 | ✅ 是 | ✅ 是 | - | preview → generating → completed/failed，后端状态轮询 |
| V8 | Unsplash 官方图片集成 | P0 | ✅ 是 | ✅ 是 | - | 替换废弃 source.unsplash.com，走官方 API，回退 placehold.co |
| V9 | 思维导图工具 + 渲染 | P0 | ✅ 是 | 🟡 待验证 | - | LLM 生成结构化数据 → call_tool 生成 draw.io XML → render_mindmap HTML |
| V10 | 流程图工具 + 渲染 | P0 | ✅ 是 | 🟡 待验证 | - | LLM 生成步骤连接数据 → call_tool → render_flowchart HTML |
| V11 | 甘特图工具 + 渲染 | P0 | ✅ 是 | 🟡 待验证 | - | LLM 生成任务时间线 → call_tool → render_gantt HTML |
| V12 | 前端图表渲染 | P0 | ✅ 是 | ✅ 是 | - | VideoPlayer 中 renderMindmap/renderFlowchart/renderGantt 组件 |
| V13 | Unsplash MCP 工具 | P1 | ✅ 是 | ✅ 是 | - | search_unsplash MCP 工具，供 Claude Code 搜索配图 |
| V14 | API 配置管理 | P1 | ✅ 是 | ✅ 是 | - | unsplash provider 注册，用户可配置自己的 Access Key |
| V15 | ECharts 图表（bar/line/pie/donut） | P0 | ✅ 是 | ✅ 是 | - | 替换旧 chart 类型，ECharts 5.6.0 渲染到 Canvas，支持柱状/折线/饼图/环形图 |
| V16 | 时间线/里程碑图 | P0 | ✅ 是 | ✅ 是 | - | CSS 渲染里程碑时间线，支持 date/title/description，历史发展/项目节点场景 |
| V17 | JSON 容错 + 重试机制 | P0 | ✅ 是 | ✅ 是 | - | _clean_json_output 处理 LLM 输出，两次重试，max_tokens 8192 |

### JSON 版

```json
{
  "ai_status": {
    "V1_script_generation": {
      "description": "口播稿生成（LLM SCRIPT_PROMPT，电影级脚本，含视觉提示标记）",
      "completed": true,
      "passed": true,
      "user_feedback": null,
      "notes": "SCRIPT_PROMPT 包含沉浸式开场、口语化节奏、视觉标记 [画面:] [重点:] [表格:]"
    },
    "V2_outline_generation": {
      "description": "开发大纲生成（LLM OUTLINE_PROMPT，章节划分 + step 计划 + 时间估算）",
      "completed": true,
      "passed": true,
      "user_feedback": null,
      "notes": "按 --- 节拍分割，每章独立主题，step 含时长估算"
    },
    "V3_chapter_generation": {
      "description": "章节数据生成（LLM CHAPTERS_PROMPT，7 种 visual_type）",
      "completed": true,
      "passed": true,
      "user_feedback": null,
      "notes": "支持 icon_text/image/table/chart/mindmap/flowchart/gantt；generate_chapters() 后处理调用 diagram call_tool 注入 draw.io XML"
    },
    "V4_html_presentation": {
      "description": "自包含 HTML 演示页面生成（build_presentation_html）",
      "completed": true,
      "passed": true,
      "user_feedback": null,
      "notes": "1920x1080 舞台，CSS 等比缩放，7 种视觉内容渲染，背景图/音乐/转场动画/粒子效果/进度条"
    },
    "V5_tts_audio": {
      "description": "TTS 音频合成（DashScope QWEN TTS，可选）",
      "completed": true,
      "passed": true,
      "user_feedback": null,
      "notes": "异步合成，每步独立 wav，通过 api_settings tts provider 配置"
    },
    "V6_video_player": {
      "description": "React 视频播放器组件（VideoPlayer.tsx）",
      "completed": true,
      "passed": true,
      "user_feedback": null,
      "notes": "幻灯片式播放，6 主题色，4 种转场动画，进度拖拽，空格/F 快捷键，脚本面板，Web Speech TTS 备用"
    },
    "V7_task_management": {
      "description": "视频生成任务管理（VideoGenTask 状态机 + API）",
      "completed": true,
      "passed": true,
      "user_feedback": null,
      "notes": "状态流: pending → preview → generating → completed/failed；6 个 API 端点（预览/生成/状态/列表/删除/播放）"
    },
    "V8_unsplash_integration": {
      "description": "Unsplash 官方图片集成（替换废弃 source.unsplash.com）",
      "completed": true,
      "passed": true,
      "user_feedback": null,
      "notes": "UnsplashService 封装官方 API（异步+同步）；_get_image_url 搜索真实图片；_inject_image_urls 为已有视频注入；回退 placehold.co"
    },
    "V9_mindmap_tool": {
      "description": "思维导图工具（diagram_tools.call_tool + diagram_renderer.render_mindmap）",
      "completed": true,
      "passed": false,
      "user_feedback": null,
      "notes": "LLM 输出 mindmap_data → generate_chapters 调用 call_tool(mindmap) 生成 draw.io XML；render_mindmap 渲染彩色树形 HTML"
    },
    "V10_flowchart_tool": {
      "description": "流程图工具（diagram_tools.call_tool + diagram_renderer.render_flowchart）",
      "completed": true,
      "passed": false,
      "user_feedback": null,
      "notes": "LLM 输出 flowchart_data → call_tool(flowchart) 生成 draw.io XML；render_flowchart 渲染垂直箭头布局 HTML"
    },
    "V11_gantt_tool": {
      "description": "甘特图工具（diagram_tools.call_tool + diagram_renderer.render_gantt）",
      "completed": true,
      "passed": false,
      "user_feedback": null,
      "notes": "LLM 输出 gantt_data → call_tool(gantt) 生成 draw.io XML；render_gantt 渲染水平条状 HTML"
    },
    "V12_frontend_diagram_render": {
      "description": "前端 VideoPlayer 图表渲染组件",
      "completed": true,
      "passed": true,
      "user_feedback": null,
      "notes": "renderMindmap/renderFlowchart/renderGantt 三个 React 组件，从 allSteps 接收数据，条件渲染"
    },
    "V13_unsplash_mcp": {
      "description": "Unsplash MCP Server（search_unsplash 工具）",
      "completed": true,
      "passed": true,
      "user_feedback": null,
      "notes": "stdio MCP 服务器，claude 可用 search_unsplash 搜图；需配置 UNSPLASH_ACCESS_KEY 环境变量"
    },
    "V14_api_settings": {
      "description": "Unsplash 作为 provider 注册到 API 配置系统",
      "completed": true,
      "passed": true,
      "user_feedback": null,
      "notes": "crud/api_settings.PROVIDERS + api_settings.py SUPPORTED_PROVIDERS + 前端 ApiSettingsPage 添加"
    },
    "V15_echarts_charts": {
      "description": "ECharts 图表（bar_chart/line_chart/pie_chart/donut_chart）",
      "completed": true,
      "passed": true,
      "user_feedback": null,
      "notes": "ECharts 5.6.0 CDN，替换旧 CSS flex 柱状图，Canvas 渲染，HTML/React 双端支持"
    },
    "V16_timeline": {
      "description": "时间线/里程碑图（timeline）",
      "completed": true,
      "passed": true,
      "user_feedback": null,
      "notes": "纯 CSS 彩点竖排渲染，支持 date/title/description，HTML/React 双端支持"
    },
    "V17_json_robustness": {
      "description": "LLM JSON 容错处理 + 重试机制",
      "completed": true,
      "passed": true,
      "user_feedback": null,
      "notes": "_clean_json_output 预处理（去代码块/去尾逗号/补双引号），2 次重试，max_tokens 8192"
    }
  }
}
```

---

## 1. 核心架构

### 1.1 视频生成流水线

```
用户输入知识点
     ↓
[1] generate_script()     → LLM (SCRIPT_PROMPT) → 电影级口播稿
     ↓
[2] generate_outline()    → LLM (OUTLINE_PROMPT) → 章节大纲 + step 计划
     ↓
[3] generate_chapters()   → LLM (CHAPTERS_PROMPT) → JSON 章节数据
     │                          ↓
     │                    检测 diagram 类型 step
     │                          ↓
     │                    call_tool("mindmap"/"flowchart"/"gantt")
     │                          ↓
     │                    注入 drawio_xml → step 数据
     ↓
[4] build_presentation_html()  → 自包含 HTML 演示页面
     │    ├── icon_text   → SVG 图标
     │    ├── image       → Unsplash 图片 / placehold.co
     │    ├── table       → HTML <table>
     │    ├── bar_chart   → ECharts Canvas 柱状图
     │    ├── line_chart  → ECharts Canvas 折线图
     │    ├── pie_chart   → ECharts Canvas 饼图
     │    ├── donut_chart → ECharts Canvas 环形图
     │    ├── timeline    → CSS 里程碑时间线
     │    ├── mindmap     → render_mindmap() 彩色树形图
     │    ├── flowchart   → render_flowchart() 垂直箭头图
     │    └── gantt       → render_gantt() 水平条状图
     ↓
[5] generate_audio_for_step()  → [可选] TTS 音频合成
     ↓
[6] 保存 KnowledgeResource → video-play API 返回前端
     ↓
[7] VideoPlayer.tsx 渲染 → 用户观看
```

### 1.2 视觉类型对比

| 类型 | 数据结构 | 渲染方式 | 适用场景 |
|------|---------|---------|---------|
| `icon_text` | icon_type + narration | SVG 图标 + 文字 | 抽象概念解释 |
| `image` | image_query | Unsplash 图片 | 具体示例配图 |
| `table` | headers + rows | HTML `<table>` | 数据对比 |
| `bar_chart` | chart_data(labels, values) | ECharts Canvas 柱状图 | 数值对比 / 排名 |
| `line_chart` | chart_data(labels, values) | ECharts Canvas 折线图 | 趋势变化 |
| `pie_chart` | chart_data(labels, values) | ECharts Canvas 饼图 | 占比分布 |
| `donut_chart` | chart_data(labels, values) | ECharts Canvas 环形图 | 占比分布（现代风格） |
| `timeline` | timeline_data(milestones) | CSS 彩点竖排 | 历史发展 / 项目节点 |
| `mindmap` | central + branches | CSS 树形布局 | 知识结构 / 分类体系 |
| `flowchart` | steps + connections | CSS 垂直盒子+箭头 | 流程步骤 / 算法路径 |
| `gantt` | tasks(name,start,duration) | CSS 水平条状 | 项目进度 / 时间线 |

---

## 2. 工具系统

### 2.1 Diagram Tools（视频 agent 调用）

位于 `app/services/diagram_tools.py`，三个工具函数 + 统一入口 `call_tool()`：

| 工具 | 参数 | 返回 | 调用时机 |
|------|------|------|---------|
| `create_mindmap` | central, branches | {drawio_xml, html} | generate_chapters 后处理 |
| `create_flowchart` | title, steps, connections | {drawio_xml, html} | generate_chapters 后处理 |
| `create_gantt` | title, tasks | {drawio_xml, html} | generate_chapters 后处理 |

工具调用发生在 `generate_chapters()` 中 LLM 返回 JSON 之后，属于后处理阶段：
- LLM 决定何时使用哪种图表（通过 CHAPTERS_PROMPT 约束）
- generate_chapters 检测 diagram 类型 step → 调用 call_tool → 注入 draw.io XML
- build_presentation_html 和 VideoPlayer 分别在后端 HTML 和前端 React 中渲染

### 2.2 Diagram Renderer（HTML 渲染）

位于 `app/services/diagram_renderer.py`：
- `render_mindmap()` → 彩色树形布局，中心主题 + 分支 + 子项
- `render_flowchart()` → 垂直盒子+箭头，支持 start/process/decision/end
- `render_gantt()` → 水平彩色任务条，时间刻度 + 任务名称

全部使用纯 CSS 实现，无外部依赖。

### 2.3 Unsplash 图片服务

位于 `app/services/unsplash_service.py`：
- `search_photos()` → 异步搜索，返回图片 URL + 作者信息
- `search_photos_sync()` → 同步版本（用于 HTML 生成）
- `get_random_photo()` → 随机图片获取

所有图片均来自 [Unsplash](https://unsplash.com) 官方 API，需配置 Access Key。

---

## 3. 数据流

### 3.1 请求链路

```
POST /api/v1/resources/video-preview       → generate_script + generate_outline
POST /api/v1/resources/video-generate      → asyncio 后台: generate_chapters → build_presentation_html → TTS
GET  /api/v1/resources/video-gen/{task_id} → 轮询状态 (pending/preview/generating/completed/failed)
GET  /api/v1/resources/{id}/video-play     → 返回完整章节 JSON + 注入图片/音频 URL
```

### 3.2 状态机

```
pending → preview → generating → completed
                            ↓
                         failed
```

---

## 4. 关键文件

| 文件 | 说明 |
|------|------|
| `app/services/video_presentation.py` | 核心生成服务（脚本/大纲/章节/HTML/TTS） |
| `app/services/diagram_tools.py` | 绘图工具集（思维导图/流程图/甘特图） |
| `app/services/diagram_renderer.py` | 图表 HTML 渲染器 |
| `app/services/unsplash_service.py` | Unsplash 官方 API 封装 |
| `app/api/endpoints/video_resources.py` | 视频 API 端点 |
| `app/models/video_gen.py` | VideoGenTask 模型 |
| `frontend/src/components/VideoPlayer.tsx` | React 视频播放器 |
| `frontend/src/components/VideoGenModal.tsx` | 视频生成模态框 |
| `frontend/src/api/resources.ts` | 前端 API 客户端 |
| `mcp_servers/unsplash_search.py` | Unsplash MCP Server |

---

## 5. 环境配置

### 5.1 依赖

已存在于 `requirements.txt`：
- `httpx` — 异步 HTTP（LLM 调用 + Unsplash API）
- `requests` — 同步 HTTP（Unsplash 同步搜索）
- `mcp` — MCP 协议支持（unsplash MCP 工具）

### 5.2 API Key 配置

通过前端「API 配置」页面 `ApiSettingsPage.tsx` 配置：

| Provider | 字段 | 用途 |
|----------|------|------|
| `qwen` / `deepseek` | api_key | LLM 模型调用 |
| `tts` | api_key | 语音合成（可选，可复用 qwen） |
| `unsplash` | api_key | Unsplash 图片搜索 |

---

## 6. 后续规划

| 功能 | 优先级 | 说明 |
|------|--------|------|
| 视频模板选择 | P2 | 多套配色/动画模板供用户选择 |
| 章节手动编辑 | P2 | 用户可拖拽调整章节顺序、替换图片 |
| 图表样式增强 | P2 | 思维导图支持更多层级，流程图支持泳道 |
| draw.io XML 导出 | P2 | 视频中的图表可导出到 Chat 的 draw.io 编辑器继续编辑 |
| 多语言 TTS | P2 | 支持英文/日文语音合成 |
