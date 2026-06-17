"""视频资源 API

视频生成是基于 web-video-presentation Skill 的工作流：
口播稿 → 开发大纲 → 分章内容 → HTML 演示页面 → (可选 TTS 音频)

端点：
- POST   /resources/video-preview        生成预览（口播稿 + 大纲），立即返回
- POST   /resources/video-generate       确认生成完整视频（异步）
- GET    /resources/video-gen/{task_id}   获取任务状态/结果
- GET    /resources/{id}/video-play       播放视频演示页面
"""

import json
import logging
import os
import time as time_module
from typing import Optional, List, Dict, Tuple
from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.db.database import get_db
from app.api.dependencies import get_current_active_user
from app.core.config import settings as app_settings
from app.models.resource import KnowledgeResource
from app.models.video_gen import VideoGenTask
from app.services.video_presentation import VideoPresentationGenerator, VIDEO_DIR

# ── Unsplash 探针结果缓存（避免每次看视频都等网络超时） ──
# _unsplash_cache[user_id] = (可用与否, 缓存时间戳)
_unsplash_cache: Dict[str, Tuple[bool, float]] = {}
_UNSPLASH_CACHE_TTL = 300  # 5 分钟

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/resources", tags=["Video Resources"])


# ── Schemas ──

class VideoPreviewRequest(BaseModel):
    knowledge_points: List[str]


class VideoPreviewResponse(BaseModel):
    task_id: str
    script_content: str
    outline_content: str


class VideoGenerateRequest(BaseModel):
    task_id: str


class VideoGenStatusResponse(BaseModel):
    task_id: str
    status: str  # pending | preview | confirmed | generating | completed | failed
    progress_message: Optional[str] = None
    progress_pct: Optional[str] = None
    script_content: Optional[str] = None
    outline_content: Optional[str] = None
    resource_id: Optional[str] = None
    error_message: Optional[str] = None
    knowledge_points: Optional[List[str]] = None
    created_at: Optional[str] = None


# ── 辅助函数 ──

def _get_user_api(db: Session, student_id: str) -> Optional[dict]:
    """获取用户配置的 LLM API Key（优先使用用户设置的模型版本）"""
    from app.crud.api_settings import api_settings_crud
    for provider in ["qwen", "deepseek"]:
        api = api_settings_crud.get_setting_value(db, student_id, provider)
        if api:
            cfg = {
                "qwen": {"default_base_url": app_settings.QWEN_BASE_URL, "default_model": "qwen-plus"},
                "deepseek": {"default_base_url": app_settings.DEEPSEEK_BASE_URL, "default_model": "deepseek-chat"},
            }.get(provider, {})
            return {
                "api_key": api.get("api_key"),
                "base_url": api.get("base_url") or cfg.get("default_base_url"),
                "provider": provider,
                "model": api.get("model_version") or cfg.get("default_model", "qwen-plus"),
            }
    return None


def _get_tts_api(db: Session, student_id: str) -> Optional[str]:
    """获取用户配置的 TTS API Key

    优先使用独立配置的 tts provider，其次使用 qwen provider（共享 DashScope）。
    """
    from app.crud.api_settings import api_settings_crud

    # 优先检查独立配置的 tts provider
    tts_setting = api_settings_crud.get_setting_value(db, student_id, "tts")
    if tts_setting and tts_setting.get("api_key"):
        return tts_setting["api_key"]

    # 回退到 qwen 的 API Key（两者都使用 DashScope）
    qwen_setting = api_settings_crud.get_setting_value(db, student_id, "qwen")
    if qwen_setting and qwen_setting.get("api_key"):
        return qwen_setting["api_key"]

    return None


def _get_unsplash_api(db: Session, student_id: str) -> Optional[str]:
    """获取用户配置的 Unsplash Access Key"""
    from app.crud.api_settings import api_settings_crud
    setting = api_settings_crud.get_setting_value(db, student_id, "unsplash")
    if setting and setting.get("api_key"):
        return setting["api_key"]
    return None


# ── 端点 ──

@router.post("/video-preview", response_model=VideoPreviewResponse)
async def create_video_preview(
    req: VideoPreviewRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """Step 1: 生成视频预览（口播稿 + 大纲）

    快速返回，用户确认后才进入完整生成。
    """
    if not req.knowledge_points:
        raise HTTPException(status_code=400, detail="请指定至少一个知识点")

    student_id = str(current_user.student_id)
    api_info = _get_user_api(db, student_id)
    tts_api_key = _get_tts_api(db, student_id)
    unsplash_key = _get_unsplash_api(db, student_id)

    generator = VideoPresentationGenerator(
        api_key=api_info.get("api_key") if api_info else None,
        base_url=api_info.get("base_url") if api_info else None,
        model=api_info.get("model") if api_info else None,
        tts_api_key=tts_api_key,
        unsplash_access_key=unsplash_key,
    )
    script = await generator.generate_script(req.knowledge_points)
    if not script:
        raise HTTPException(status_code=502, detail="口播稿生成失败，请检查 API 配置")

    # 生成大纲
    outline = await generator.generate_outline(script)
    if not outline:
        raise HTTPException(status_code=502, detail="开发大纲生成失败")

    # 保存任务
    task = VideoGenTask(
        user_id=current_user.student_id,
        knowledge_points=req.knowledge_points,
        status="preview",
        script_content=script,
        outline_content=outline,
        progress_message="预览已就绪，等待确认",
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    return VideoPreviewResponse(
        task_id=str(task.id),
        script_content=script,
        outline_content=outline,
    )


@router.post("/video-generate", response_model=VideoGenStatusResponse)
async def confirm_and_generate(
    req: VideoGenerateRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """Step 2: 确认预览并开始完整视频生成（异步）

    用户查看预览后确认，触发后台完整生成流程。
    返回任务 ID，前端轮询状态。
    """
    task_id = req.task_id
    task = db.query(VideoGenTask).filter(
        VideoGenTask.id == task_id,
        VideoGenTask.user_id == current_user.student_id,
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    if task.status != "preview":
        raise HTTPException(status_code=400, detail=f"任务状态异常: {task.status}，需要 preview 状态")

    # 标记为确认
    task.status = "generating"
    task.progress_message = "正在生成章节内容..."
    task.progress_pct = "10%"
    db.commit()

    # 异步生成完整视频（不 await，让后台运行）
    # 使用 FastAPI 的 BackgroundTasks 或直接创建异步任务
    import asyncio
    asyncio.create_task(_run_full_generation(task_id, db, current_user.student_id))

    return VideoGenStatusResponse(
        task_id=str(task.id),
        status="generating",
        progress_message="视频生成已开始，请耐心等待。生成过程包括：章节内容 → 演示页面 → 音频合成，通常需要 1-3 分钟。",
        progress_pct="10%",
        knowledge_points=task.knowledge_points,
        created_at=task.created_at.isoformat() if task.created_at else None,
    )


async def _run_full_generation(task_id: UUID, db: Session, student_id: UUID):
    """后台执行完整视频生成"""
    try:
        # 重新获取 task（新 session）
        from app.db.database import SessionLocal
        session = SessionLocal()
        try:
            task = session.query(VideoGenTask).filter(VideoGenTask.id == task_id).first()
            if not task:
                logger.error(f"任务 {task_id} 不存在")
                return

            api_info = _get_user_api(session, str(student_id))
            tts_api_key = _get_tts_api(session, str(student_id))
            unsplash_key = _get_unsplash_api(session, str(student_id))
            generator = VideoPresentationGenerator(
                api_key=api_info.get("api_key") if api_info else None,
                base_url=api_info.get("base_url") if api_info else None,
                model=api_info.get("model") if api_info else None,
                tts_api_key=tts_api_key,
                unsplash_access_key=unsplash_key,
            )

            # 1. 生成章节数据
            task.progress_message = "正在生成章节内容..."
            task.progress_pct = "20%"
            session.commit()

            chapters_data = await generator.generate_chapters(
                task.script_content or "",
                task.outline_content or "",
                task.knowledge_points or [],
            )
            if not chapters_data:
                task.status = "failed"
                task.error_message = "章节内容生成失败"
                session.commit()
                return

            task.chapters_data = chapters_data
            task.progress_message = "正在生成演示页面..."
            task.progress_pct = "50%"
            session.commit()

            # 2. 生成 HTML 演示页面
            kp_text = "、".join(task.knowledge_points or [])
            title = f"{kp_text} 视频讲解"

            video_dir = os.path.join(VIDEO_DIR, str(task_id))
            os.makedirs(video_dir, exist_ok=True)

            html_path = os.path.join(video_dir, "presentation.html")
            await generator.build_presentation_html_async(title, chapters_data.get("chapters", []), html_path)

            task.progress_message = "演示页面已生成"
            task.progress_pct = "70%"
            session.commit()

            # 3. 尝试生成 TTS 音频
            audio_count = 0
            chapters = chapters_data.get("chapters", [])
            for ch in chapters:
                for step_idx, step in enumerate(ch.get("steps", [])):
                    narration = step.get("narration", "")
                    if not narration:
                        continue
                    audio_path = os.path.join(video_dir, f"step_{audio_count}.wav")
                    success = await generator.generate_audio_for_step(narration, audio_path)
                    if success:
                        step["audio_file"] = f"step_{audio_count}.wav"
                        audio_count += 1

            task.progress_message = "内容生成完成"
            task.progress_pct = "90%"
            session.commit()

            # 4. 保存为 KnowledgeResource
            content_data = {
                "type": "video_presentation",
                "title": title,
                "script": task.script_content,
                "outline": task.outline_content,
                "chapters": chapters_data.get("chapters", []),
                "html_file": "presentation.html",
                "total_steps": sum(len(ch.get("steps", [])) + 1 for ch in chapters),  # +1 for chapter titles
                "has_audio": audio_count > 0,
            }

            # 保存视频讲解（含完整演示数据）
            video_resource = KnowledgeResource(
                user_id=student_id,
                title=title,
                resource_type="video",
                content=json.dumps(content_data, ensure_ascii=False),
                knowledge_points=task.knowledge_points or [],
                source="manual",
                tags=["视频"],
            )
            session.add(video_resource)
            session.flush()

            # 同时保存视频脚本（仅脚本文本），用于"视频脚本"Tab
            if task.script_content:
                script_resource = KnowledgeResource(
                    user_id=student_id,
                    title=f"{kp_text} 视频脚本",
                    resource_type="video_script",
                    content=task.script_content,
                    knowledge_points=task.knowledge_points or [],
                    source="manual",
                    tags=["视频脚本"],
                )
                session.add(script_resource)
                session.flush()

            # 更新 task
            task.status = "completed"
            task.resource_id = video_resource.id
            task.progress_message = "视频已生成完成"
            task.progress_pct = "100%"
            session.commit()

            logger.info(f"视频生成完成: task={task_id}, resource={resource.id}")
        finally:
            session.close()
    except Exception as e:
        logger.error(f"视频生成失败: {e}", exc_info=True)
        try:
            from app.db.database import SessionLocal
            session = SessionLocal()
            task = session.query(VideoGenTask).filter(VideoGenTask.id == task_id).first()
            if task:
                task.status = "failed"
                task.error_message = str(e)[:200]
                session.commit()
            session.close()
        except Exception:
            pass


@router.delete("/video-gen/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_video_task(
    task_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """删除视频生成任务"""
    task = db.query(VideoGenTask).filter(
        VideoGenTask.id == task_id,
        VideoGenTask.user_id == current_user.student_id,
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    db.delete(task)
    db.commit()


@router.get("/video-gen/tasks", response_model=List[VideoGenStatusResponse])
async def list_video_tasks(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """列出当前用户的所有视频生成任务"""
    tasks = (
        db.query(VideoGenTask)
        .filter(VideoGenTask.user_id == current_user.student_id)
        .order_by(desc(VideoGenTask.created_at))
        .limit(20)
        .all()
    )
    return [
        VideoGenStatusResponse(
            task_id=str(t.id),
            status=t.status,
            progress_message=t.progress_message,
            progress_pct=t.progress_pct,
            script_content=t.script_content if t.status in ("preview", "completed") else None,
            outline_content=t.outline_content if t.status in ("preview", "completed") else None,
            resource_id=str(t.resource_id) if t.resource_id else None,
            error_message=t.error_message,
            knowledge_points=t.knowledge_points,
            created_at=t.created_at.isoformat() if t.created_at else None,
        )
        for t in tasks
    ]


@router.get("/video-gen/{task_id}", response_model=VideoGenStatusResponse)
async def get_video_gen_status(
    task_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """轮询视频生成任务状态"""
    task = db.query(VideoGenTask).filter(
        VideoGenTask.id == task_id,
        VideoGenTask.user_id == current_user.student_id,
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    return VideoGenStatusResponse(
        task_id=str(task.id),
        status=task.status,
        progress_message=task.progress_message,
        progress_pct=task.progress_pct,
        script_content=task.script_content if task.status in ("preview", "completed") else None,
        outline_content=task.outline_content if task.status in ("preview", "completed") else None,
        resource_id=str(task.resource_id) if task.resource_id else None,
        error_message=task.error_message,
        knowledge_points=task.knowledge_points,
        created_at=task.created_at.isoformat() if task.created_at else None,
    )


async def _inject_image_urls(content_data: dict, current_user, db: Session):
    """为视频内容的每个 step 注入图片 URL（完全异步，并行搜索，不阻塞事件循环）

    Unsplash API 目前全面返回 410 Gone，所以先尝试探针验证，
    无效则全部用 placehold.co 占位图（纯字符串构造，无任何网络请求）。

    关键设计：
    1. 异步 httpx 调用——不阻塞事件循环，其他 API 正常响应
    2. asyncio.gather 并行搜索——所有 step 同时查询，总耗时 ≈ 最慢单个请求
    3. 探针结果缓存——首次探测后 5 分钟内不再重复等待 Unsplash
    """
    from app.crud.api_settings import api_settings_crud
    from app.services.unsplash_service import UnsplashService
    import urllib.parse
    import httpx
    import asyncio

    user_id = str(current_user.student_id)
    setting = api_settings_crud.get_setting_value(db, user_id, "unsplash")
    access_key = setting.get("api_key") if setting else None

    # ── 检查缓存的探针结果 ──
    service = None
    now = time_module.time()
    cached = _unsplash_cache.get(user_id)
    if cached is not None and (now - cached[1]) < _UNSPLASH_CACHE_TTL:
        if cached[0] and access_key:
            service = UnsplashService(access_key=access_key)
    else:
        # ── 异步探针：并发测试英文和中文搜索，判断 API 是否真实可用 ──
        if access_key:
            try:
                async with httpx.AsyncClient(timeout=5) as client:
                    t1 = client.get(
                        "https://api.unsplash.com/search/photos?query=test&per_page=1",
                        headers={"Authorization": f"Client-ID {access_key}", "Accept-Version": "v1"},
                    )
                    t2 = client.get(
                        "https://api.unsplash.com/search/photos?query=%E6%B5%8B%E8%AF%95&per_page=1",
                        headers={"Authorization": f"Client-ID {access_key}", "Accept-Version": "v1"},
                    )
                    r1, r2 = await asyncio.gather(t1, t2)
                # 两个探针都成功并且结果非空才启用
                if r1.is_success and r2.is_success:
                    d1 = r1.json()
                    d2 = r2.json()
                    available = (d1.get("total", 0) > 0 or d2.get("total", 0) > 0)
                    if available:
                        service = UnsplashService(access_key=access_key)
                    else:
                        logger.warning("Unsplash API 搜索无结果，使用占位图")
                else:
                    logger.warning(f"Unsplash API 不可用 (HTTP {r1.status_code}/{r2.status_code})，使用占位图")
                    available = False
                # 缓存探针结果（无论成功与否）
                _unsplash_cache[user_id] = (available, now)
            except Exception as e:
                logger.warning(f"Unsplash API 连接失败 ({e})，使用占位图")
                _unsplash_cache[user_id] = (False, now)
        else:
            # 没有 API Key，缓存为不可用（无需重复查询数据库）
            _unsplash_cache[user_id] = (False, now)

    title = content_data.get("title", "")
    topic_query = title.replace(" ", ",")

    def _placeholder(query: str, w: int, h: int) -> str:
        """纯本地构造占位图 URL，无任何网络请求"""
        return f"https://placehold.co/{w}x{h}/1a1a2e/ffffff?text={urllib.parse.quote(query[:20])}"

    async def _resolve(query: str, w: int, h: int) -> str:
        if service and query:
            try:
                results = await service.search_photos(query, per_page=1, orientation="landscape")
                if results:
                    return f"{results[0]['url_raw']}&w={w}&h={h}&fit=crop"
            except Exception:
                pass
        return _placeholder(query, w, h)

    # ── 收集所有搜索任务 → 并行执行 ──
    # step_fields: list of (ci, si, query, w, h, field_key)
    step_fields: list[tuple] = []
    for ci, ch in enumerate(content_data.get("chapters", [])):
        ch_keywords = ch.get("title", "").lower().replace(" ", ",")
        for si, step in enumerate(ch.get("steps", [])):
            img_query = step.get("image_query", "") or ch_keywords or topic_query
            if "bg_image" not in step:
                step_fields.append((ci, si, img_query, 1920, 1080, "bg_image"))
            if step.get("visual_type") == "image" and "image_url" not in step:
                step_fields.append((ci, si, img_query, 800, 450, "image_url"))

    if service:
        # 有可用 Unsplash 时并行搜索
        results = await asyncio.gather(*[
            _resolve(q, w, h) for _, _, q, w, h, _ in step_fields
        ])
        for (ci, si, _, _, _, field), url in zip(step_fields, results):
            content_data["chapters"][ci]["steps"][si][field] = url
    else:
        # 无 Unsplash 时纯本地构造，无需任何网络请求
        for ci, si, q, w, h, field in step_fields:
            content_data["chapters"][ci]["steps"][si][field] = _placeholder(q, w, h)


@router.get("/{resource_id}/video-play")
async def play_video_resource(
    resource_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """播放视频资源——返回 HTML 演示页面内容"""
    resource = db.query(KnowledgeResource).filter(
        KnowledgeResource.id == resource_id,
        (KnowledgeResource.user_id == current_user.student_id) |
        (KnowledgeResource.is_public == True),
    ).first()
    if not resource:
        raise HTTPException(status_code=404, detail="资源不存在")
    if resource.resource_type != "video":
        raise HTTPException(status_code=400, detail="该资源不是视频类型")

    try:
        content_data = json.loads(resource.content)
    except (json.JSONDecodeError, TypeError):
        raise HTTPException(status_code=500, detail="视频数据解析失败")

    # 转换音频文件路径为完整 URL（供前端播放）
    api_prefix = app_settings.API_V1_STR
    task = db.query(VideoGenTask).filter(
        VideoGenTask.resource_id == resource_id
    ).first()
    if task:
        for ch in content_data.get("chapters", []):
            for step in ch.get("steps", []):
                if step.get("audio_file"):
                    step["audio_url"] = f"{api_prefix}/video-files/{task.id}/{step['audio_file']}"

    # 为每个 step 注入 Unsplash 图片 URL（异步非阻塞）
    await _inject_image_urls(content_data, current_user, db)

    return {"html": content_data}

