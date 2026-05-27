# PRD-10：思维导图个性化资源系统

## 概述

本文档描述「个性化学习资源」功能的完整实现方案。该功能以**思维导图（Mind Map）** 为核心资源类型，通过 LLM 自动生成结构化的 Markdown 内容，并借助 **markmap-lib** 在浏览器端渲染为交互式 SVG 思维导图。

---

## 一、功能架构

```
┌─────────────────────────────────────────────────────────┐
│                    用户交互层 (React)                      │
│  ResourcesPage (列表/分组)  ResourceDetailPage (查看/编辑) │
│         MindmapRenderer (markmap SVG 渲染)               │
├─────────────────────────────────────────────────────────┤
│                      API 层 (FastAPI)                    │
│   GET/POST /resources     POST /resources/generate       │
│   POST /resources/auto-generate  PUT/DELETE /resources   │
├─────────────────────────────────────────────────────────┤
│                     服务层 (Python)                       │
│   ResourceGenerator.generate_mindmap(kps)→Markdown       │
│   _get_recommended_resources()→错题已有资源推荐           │
├─────────────────────────────────────────────────────────┤
│                     数据层 (PostgreSQL)                   │
│   knowledge_resources 表                                 │
│   (user_id, title, content, knowledge_points JSONB...)   │
└─────────────────────────────────────────────────────────┘
```

### 触发链路

```
┌─ AI Chat 知识盲区检测 ─────────────────────────────┐
│  1. SSE 返回 knowledge_gap_detected 事件            │
│  2. 前端自动调 resourcesApi.autoGenerate()          │
│  3. 不重复生成已有资源的点                          │
│  4. UI 显示"🧠 查看思维导图"按钮 → 跳转资源详情    │
└────────────────────────────────────────────────────┘

┌─ 题库练习答错 ─────────────────────────────────────┐
│  1. submit_answer / submit_answers_batch 接口       │
│  2. 从题目关联的知识点 UUID → 查 KnowledgePoint 名称  │
│  3. 匹配 knowledge_resources 表中已有资源             │
│  4. 返回 recommended_resources 数组给前端            │
│  5. 不自动生成新资源，只推荐已有资源                  │
└────────────────────────────────────────────────────┘

┌─ 手动生成 ──────────────────────────────────────────┐
│  1. 用户点击"生成思维导图"按钮                       │
│  2. 输入知识点名称                                  │
│  3. 调 POST /resources/generate                     │
│  4. LLM 生成 → 存入数据库 → 跳转详情页               │
└────────────────────────────────────────────────────┘
```

---

## 二、数据模型

文件：`app/models/resource.py`

```python
class KnowledgeResource(Base):
    __tablename__ = "knowledge_resources"

    id              = Column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id         = Column(Uuid, ForeignKey("users.id"), nullable=False, index=True)
    title           = Column(String(200), nullable=False)
    resource_type   = Column(String(50), nullable=False, default="mind_map")  # 扩展点
    content         = Column(Text, nullable=False)           # Markdown 内容
    knowledge_points = Column(JSONB, nullable=False, default=list)  # ["知识点1", ...]
    source          = Column(String(50), nullable=True)      # manual | chat_gap | wrong_answer
    source_ref      = Column(String(100), nullable=True)     # chat_id 或 question_id
    tags            = Column(JSONB, nullable=False, default=list)
    created_at      = Column(DateTime, default=datetime.utcnow)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

设计说明：
- `resource_type` 设计为可扩展，后续可支持**视频、文档、外部链接**等资源类型
- `knowledge_points` 使用 JSONB 数组存储知识点名称（非 UUID），便于跨题库使用
- `source` 记录触发来源，`source_ref` 记录来源 ID（如对话 ID 或题目 ID），用于追溯

---

## 三、LLM 思维导图生成服务

文件：`app/services/resource_generator.py`

### 3.1 核心逻辑

```python
class ResourceGenerator:
    async def generate_mindmap(knowledge_points: List[str]) -> Optional[str]
```

1. 接收知识点名称列表（如 `["Python 变量类型", "数据类型"]`）
2. 拼接系统提示词 + 用户提示词，调用 LLM 的 `/chat/completions` 接口
3. 解析返回的 content，清理可能的 `` ```markdown `` 代码块包装
4. 返回纯 Markdown 字符串

### 3.2 API Key 优先级

1. 优先使用**用户配置的 API Key**（从 `api_settings` 表中读取，支持 qwen / deepseek）
2. 用户未配置时，使用系统级环境变量 `QWEN_API_KEY` 或 `DEEPSEEK_API_KEY`
3. `base_url` 为空时自动填充系统默认值（见 `PROVIDER_CONFIG`）

### 3.3 Prompt 设计

系统提示词要求 LLM 输出满足 markmap 规范的 Markdown 格式：

```markdown
# 知识点名称
## 子主题
- 列表项
  - 子项
- 核心概念、分类、原理、应用场景
```

特点：
- **一级标题** `#` 作为根节点
- **二级标题** `##` 作为子主题
- **无序列表** `-` 及缩进表示层级关系
- 每个知识点 3-6 个子主题，内容适度

### 3.4 API Provider 配置

```python
PROVIDER_CONFIG = {
    "qwen": {
        "default_base_url": settings.QWEN_BASE_URL,      # 环境变量或默认
        "default_model": "qwen-turbo-latest",
    },
    "deepseek": {
        "default_base_url": settings.DEEPSEEK_BASE_URL,
        "default_model": "deepseek-chat",
    },
}
```

---

## 四、后端 API

文件：`app/api/endpoints/resources.py`

路由前缀：`/api/v1/resources`（已注册到 `app/main.py`）

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/resources` | 列出当前用户所有资源，支持 `knowledge_point` 和 `resource_type` 过滤 |
| GET | `/resources/knowledge-points` | 按知识点分组，每组含资源列表及计数 |
| GET | `/resources/{id}` | 获取单个资源详情（含 content 全文） |
| POST | `/resources/generate` | 手动生成思维导图（调 LLM → 存数据库 → 返回完整对象） |
| PUT | `/resources/{id}` | 更新资源（title / content / knowledge_points） |
| DELETE | `/resources/{id}` | 删除资源 |
| POST | `/resources/auto-generate` | 自动生成（Chat/题库触发），已有资源的点跳过不重复生成 |

### 关键逻辑：`_get_user_api()`

```python
def _get_user_api(db, student_id) -> Optional[dict]:
```
- 读取用户在 `api_settings` 中配置的 API Key（支持 qwen / deepseek 双 provider）
- `base_url` 为空时自动填入系统默认值
- 返回 `{api_key, base_url, provider, model}` 四元组
- 确保 LLM 请求始终发到正确的 API 端点

### 答题错题推荐：`_get_recommended_resources()`

文件：`app/api/endpoints/question_bank.py`

```python
def _get_recommended_resources(db, student_id, kp_names, max_results=3) -> list[dict]:
```

- 根据题目关联的知识点名称，查 `knowledge_resources` 表中该用户已有的匹配资源
- 使用 PostgreSQL JSONB `overlap` 操作符做数组交集匹配
- 返回每个资源的 `{id, title, resource_type, knowledge_points}`，按 `updated_at` 降序排列
- 限制最多 3 条

响应中包含推荐资源：

```json
{
  "is_correct": false,
  "recommended_resources": [
    {
      "id": "uuid",
      "title": "Python 变量类型 思维导图",
      "resource_type": "mind_map",
      "knowledge_points": ["变量与数据类型"]
    }
  ]
}
```

---

## 五、前端 markmap 渲染

### 5.1 依赖

文件：`frontend/package.json`

```json
{
  "markmap-lib": "^0.18.0",
  "markmap-view": "^0.18.0",
  "d3": "^7.9.0"
}
```

### 5.2 MindmapRenderer 组件

文件：`frontend/src/components/MindmapRenderer.tsx`

**渲染流程：**

```
┌──────────────────────────────────────────────────┐
│  1. 组件挂载 → Markmap.create(svgRef, options)    │
│  2. content 变化 → Transformer().transform(md)    │
│  3. markmapRef.setData(root) → 更新 SVG 树        │
│  4. markmapRef.fit(80) → 自适应容器大小            │
│  5. 组件卸载 → markmapRef.destroy()               │
└──────────────────────────────────────────────────┘
```

**交互控制：**
- 拖拽平移（pan）
- 滚轮缩放（rescale）
- 适应窗口（fit）
- 底部悬浮按钮组：放大 `＋`、缩小 `−`、适应 `⟲`

**选项配置：**

```typescript
const defaultOptions: Partial<IMarkmapOptions> = {
  maxWidth: 300,
  pan: true,
  duration: 300,
  spacingHorizontal: 16,
  spacingVertical: 8,
  paddingX: 16,
  nodeMinHeight: 8,
  autoFit: true,
  fitRatio: 0.8,
}
```

**生命周期管理：**

```
mount → create Markmap instance
content change → transform markdown → setData → fit
unmount → destroy instance (cleanup)
```

### 5.3 导出功能

#### SVG 导出（`handleExportSVG`）

```
1. 从 DOM 获取 SVG 元素 (cloneNode)
2. 设置 width/height/viewBox 属性
3. XMLSerializer.serializeToString() → Blob
4. URL.createObjectURL() → 创建临时下载链接
```

#### PNG 导出（`handleExportPNG`）

```
1. 克隆 SVG，添加 XML 声明头
2. 创建 Blob → ObjectURL → new Image()
3. Image.onload → canvas.drawImage() (2x 缩放)
4. canvas.toBlob('image/png') → 下载
```

关键处理：
- 2 倍缩放输出保证清晰度
- 白色背景垫底（`fillStyle = '#ffffff'`）
- 无需额外依赖（纯 Canvas API）

### 5.4 编辑模式

ResourceDetailPage 支持查看/编辑双模式切换：

```
┌───────────── 编辑模式 ───────────────────┐
│  左：Markdown 源码编辑器 (monospace)       │
│  右：实时 MindmapRenderer 预览            │
│         保存 → PUT /resources/{id}        │
└─────────────────────────────────────────┘
```

---

## 六、前端页面

### 6.1 ResourcesPage（资源列表页）

文件：`frontend/src/pages/ResourcesPage.tsx`

**数据加载：** `GET /resources/knowledge-points` → 按知识点分组展示

**空状态引导：** 无资源时显示引导，链接至 AI 对话和题库

**交互：**
- 搜索框过滤知识点名称
- 生成按钮 → Modal 弹窗输入知识点名称（逗号/换行分隔）+ 可选标题
- 生成成功后自动跳转至详情页
- 每个资源卡片可删除

### 6.2 ResourceDetailPage（资源详情/编辑页）

文件：`frontend/src/pages/ResourceDetailPage.tsx`

**功能：**
- 查看模式：MarkmapRenderer 渲染 + 缩放控件
- 编辑模式：Markdown 源码编辑 + 实时预览
- 导出 SVG / PNG
- 显示来源、创建日期、关联知识点标签

### 6.3 API 客户端

文件：`frontend/src/api/resources.ts`

```typescript
resourcesApi = {
  list(params?)             → GET /resources
  get(id)                  → GET /resources/{id}
  generate(data)           → POST /resources/generate
  update(id, data)         → PUT /resources/{id}
  delete(id)               → DELETE /resources/{id}
  listKnowledgePoints()    → GET /resources/knowledge-points
  autoGenerate(data)       → POST /resources/auto-generate
}
```

---

## 七、触发集成

### 7.1 AI Chat 盲区检测

文件：`frontend/src/components/ChatPlatform.tsx`

当 SSE 流式响应返回 `knowledge_gap_detected` 事件时：

1. 前端自动保存到学习画像（调 `profileV2Api.addKnowledge`）
2. 前端自动后台生成资源（调 `resourcesApi.autoGenerate`，`source: 'chat_gap'`）
3. UI 显示盲区检测提示条：
   - "🧠 查看思维导图" → 链接到 `/resources?kp=xxx`
   - "📚 详细讲解" → 自动发送教学请求
   - 关闭按钮

### 7.2 题库答错推荐

文件：`app/api/endpoints/question_bank.py`

`submit_answer` 和 `submit_answers_batch` 两个端点中：

1. 获取题目关联的知识点 UUID
2. 查 KnowledgePoint 表得到知识点名称
3. 调 `_get_recommended_resources()` 匹配已有资源
4. 将推荐列表塞入响应体的 `recommended_resources` 字段

**设计原则：答错只推荐已有资源，不自动生成新资源。** 因为：
- 自动生成是耗时的 LLM 调用，不应阻塞答题响应
- 题库练习高频答错时，不宜每次都生成（已有 Chat 盲区检测的生成路径）

---

## 八、路由注册

文件：`app/main.py`

```python
from app.api.endpoints import resources
app.include_router(resources.router, prefix=settings.API_V1_STR)
```

文件：`frontend/src/App.tsx`

```
/resources       → ResourcesPage
/resources/:id   → ResourceDetailPage
```

---

## 九、页面布局参考

### ResourcesPage

```
┌──────────────────────────────────────────────────────┐
│  ← 返回首页                                          │
│  个性化学习资源                         [生成思维导图 ➕] │
│  [搜索知识点...]                                      │
├──────────────────────────────────────────────────────┤
│                                                      │
│  📂 Python 变量类型（2 个资源）                       │
│  ┌──────────────────┐  ┌──────────────────┐          │
│  │ 📊 Python变量类型   │  │ 📊 数据类型详解    │          │
│  │ 变量与数据类型      │  │ 变量与数据类型     │          │
│  │ AI对话自动生成      │  │ 答题推荐          │          │
│  │ [查看]        [🗑] │  │ [查看]        [🗑] │          │
│  └──────────────────┘  └──────────────────┘          │
│                                                      │
│  📂 函数与作用域（1 个资源）                          │
│  ┌──────────────────┐                                │
│  │ 📊 Python函数详解  │                                │
│  │ 函数定义、作用域... │                                │
│  │ 手动生成           │                                │
│  └──────────────────┘                                │
│                                                      │
│  空数据引导：AI 对话提问 → 系统自动生成                │
└──────────────────────────────────────────────────────┘
```

### ResourceDetailPage

```
┌──────────────────────────────────────────────────────┐
│  ← 返回资源列表   思维导图: Python 变量类型            │
│  AI对话自动生成 · 2026-05-16  [变量与数据类型]        │
│  [编辑] [导出SVG] [导出PNG]                           │
├──────────────────────────────────────────────────────┤
│                                                      │
│         ┌─── 思维导图（markmap 渲染） ───┐             │
│         │                              │             │
│         │       # Python 变量类型        │             │
│         │       /     |      \         │             │
│         │    数字   字符串   布尔        │             │
│         │    / \      |       |        │             │
│         │  int float  str   True/False │             │
│         │                              │             │
│         │         [+ 缩放控件]         │             │
│         └──────────────────────────────┘             │
└──────────────────────────────────────────────────────┘
```

---

## 十、文件清单

### 新建文件

| 文件 | 用途 |
|------|------|
| `app/models/resource.py` | KnowledgeResource 数据模型 |
| `app/services/resource_generator.py` | LLM 思维导图生成服务 |
| `app/api/endpoints/resources.py` | 资源管理 API（7 个端点） |
| `frontend/src/api/resources.ts` | 前端 API 客户端 |
| `frontend/src/components/MindmapRenderer.tsx` | markmap 封装渲染组件 |
| `frontend/src/pages/ResourcesPage.tsx` | 资源列表页（按知识点分组） |
| `frontend/src/pages/ResourceDetailPage.tsx` | 资源详情/编辑/导出页 |

### 修改文件

| 文件 | 变更 |
|------|------|
| `app/main.py` | 注册 resources.router |
| `app/schemas/question_bank.py` | AnswerSubmitResponse 增加 recommended_resources |
| `app/api/endpoints/question_bank.py` | 答错时推荐已有资源 |
| `frontend/src/App.tsx` | 添加 `/resources` 和 `/resources/:id` 路由 |
| `frontend/src/pages/HomePage.tsx` | 导航栏+首页卡片链接 |
| `frontend/src/components/ChatPlatform.tsx` | 知识盲区检测 UI + 自动生成资源 |
| `frontend/src/api/questionBank.ts` | 更新 submitAnswer/submitAnswers 返回类型 |
| `frontend/package.json` | 新增 markmap-lib、markmap-view、d3 依赖 |

---

## 十一、设计原则

1. **按知识点组织（扁平结构）**：不同于题库的"科目→领域→知识点"三层结构，资源系统以知识点为基本单位，方便跨题库复用
2. **资源类型可扩展**：`resource_type` 字段设计为字符串枚举，后续可增加 `video`、`document`、`external_link` 等类型
3. **不重复生成**：`auto-generate` 接口检查已有资源，不创建重复资源
4. **答错只推荐不生成**：避免高频 LLM 调用阻塞答题流程
5. **用户 API Key 优先**：使用用户自己在系统中配置的 LLM API Key，未配置时降级到系统默认
