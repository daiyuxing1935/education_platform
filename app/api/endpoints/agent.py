"""多智能体协同 API

提供以下端点：
- POST   /agent/generate           创建多智能体生成任务（异步）
- GET    /agent/task/{task_id}      查询任务状态
- GET    /agent/tasks               获取用户的所有任务列表
- GET    /agent/task/{task_id}/sse  SSE 流式推送任务进度
- POST   /agent/task/{task_id}/cancel  取消任务
"""

import asyncio
import json
import logging
from typing import Optional, List
from uuid import UUID, uuid4
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, CurrentUser, get_current_active_user
from app.core.security import decode_token
from app.db.database import get_db
from app.models.agent_task import AgentTask
from app.services.multi_agent.workflow import (
    run_agent_workflow,
    get_task_status,
    get_simplified_status,
)
from app.services.multi_agent.state import ALL_RESOURCE_TYPES

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agent", tags=["Multi-Agent"])


async def _get_sse_user(
    token: Optional[str] = Query(None),
    current_user: CurrentUser = Depends(get_current_user),
) -> CurrentUser:
    """SSE 端点认证：支持 Bearer header 或 ?token=xxx 参数（EventSource 兼容）"""
    return current_user


def _get_user_from_token(token: str) -> Optional[CurrentUser]:
    """从 JWT token 解析用户"""
    try:
        payload = decode_token(token)
        if payload and payload.get("type") == "access":
            student_id = payload.get("sub")
            role = payload.get("role")
            if student_id and role:
                return CurrentUser(student_id=UUID(student_id), role=role)
    except Exception:
        pass
    return None


# ── Schemas ──

class GenerateRequest(BaseModel):
    query: str
    knowledge_points: Optional[List[str]] = None
    resource_types: Optional[List[str]] = None
    subject_id: Optional[str] = None


class GenerateResponse(BaseModel):
    task_id: str
    status: str
    message: str


class ResourceSummary(BaseModel):
    id: Optional[str] = None
    title: Optional[str] = None
    resource_type: Optional[str] = None
    knowledge_points: List[str] = []


class ProfileSummary(BaseModel):
    total_knowledge_points: int = 0
    total_weak_points: int = 0
    cognitive_style: Optional[str] = None


class TaskStatusResponse(BaseModel):
    task_id: str
    status: str  # pending / running / completed / failed
    progress: float
    current_agent: str
    error: Optional[str] = None
    query: str
    knowledge_points: List[str] = []
    generated_types: List[str] = []
    resources: List[ResourceSummary] = []
    profile_summary: Optional[ProfileSummary] = None
    path_id: Optional[str] = None
    created_at: Optional[str] = None
    completed_at: Optional[str] = None


class TaskListItem(BaseModel):
    task_id: str
    query: str
    status: str
    progress: float
    generated_types: List[str] = []
    created_at: str


class TaskListResponse(BaseModel):
    tasks: List[TaskListItem]
    total: int


# ── Helpers ──

def _task_to_status(task: AgentTask) -> TaskStatusResponse:
    """将 AgentTask 模型转换为状态响应"""
    return TaskStatusResponse(
        task_id=str(task.id),
        status=task.status,
        progress=task.progress,
        current_agent=task.current_agent or "",
        error=task.error_message,
        query=task.query,
        knowledge_points=list(task.knowledge_points or []),
        generated_types=list(task.generated_types or []),
        resources=[],
        profile_summary=None,
        path_id=str(task.path_id) if task.path_id else None,
        created_at=task.created_at.isoformat() if task.created_at else None,
        completed_at=task.completed_at.isoformat() if task.completed_at else None,
    )


# ── 后台任务执行 ──

async def _execute_agent_task(task_id: str, user_id: str):
    """在后台执行 Agent 工作流（在独立数据库会话中执行）"""
    from app.db.database import SessionLocal
    from app.crud.api_settings import api_settings_crud
    db = SessionLocal()
    try:
        # 获取任务记录
        task = db.query(AgentTask).filter(AgentTask.id == task_id).first()
        if not task:
            logger.error(f"[Agent] 任务 {task_id} 不存在")
            return

        # 读取用户的 LLM API 配置
        user_api_key = None
        user_api_base = None
        user_api_model = None
        try:
            # 优先 deepseek，再尝试 qwen
            for provider in ["deepseek", "qwen"]:
                user_api = api_settings_crud.get_setting_value(db, user_id, provider)
                if user_api and user_api.get("api_key"):
                    user_api_key = user_api["api_key"]
                    user_api_base = user_api.get("base_url")
                    if provider == "qwen":
                        user_api_model = user_api.get("model", "qwen-turbo-latest")
                    else:
                        user_api_model = user_api.get("model", "deepseek-chat")
                    break
        except Exception as e:
            logger.warning(f"[Agent] 读取用户 API 配置失败: {e}")

        # 更新状态为 running
        task.status = "running"
        task.current_agent = "scheduler"
        task.progress = 0.0
        db.commit()

        # 执行工作流（传入 API 配置）
        final_state = await run_agent_workflow(
            task_id=str(task.id),
            student_id=str(task.user_id),
            query=task.query,
            knowledge_points=list(task.knowledge_points or []),
            resource_types=list(task.resource_types or []),
            subject_id=task.subject_id,
            user_api_key=user_api_key,
            user_api_base=user_api_base,
            user_api_model=user_api_model,
        )

        # 更新任务记录
        task.status = final_state.get("task_status", "completed")
        task.progress = final_state.get("progress", 1.0)
        task.current_agent = final_state.get("current_agent", "")
        task.error_message = final_state.get("error")

        if final_state.get("generated_types"):
            task.generated_types = final_state["generated_types"]

        if final_state.get("resources"):
            task.resource_ids = [r.get("id") for r in final_state["resources"] if r.get("id")]

        if final_state.get("path_id"):
            from uuid import UUID as UUIDType
            task.path_id = UUIDType(final_state["path_id"])

        # 保存状态快照（简化版）
        task.state_snapshot = get_simplified_status(final_state)

        if task.status == "completed":
            task.completed_at = datetime.utcnow()
            generated_count = len(final_state.get("generated_types", []))
            task.result_summary = f"成功生成 {generated_count} 类学习资源"
        elif task.status == "failed":
            task.result_summary = f"任务失败: {final_state.get('error', '未知错误')}"

        db.commit()
        logger.info(f"[Agent] 任务 {task_id} 完成，状态: {task.status}")

    except Exception as e:
        logger.error(f"[Agent] 后台任务 {task_id} 异常: {e}", exc_info=True)
        try:
            task = db.query(AgentTask).filter(AgentTask.id == task_id).first()
            if task:
                task.status = "failed"
                task.error_message = str(e)
                db.commit()
        except Exception:
            pass
    finally:
        db.close()


# ── Endpoints ──

@router.post("/generate", response_model=GenerateResponse)
async def create_generation_task(
    req: GenerateRequest,
    background_tasks: BackgroundTasks,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """创建多智能体资源生成任务

    1. 校验输入
    2. 创建 AgentTask 记录
    3. 后台启动 LangGraph 工作流
    4. 立即返回 task_id（前端轮询或 SSE 获取进度）
    """
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="查询内容不能为空")

    # 限制资源类型
    resource_types = req.resource_types or ALL_RESOURCE_TYPES[:4]
    for rt in resource_types:
        if rt not in ALL_RESOURCE_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"无效的资源类型: {rt}，有效值: {', '.join(ALL_RESOURCE_TYPES)}"
            )

    # 创建任务记录
    task_id = uuid4()
    task = AgentTask(
        id=task_id,
        user_id=current_user.student_id,
        query=req.query,
        knowledge_points=req.knowledge_points or [],
        resource_types=resource_types,
        subject_id=req.subject_id,
        status="pending",
        progress=0.0,
    )
    db.add(task)
    db.commit()

    # 后台执行工作流（后台任务内部会创建独立的数据库会话）
    background_tasks.add_task(_execute_agent_task, str(task_id), str(current_user.student_id))

    logger.info(
        f"[Agent] 创建任务 {task_id}: query={req.query[:50]}..., "
        f"resource_types={resource_types}"
    )

    return GenerateResponse(
        task_id=str(task_id),
        status="pending",
        message="多智能体任务已创建，请轮询查询进度",
    )


@router.get("/task/{task_id}", response_model=TaskStatusResponse)
async def get_task_status_endpoint(
    task_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """查询任务状态"""
    task = db.query(AgentTask).filter(
        AgentTask.id == task_id,
        AgentTask.user_id == current_user.student_id,
    ).first()

    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    # 如果有 state_snapshot，补充资源摘要
    resp = _task_to_status(task)
    if task.state_snapshot:
        snapshot = task.state_snapshot
        resources = snapshot.get("resources", [])
        resp.resources = [ResourceSummary(**r) for r in resources if isinstance(r, dict)]
        profile = snapshot.get("profile_summary")
        if profile and isinstance(profile, dict):
            resp.profile_summary = ProfileSummary(**profile)

    return resp


@router.get("/tasks", response_model=TaskListResponse)
async def list_tasks(
    limit: int = Query(10, ge=1, le=50),
    offset: int = Query(0, ge=0),
    status_filter: Optional[str] = Query(None, description="按状态筛选: pending/running/completed/failed"),
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取用户的所有 Agent 任务列表"""
    query = db.query(AgentTask).filter(AgentTask.user_id == current_user.student_id)

    if status_filter:
        query = query.filter(AgentTask.status == status_filter)

    total = query.count()
    tasks = query.order_by(AgentTask.created_at.desc()).offset(offset).limit(limit).all()

    return TaskListResponse(
        tasks=[
            TaskListItem(
                task_id=str(t.id),
                query=t.query[:100],
                status=t.status,
                progress=t.progress,
                generated_types=list(t.generated_types or []),
                created_at=t.created_at.isoformat() if t.created_at else "",
            )
            for t in tasks
        ],
        total=total,
    )


@router.get("/task/{task_id}/sse")
async def stream_task_sse(
    task_id: str,
    token: str = Query(..., description="JWT token (EventSource 需要)"),
    db: Session = Depends(get_db),
):
    """SSE 流式推送任务进度

    使用 ?token=xxx 认证（因为 EventSource 不支持自定义 header）。
    """
    current_user = _get_user_from_token(token)
    if not current_user:
        raise HTTPException(status_code=401, detail="认证失败，token 无效或已过期")
    # 验证任务存在且属于当前用户
    task = db.query(AgentTask).filter(
        AgentTask.id == task_id,
        AgentTask.user_id == current_user.student_id,
    ).first()

    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    async def event_generator():
        last_status = None
        last_progress = -1

        while True:
            # 重新查询最新状态
            current_task = db.query(AgentTask).filter(AgentTask.id == task_id).first()
            if not current_task:
                yield f"event: error\ndata: {json.dumps({'error': '任务不存在'})}\n\n"
                break

            # 只在状态或进度变化时推送
            status_changed = current_task.status != last_status
            progress_changed = abs(current_task.progress - last_progress) > 0.05

            if status_changed or progress_changed:
                last_status = current_task.status
                last_progress = current_task.progress

                data = {
                    "task_id": str(current_task.id),
                    "status": current_task.status,
                    "progress": current_task.progress,
                    "current_agent": current_task.current_agent or "",
                    "error": current_task.error_message,
                }
                yield f"event: progress\ndata: {json.dumps(data)}\n\n"

                # 任务完成或失败时结束
                if current_task.status in ("completed", "failed"):
                    # 发送最终状态
                    if current_task.state_snapshot:
                        yield f"event: complete\ndata: {json.dumps(current_task.state_snapshot)}\n\n"
                    break

            # 每 1 秒轮询一次
            await asyncio.sleep(1)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/task/{task_id}/cancel")
async def cancel_task(
    task_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """取消任务"""
    task = db.query(AgentTask).filter(
        AgentTask.id == task_id,
        AgentTask.user_id == current_user.student_id,
    ).first()

    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    if task.status in ("completed", "failed"):
        raise HTTPException(status_code=400, detail="任务已结束，无法取消")

    task.status = "failed"
    task.error_message = "用户取消"
    db.commit()

    return {"success": True, "message": "任务已取消"}
