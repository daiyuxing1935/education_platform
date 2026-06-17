1 # CLAUDE.md - AI Agent 开发规范

本文档是 AI Agent 的操作指南，定义了开发流程、文档规范和质量标准。


### 7.9 测试账号
- 默认测试账号：**用户名 `guoketg`，密码 `123456`**
- 用户反馈的任何问题均可通过登录此账号进行复现和排查
这里是人修的 不要动 因为ai容易看漏 我写在最前面面

### 7.10 Docker 部署
- 项目使用 Docker Compose 编排，配置在 `docker-compose.yml`
- **后端**: 8000 端口（FastAPI）
- **前端**: 3000 端口（React Vite）
- **PostgreSQL**: 5432 端口
- **Redis**: 6379 端口
- **Neo4j**: 7687 端口
- **MongoDB**: 27017 端口
- 修改代码后需要重启容器才会生效：`docker-compose restart backend` 或 `docker-compose restart frontend`

### 7.11 文件格式兼容
- 所有 Office 格式必须兼容：`.pdf`、`.pptx`、`.ppt`、`.docx`、`.doc`（.doc 和 .ppt 为旧版格式，无法解析文本但支持上传）
- 前端文件选择器不使用 `accept` 属性限制（Windows 文件对话框对自定义扩展名支持不稳定），改为 JavaScript 校验
- OLD格式检测到后显示中文提示：建议另存为新格式

### 7.12 端到端测试（Playwright）

**核心原则：Agent 必须像真实用户一样，通过浏览器操作前端页面，验证完整功能链路是否正常。**

#### 7.12.0 自动启动服务（最高优先级）

**Agent 在修改代码后必须执行：**

```bash
# 1. 确保 Docker 服务运行（如果未启动则自动启动）
docker-compose up -d

# 2. 重启相关容器使修改生效
docker-compose restart backend    # 仅后端修改
docker-compose restart frontend   # 仅前端修改

# 3. 等待服务就绪
# 后端：curl http://localhost:8000/api/v1/docs
# 前端：curl http://localhost:3000
```

**原因**：用户期望修改代码后能直接在浏览器看到最新效果。修改代码 → 重启容器 → 用户直接体验，不需要用户手动操作。

#### 7.12.1 环境准备
```bash
# 首次使用需安装 Playwright（项目已包含在 devDependencies 中）
cd frontend
npm install          # 安装依赖（含 @playwright/test）
npx playwright install chromium  # 下载 Chromium 浏览器
```

#### 7.12.2 测试前检查
1. 确认 Docker 服务已全部启动：`docker-compose up -d`
2. 确认前端 3000 端口可访问：`curl http://localhost:3000`
3. 确认后端 8000 端口可访问：`curl http://localhost:8000/api/v1/docs`
4. 确认测试账号可正常登录：guoketg / 123456

#### 7.12.3 端到端测试流程（模拟真实用户操作）

Agent 进行 E2E 测试时，**必须遵循以下步骤，不得跳过任何环节**：

```
1. 启动浏览器（headless 模式）
2. 打开前端页面（http://localhost:3000）
3. 以真实用户身份登录（guoketg / 123456）
4. 像用户一样操作：
   ├── 点击导航/按钮
   ├── 填写表单
   ├── 上传文件
   ├── 等待异步操作完成（LLM 调用、文件处理等）
   └── 观察页面状态变化
5. 在每个关键步骤截图保存
6. 验证：
   ├── 页面是否正常渲染（无白屏/崩溃）
   ├── 操作是否得到预期响应
   ├── 错误提示是否为中文
   └── 数据是否正确展示
7. 如发现 Bug，截图 + 控制台日志 → 报告给用户
```

#### 7.12.4 代码模板

```javascript
// 在 frontend 目录下运行：node -e "..." 
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    // 1. 打开登录页
    await page.goto('http://localhost:3000/login');
    await page.waitForLoadState('networkidle');

    // 2. 填写账号密码
    await page.fill('input[type="text"]', 'guoketg');
    await page.fill('input[type="password"]', '123456');
    
    // 3. 点击登录按钮
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);  // 等待登录完成
    
    // 4. 导航到目标页面
    await page.goto('http://localhost:3000/目标路径');
    await page.waitForLoadState('networkidle');
    
    // 5. 模拟用户操作（点击、填写、上传等）
    // ...具体操作...
    
    // 6. 截图留证
    await page.screenshot({ path: 'screenshot.png' });
    
    // 7. 验证结果
    const text = await page.textContent('body');
    console.log('验证结果:', text.includes('期望的文字'));
    
  } finally {
    await browser.close();
  }
})();
```

#### 7.12.5 常用操作参考

| 用户操作 | Playwright 代码 |
|---------|----------------|
| 点击按钮 | `page.click('button:has-text("按钮文字")')` |
| 填写输入框 | `page.fill('input[type="text"]', '内容')` |
| 选择文件 | `page.locator('input[type="file"]').setInputFiles('文件路径')` |
| 等待文字出现 | `page.waitForSelector('text=期望文字', { timeout: 30000 })` |
| 获取页面文字 | `await page.textContent('body')` |
| 截图 | `await page.screenshot({ path: 'xxx.png' })` |
| 检查元素可见 | `await page.locator('选择器').isVisible()` |
| 下拉框选择 | `page.selectOption('select', 'value')` |

#### 7.12.6 关键测试场景（每次修改后必测）

| 场景 | 验证点 |
|------|--------|
| 登录 → 首页 | 登录成功跳转、首页无白屏 |
| 知识图谱上传 | PDF 选择 → 上传 → LLM 抽取进度 → 构建完成 |
| AI 路径生成 | 填写目标 → 检查 API → 生成进度动画 → 路径预览 |
| 风格评估弹窗 | 冷启动用户 → 3 题弹窗 → 提交 → 自动继续生成 |
| 错误处理 | API 不可用时灰色提示、中文错误信息 |

#### 7.12.7 调试技巧

- **控制台日志**：`page.on('console', msg => console.log(msg.text()))`
- **页面报错**：`page.on('pageerror', err => console.error(err.message))`
- **网络请求**：通过后端 Docker 日志查看：`docker-compose logs backend --tail=50`
- **前端编译错误**：查看 Vite 输出：`docker-compose logs frontend --tail=30`
- **截图目录**：`test_script/screenshot-*.png`（`.gitignore` 已忽略）
---

## 1. 核心原则

### 1.1 用户体验优先
- 所有用户可见的错误信息必须是**中文**，清晰明了
- 所有页面必须有**返回首页**按钮
- 空数据时自动引导至初始化流程，不让用户看到报错

### 1.2 文档一致性
- 修改代码后，必须检查项目结构是否与 README.md、CONTRIBUTING.md 中的描述一致
- 保持 PRD 文档与实际实现的一致性
- README.md 必须确保新用户可以**零基础配置环境**，包括：安装依赖、运行项目、测试项目、服务器配置等所有步骤
- CONTRIBUTING.md **只能追加**，不可覆盖原有内容

### 1.3 前端规范
- 后端设计时要考虑前端展示需求
- 提供完整的 API 接口供前端调用
- 所有 API 响应必须有明确的状态码和错误信息

### 1.4 渐进式开发
- 复杂功能分阶段实现
- 每个阶段有明确的目标和验收标准
- 优先实现核心功能，高级功能后续迭代

### 1.5 信息确认与质量优先
- 当信息不充足或操作存在风险时，**立即中断当前任务**并向用户询问，不可盲目生成代码
- 每次生成代码后必须**及时测试**验证效果

### 1.6 严禁业务数据造假
- **绝对禁止**在任何业务逻辑中使用硬编码的假数据（如虚假的掌握度、趋势图数据、诊断结果、统计数据等）
- **所有业务数据必须从真实 API 调用或数据库查询获得**，禁止使用 `setTimeout`/`setInterval` 生成模拟结果
- 当用户数据为空时，**必须显示空状态引导**（如"暂无数据，请先完成学习"），而非伪造看起来真实的假数据
- 前端 `useState` 初始值不得包含模拟业务数据（如 `useState({ mastered: 35, learning: 28 })`）
- 按钮/标签的文案必须与实际行为一致，不得写"AI 生成"而实际只是数据库查询

### 1.7 业务流程优先（最高优先级）

**核心原则：Agent 开发新功能时，必须先理解完整的用户业务流程，再动手写代码。用户按流程使用系统，不是按 API 列表使用系统。**

#### 1.7.1 为什么必须遵循业务流程？

```
❌ 错误做法：孤立开发
  后端写 3 个 API → 前端写 3 个组件 → 各跑各的 → 用户无法走通完整流程

✅ 正确做法：按用户使用路径开发
  用户打开页面 → 点击按钮 → 填写表单 → 等待结果 → 查看内容 → 确认操作
  └── 每一步的前后端必须打通，数据能从前端传到后端再传回来
```

#### 1.7.2 开发前必须做的事

接到新功能需求时，Agent 必须：

1. **画出用户操作流程图**：从用户打开页面到完成目标的每一步
2. **标注每一步的数据流向**：前端发什么请求 → 后端查什么库 → 返回什么数据 → 前端怎么展示
3. **识别前后依赖**：步骤 B 是否依赖步骤 A 的结果？步骤 A 失败时步骤 B 怎么办？
4. **检查断点**：每一步之间数据是否能正确传递？是否有步骤被跳过或丢弃？

#### 1.7.3 示例：个性化学习路径的完整业务流程

用户使用「学习路径规划」功能的完整链路：

```
业务流程 A：上传新 PDF 构建知识图谱 → 生成路径
  ① 打开知识图谱页面（/knowledge-graph）
  ② 拖拽/选择 PDF 文件 → 点击上传
  ③ 等待后端异步抽取（解析→LLM抽取→融合→导入）
  ④ 看到构建完成（知识点数、关系数）
  ⑤ 点击「生成学习路径」→ 携带 subject_id 跳转到 /path
  ⑥ 选择目标类型/分数/截止日期
  ⑦ 点击「生成学习路径」
  ⑧ 系统检查：LLM API 是否配置？有无认知风格数据？
  ⑨ 冷启动用户 → 弹出风格评估弹窗（3题）
  ⑩ 等待 AI 生成（进度动画）
  ⑪ 预览生成的路径（阶段划分、策略建议、每日计划）
  ⑫ 点击「确认路径」→ 后端持久化到状态机
  ⑬ 进入路径总览页 → 按 AI 推荐的顺序开始学习

业务流程 B：复用已有知识图谱直接生成路径
  ① 打开学习路径页面（/path）
  ② 选择已有学科的 subject
  ③ 后续步骤同流程 A 的⑥~⑬
```

**Agent 开发时必须验证**：上述每一步的数据能否正确传递。例如：
- 步骤④→⑤：KG 构建完成后，`subject_id` 是否已建立关联？
- 步骤⑤→⑥：跳转时 `subject_id` 是否传到了 `/path` 页面？
- 步骤⑪→⑫：AI 生成的路径数据是否完整传给了确认 API？
- 步骤⑫→⑬：确认后状态机中的 `node_order` 是否是 AI 推荐的顺序（而非 sort_order）？

#### 1.7.4 功能完成标准

一个功能**不是**「后端 API 写好了 + 前端组件渲染了」就算完成。完成标准是：

- [ ] 用户能从**入口页面**开始，走完**完整的业务流程**到达**终点**
- [ ] 流程中每一步的**数据传递**都正确（不丢失、不降级、不回退到旧逻辑）
- [ ] 异常分支有**中文提示**和**合理引导**（如未配置 API → 引导配置）
- [ ] 用 Playwright 模拟真实用户走完**完整流程**并通过验证

### 1.8 代码流程原则

**代码流程的核心目标是实现功能 + 保持兼容。不必要的、冲突的、无意义的代码应当删除。**

#### 1.8.1 代码优先级

| 优先级 | 目标 | 说明 |
|--------|------|------|
| 1 | **功能实现** | 代码必须正确实现业务流程中的功能 |
| 2 | **前后兼容** | 新代码不能破坏已有功能；新旧两套逻辑必须统一入口 |
| 3 | **简洁清晰** | 删除死代码、重复逻辑、无效分支 |

#### 1.8.2 何时删除代码

以下情况**必须删除**旧代码，不可保留两套逻辑并存：

- **被新实现替代的旧逻辑**：如旧的 `sort_order` 排序被 AI 路径排序替代后，`GET /path/current` 不应再走 sort_order 分支（除非作为显式降级）
- **从未被调用的死代码**：只写了但从无前端/其他服务调用
- **与新逻辑冲突的代码**：两套逻辑操作同一数据但结果不同，会导致数据不一致
- **无意义的兼容代码**：为已经不存在的旧版本保留的兼容分支

#### 1.8.3 何时保留兼容

- **显式降级路径**：如「LLM 不可用时使用启发式规则」，这是设计意图，必须保留
- **渐进迁移**：如无法一次性迁移所有数据，可短暂保留旧逻辑并在 PRD 中标注删除期限

#### 1.8.4 判断标准

```
问自己三个问题：
1. 删除这段代码后，现有功能会出 bug 吗？ → 会：保留；不会：继续
2. 这段代码是某个异常场景的降级方案吗？ → 是：保留并加注释；不是：继续
3. 这段代码有前端或其他服务在调用吗？ → 有：保留；没有：删除
```

---

## 2. PRD 文档规范

### 2.1 AI 状态维护表（双格式）

**每个 PRD 文档必须在开头包含 AI 可读的状态维护表**，使用**双格式**：
1. **人类可读版**：Markdown 表格，供人快速浏览项目进度
2. **JSON 版**：供 AI 解析和更新

#### 人类可读版格式

| 功能编号 | 功能描述 | 阶段 | 完成 | 通过 | 用户反馈 | 备注 |
|---------|---------|------|------|------|---------|------|
| feature_key | 功能描述 | P0 | 🔴 否 | 🔴 否 | - | 备注信息 |

#### JSON 版格式

```json
{
  "ai_status": {
    "feature_key": {
      "description": "功能描述",
      "completed": false,
      "passed": false,
      "user_feedback": null,
      "notes": "需要修改的地方"
    }
  }
}
```

**字段说明**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `description` | string | 功能描述，来自 PRD 原文 |
| `completed` | boolean | 是否已完成实现（代码写完） |
| `passed` | boolean | 是否通过测试/验收 |
| `user_feedback` | string/null | 用户测试反馈，null 表示未测试 |
| `notes` | string | AI 认为需要修改的地方 |

**状态标识**：

| 完成/通过 | 标识 |
|----------|------|
| 是 | ✅ |
| 否 | 🔴 |
| 部分/进行中 | 🟡 |

**状态流转**：

```
未开始 → 已完成 → 已通过
           ↓
         用户反馈有bug → 修复中 → 已完成 → 已通过
```

**示例**：

人类可读版：
| 功能编号 | 功能描述 | 阶段 | 完成 | 通过 | 用户反馈 | 备注 |
|---------|---------|------|------|------|---------|------|
| P0_basic_chat | 基础对话框架（布局、消息流、Markdown渲染、模型切换） | P0 | ✅ 是 | 🔴 否 | - | 需要添加流式响应支持 |
| P0_chat_history | 对话历史（搜索、新建、切换） | P0 | 🔴 否 | 🔴 否 | 搜索功能响应太慢 | 考虑添加前端缓存 |

JSON 版：
```json
{
  "ai_status": {
    "P0_basic_chat": {
      "description": "基础对话框架（布局、消息流、Markdown渲染、模型切换）",
      "completed": true,
      "passed": false,
      "user_feedback": null,
      "notes": "需要添加流式响应支持"
    },
    "P0_chat_history": {
      "description": "对话历史（搜索、新建、切换）",
      "completed": false,
      "passed": false,
      "user_feedback": "搜索功能响应太慢",
      "notes": "考虑添加前端缓存"
    }
  }
}
```

### 2.2 PRD 更新规则

当完成一个功能时：
1. 将 `completed` 改为 `true`
2. 在 `notes` 中记录实现细节
3. 等待用户测试后，将 `passed` 改为 `true` 或记录 `user_feedback`

当用户反馈问题时：
1. 将 `passed` 改为 `false`
2. 在 `user_feedback` 中记录反馈
3. 在 `notes` 中记录修复计划

---

## 3. 项目结构规范

```
education-agent/
├── app/                          # FastAPI 后端
│   ├── api/endpoints/            # API 端点
│   ├── core/                     # 核心配置
│   ├── crud/                     # CRUD 操作
│   ├── db/                       # 数据库连接
│   └── models/                   # 数据模型
├── frontend/                     # React 前端
│   └── src/
│       ├── api/                  # API 客户端
│       ├── components/           # 公共组件
│       ├── pages/                # 页面组件
│       └── store/                # 状态管理
├── request/                      # PRD 文档
│   ├── prd-1.md                 # 用户账号信息维护
│   ├── prd-2.md                 # 学习画像构建
│   ├── prd-3.md                 # 认证系统
│   └── prd-4.md                 # AI Chat 系统
├── test_script/                  # 测试脚本（不上传 Git）
├── migrations/                    # 数据库迁移
├── README.md                     # 项目文档
├── CONTRIBUTING.md               # 贡献记录
├── CLAUDE.md                     # AI 开发规范
└── .env                         # 环境变量
```

---

## 4. 提交规范

### 4.1 提交信息格式

```
<type>: <subject>

<body>

<footer>
```

### 4.2 Type 类型

| Type | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | 修复 bug |
| `docs` | 文档更新 |
| `style` | 代码格式 |
| `refactor` | 重构 |
| `test` | 测试 |
| `chore` | 构建/工具 |

---

## 5. 分支管理

- `main` - 主分支，稳定版本
- `feature/*` - 功能分支

---

## 6. 开发流程

### 6.1 接受任务

1. 阅读 PRD 文档，了解功能需求
2. 查看 AI 状态维护表，了解当前进度
3. 确定实现顺序（优先 P0 核心功能）

### 6.2 实现功能

1. **先画业务流程**（参考 §1.7）：确认用户从入口到终点的每一步，标注数据流向
2. 先实现后端 API（同时考虑前端展示逻辑）
3. 再实现前端页面
4. **验证业务闭环**：前后端数据能否从头传到尾？每一步之间是否有断点？
5. 生成代码后及时测试，验证效果
6. 更新 PRD 文档的 AI 状态维护表
7. 更新 CONTRIBUTING.md 记录开发内容（**仅追加**，不可覆盖）
8. **审查代码流程**（参考 §1.8）：是否有应删除的死代码/冲突代码/无意义兼容代码？

### 6.3 完成检查

- [ ] **业务流程完整可走通**：用户能从入口页面走到终点，每一步数据正确传递
- [ ] 代码符合项目规范
- [ ] README.md、CONTRIBUTING.md 已更新
- [ ] PRD 文档 AI 状态维护表已更新
- [ ] `requirements.txt` 已同步更新（新增 Python 依赖后必须立即更新，不允许遗漏）
- [ ] 用户提示信息为中文
- [ ] 页面有返回首页按钮
- [ ] 空数据有引导流程
- [ ] Bug 修复时必须**前后端一起检查**，不可仅排查单侧
- [ ] **已删除死代码/冲突代码**（参考 §1.8）：不存在两套逻辑操作同一数据的情况

---

## 7. 注意事项

### 7.1 API 设计
- 所有 API 必须有 JWT 认证（除了注册、登录）
- 错误响应必须包含 `detail` 字段说明原因
- 列表接口必须支持分页

### 7.2 前端交互
- 所有操作必须有加载状态提示
- **通知分级策略**：
  - 注册/登录等核心界面：必须有成功/失败提示
  - 基础页面跳转：无需成功/失败提示
  - 与大模型对话：成功不提示，失败需展示具体错误原因
- 所有页面必须有**返回导航**功能（back navigation）
- 404 错误自动引导至相关初始化页面

### 7.3 数据库
- 所有数据库连接通过依赖注入获取
- 不在代码中硬编码密码或密钥
- 使用迁移脚本管理数据库结构

### 7.4 依赖管理
- `requirements.txt` 是项目的依赖清单，**每次 `pip install <package>` 后必须立即更新**
- 不允许有任何遗漏，队友因缺少依赖报错时首先检查 `requirements.txt`
- 每次提交前必须确认 `requirements.txt` 与当前虚拟环境已安装的包一致

### 7.5 环境与端口
- **后端运行在 8000 端口，前端运行在 3000 端口**
- 若实际端口与上述不符，**立即中断对话并说明原因**

### 7.6 .env 文件保护
- **禁止随意修改或删除 `.env` 文件**
- 任何对 `.env` 的修改必须**先向用户询问，获得许可后方可操作**

### 7.7 虚拟环境
- 运行代码或执行 `pip install` 前，**必须先激活虚拟环境**
- 未激活虚拟环境会导致大量报错及全局依赖冲突

### 7.8 外部服务配置
- **LLM / OCR / Web Search 功能**：必须先验证 API 配置是否存在
  - API 未配置时，前端对应功能**灰色显示**，用户不可使用
  - 用户提供错误的 API Key 时，必须给出**详细的中文错误提示**
- **Web Search**：仅支持通义 Web-Search MCP 服务，需提供对应的 API 和 URL
- **OCR**：仅支持百度 OCR 服务，需提供正确的 API Key 和 Secret Key
  - OCR 的目的：为纯文本模型提供图片文字识别能力，使其兼容多模态场景
  - 模型本身支持多模态时，无需 OCR

### 7.13 AI 对话中的图表渲染（[PLOT] 图片管道）

**核心原则：AI 生成的 `[PLOT]` 代码由后端在保存消息时执行，生成 PNG 文件并替换为图片 URL。前端不再执行任何 `[PLOT]` 代码。**

#### 完整链路

```
① AI 生成响应，包含 [PLOT]...[／PLOT] 标记
② 前端流式渲染时隐藏 [PLOT] 内容，显示"AI 正在生成图表中..."
③ 流式结束后，前端调用 POST /api/v1/chat/messages 保存消息
④ 后端 save_message 端点拦截 [PLOT] 代码块：
   ├── 提取代码 → 调用 _execute_plot() 执行
   ├── 保存 PNG 到 uploads/plots/plot_{uuid}.png
   └── 将 [PLOT]...[／PLOT] 替换为 ![图表](／api/v1/chat/plots/plot_{uuid}.png)
⑤ 后端返回处理后的消息内容（含图片 URL）
⑥ 前端更新消息内容 → ReactMarkdown 渲染 <img> 标签
⑦ 再次打开对话时，图片 URL 直接加载，无需任何代码执行
```

#### 关键文件

| 文件 | 职责 |
|------|------|
| `app/api/endpoints/chat.py` → `save_message` | 拦截 `[PLOT]` → 执行 → 存 PNG → 替换 URL |
| `app/api/endpoints/chat.py` → `GET /plots/{filename}` | 提供图表静态文件（FileResponse） |
| `app/api/endpoints/code_execution.py` → `_execute_plot()` | 执行 matplotlib 代码，返回 base64 PNG |
| `frontend/src/utils/drawio.ts` → `getDrawioSystemPrompt()` | AI 系统提示词，规定何时用 [DRAWIO]/[PLOT]/[SVG] |
| `frontend/src/components/MessageList.tsx` | 渲染消息：文本用 ReactMarkdown，drawio 图用 DiagramImage，[PLOT] 占位符 |
| `frontend/src/components/ChatPlatform.tsx` | saveMessage 后更新消息内容为处理后的版本 |
| `Dockerfile.backend` | 必须包含 `fonts-noto-cjk` 中文字体包 |

#### 中文字体

- 系统必须安装 `fonts-noto-cjk` 包
- matplotlib 字体配置：`['Noto Sans CJK SC', 'Noto Sans CJK TC', 'Noto Sans CJK JP', 'DejaVu Sans']`
- 每次重启容器后需清除 matplotlib 字体缓存：`rm -rf /root/.cache/matplotlib/`

#### 系统提示词规则

- `[DRAWIO]`：仅用于流程图、思维导图、架构图、ER 图、UML 等商业图表
- `[PLOT]`：用于所有数学/科学图：树、图、函数图、柱状图、散点图、DAG 等
- `[SVG]`：仅用于简单小图
- AI 回复中**禁止**提及 matplotlib/networkx/numpy/pandas 等库名

#### 禁止事项

- ❌ 前端执行 `[PLOT]` 代码（旧逻辑已删除）
- ❌ 用 `base64` 内嵌图片到消息中
- ❌ 用 `[DRAWIO]` 画树/图/数学结构
- ❌ AI 回复中提及技术库名（"使用 matplotlib 绘制" → "以下是生成的示意图"）

---

*本文档由 AI Agent 维护，最后更新：2026-06-16（新增 §7.13 AI 图表渲染管道）*
