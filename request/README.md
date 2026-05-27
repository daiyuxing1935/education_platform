# Education Agent - 个性化学习资源生成与学习多智能体系统

基于大模型的个性化资源生成与学习多智能体系统，为学生提供专属的个性化学习智能体。包含 AI 对话、题库练习、学习画像、项目管理等功能。

> 详细开发记录见 [CONTRIBUTING.md](CONTRIBUTING.md)

---

## 技术栈

| 层 | 技术 |
|------|------|
| 后端 | FastAPI (Python 3.12) |
| 前端 | React 18 + TypeScript + Vite |
| LLM | DeepSeek API / Qwen API（流式输出 + 深度思考） |
| 数据库 | PostgreSQL + pgvector, Neo4j, MongoDB |
| 缓存 | Redis |
| 认证 | JWT + bcrypt |
| 向量检索 | FAISS + sentence-transformers |

---

## 快速启动（Docker Compose，推荐）

### 前置条件

- Docker & Docker Compose
- 端口 3000、8000、5432、6379、7687、27017 未被占用

### 启动步骤

```bash
# 1. 克隆项目
git clone <repository-url>
cd education-agent

# 2. 配置环境变量（可选，默认即可启动）
# 编辑 .env 填入 API Key 等配置（见下方说明）

# 3. 一键启动所有服务
docker-compose up -d

# 4. 查看启动状态
docker-compose ps

# 5. 初始化数据库
docker exec -it ea-backend python -m app.scripts.run_migration

# 6. 访问
# 前端: http://localhost:3000
# 后端: http://localhost:8000
# API 文档: http://localhost:3000/swagger
```

### 首次配置

编辑 `.env`，至少配置一个 LLM API Key 才能使用 AI 对话和出题功能：

```env
# DeepSeek（推荐）
DEEPSEEK_API_KEY=sk-your-key-here
DEEPSEEK_MODEL=deepseek-v4-pro

# Qwen（可选）
QWEN_API_KEY=your-key-here
QWEN_MODEL=qwen-turbo
```

> 完整的 `.env` 配置项参见 `.env` 文件。Docker 模式下数据库连接已自动配置，无需修改。

### 常用命令

```bash
# 重启后端（代码修改后）
docker-compose restart backend

# 重启前端
docker-compose restart frontend

# 查看日志
docker-compose logs -f backend
docker-compose logs -f frontend

# 停止所有服务
docker-compose down

# 停止并删除数据卷（清空数据库）
docker-compose down -v
```

---

## 本地开发（非 Docker）

### 1. 启动数据库服务

```bash
docker-compose up -d postgres redis neo4j mongodb
```

### 2. 后端

```bash
# 创建虚拟环境
python -m venv venv
.\venv\Scripts\Activate.ps1  # Windows
# source venv/bin/activate   # Linux/Mac

# 安装依赖
pip install -r requirements.txt

# 设置 PYTHONPATH
$env:PYTHONPATH="d:\code\MyPython\education-agent"  # Windows PowerShell

# 执行数据库迁移
python -m app.scripts.run_migration

# 启动后端（热更新）
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. 前端

```bash
cd frontend
npm install
npm run dev
```

前端默认运行在 http://localhost:3000，端口被占用时会自动递增。

---

## 默认账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 管理员 | admin | admin123 |
| 测试用户 | guoketg | 123456 |

> 首次部署请修改管理员密码。

---

## 访问地址

| 服务 | 地址 |
|------|------|
| 前端 | http://localhost:3000 |
| 后端 API | http://localhost:8000/api/v1 |
| API 文档 (Swagger) | http://localhost:3000/swagger |
| API 文档 (ReDoc) | http://localhost:3000/redoc |
| 健康检查 | http://localhost:3000/health |

---

## 项目结构

```
education-agent/
├── app/                    # FastAPI 后端
│   ├── api/endpoints/      # API 端点
│   ├── core/               # 核心模块（配置、安全、向量检索等）
│   ├── crud/               # CRUD 操作
│   ├── db/                 # 数据库连接（PostgreSQL/Neo4j/MongoDB）
│   ├── models/             # 数据模型
│   └── schemas/            # Pydantic 模型
├── frontend/               # React 前端
│   └── src/
│       ├── api/            # API 客户端
│       ├── components/     # 公共组件
│       ├── pages/          # 页面
│       └── store/          # 状态管理
├── migrations/             # 数据库迁移脚本
├── request/                # PRD 文档
└── docker-compose.yml      # Docker 编排
```

---

## 了解更多

- [开发规范与贡献记录](CONTRIBUTING.md) — 详细开发时间线、功能实现记录、项目规范
- [AI 开发指南](AGENTS.md) — 面向 AI Agent 的编码指南

---

## License

MIT
