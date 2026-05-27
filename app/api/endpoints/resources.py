"""个性化学习资源 API

资源类型：思维导图（mind_map），后续可扩展
触发方式：手动生成、AI Chat 盲区检测自动生成、题库答错自动生成

- GET    /resources                列出当前用户所有资源
- GET    /resources/{id}           获取单个资源
- POST   /resources/generate       手动生成思维导图
- PUT    /resources/{id}           更新资源
- DELETE /resources/{id}           删除资源
- GET    /resources/knowledge-points  获取有资源的知识点列表（按知识点分组）
- POST   /resources/auto-generate  自动生成（由 Chat/题库后台触发）
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime
import logging

from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.db.database import get_db
from app.api.dependencies import get_current_active_user
from app.core.config import settings as app_settings
from app.models.resource import KnowledgeResource
from app.services.resource_generator import ResourceGenerator

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/resources", tags=["Learning Resources"])


# ── Pydantic Schemas ──

class ResourceOut(BaseModel):
    id: str
    title: str
    resource_type: str
    knowledge_points: List[str]
    source: Optional[str] = None
    source_ref: Optional[str] = None
    tags: List[str] = []
    created_at: str
    updated_at: str
    content: Optional[str] = None  # 默认不返回，仅详情接口返回

    class Config:
        from_attributes = True


class ResourceListItem(BaseModel):
    id: str
    title: str
    resource_type: str
    knowledge_points: List[str]
    source: Optional[str] = None
    tags: List[str] = []
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class ResourceListResponse(BaseModel):
    resources: List[ResourceListItem]
    total: int


class KnowledgePointGroup(BaseModel):
    name: str
    resource_count: int
    resources: List[ResourceListItem]


class KnowledgePointsResponse(BaseModel):
    knowledge_points: List[KnowledgePointGroup]
    total: int


class GenerateRequest(BaseModel):
    knowledge_points: List[str]
    title: Optional[str] = None


class GenerateResponse(BaseModel):
    id: str
    title: str
    content: str
    knowledge_points: List[str]


class UpdateRequest(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    knowledge_points: Optional[List[str]] = None


class AutoGenerateRequest(BaseModel):
    knowledge_points: List[str]
    source: str = "chat_gap"  # chat_gap | wrong_answer
    source_ref: Optional[str] = None


class AutoGenerateResponse(BaseModel):
    generated: List[dict]  # [{knowledge_point, resource_id, title}]
    skipped: List[str]     # 已有资源跳过的知识点


# ── Helpers ──

def _resource_to_list_item(r: KnowledgeResource) -> ResourceListItem:
    return ResourceListItem(
        id=str(r.id),
        title=r.title,
        resource_type=r.resource_type,
        knowledge_points=list(r.knowledge_points or []),
        source=r.source,
        tags=list(r.tags or []),
        created_at=r.created_at.isoformat() if r.created_at else "",
        updated_at=r.updated_at.isoformat() if r.updated_at else "",
    )


def _resource_to_out(r: KnowledgeResource) -> ResourceOut:
    return ResourceOut(
        id=str(r.id),
        title=r.title,
        resource_type=r.resource_type,
        knowledge_points=list(r.knowledge_points or []),
        source=r.source,
        source_ref=r.source_ref,
        tags=list(r.tags or []),
        created_at=r.created_at.isoformat() if r.created_at else "",
        updated_at=r.updated_at.isoformat() if r.updated_at else "",
        content=r.content,
    )


PROVIDER_CONFIG = {
    "qwen": {
        "default_base_url": app_settings.QWEN_BASE_URL,
        "default_model": "qwen-turbo-latest",
    },
    "deepseek": {
        "default_base_url": app_settings.DEEPSEEK_BASE_URL,
        "default_model": "deepseek-chat",
    },
}

def _get_user_api(db: Session, student_id: str) -> Optional[dict]:
    """获取用户配置的 LLM API Key（含 provider 和 model 信息）

    用户未设置 base_url 时自动填充系统默认值，
    确保请求始终发到正确的 API 端点。
    """
    from app.crud.api_settings import api_settings_crud
    for provider in ["qwen", "deepseek"]:
        api = api_settings_crud.get_setting_value(db, student_id, provider)
        if api:
            cfg = PROVIDER_CONFIG.get(provider, {})
            return {
                "api_key": api.get("api_key"),
                "base_url": api.get("base_url") or cfg.get("default_base_url"),
                "provider": provider,
                "model": cfg.get("default_model", "qwen-turbo-latest"),
            }
    return None


async def _generate_and_save(
    db: Session, student_id: UUID, kp_name: str,
    source: str, source_ref: Optional[str] = None,
    api_info: Optional[dict] = None,
) -> Optional[KnowledgeResource]:
    """生成思维导图并保存到数据库"""
    generator = ResourceGenerator(
        api_key=api_info.get("api_key") if api_info else None,
        base_url=api_info.get("base_url") if api_info else None,
        model=api_info.get("model") if api_info else None,
    )
    content = await generator.generate_mindmap([kp_name])
    if not content:
        return None

    resource = KnowledgeResource(
        user_id=student_id,
        title=f"{kp_name} 思维导图",
        resource_type="mind_map",
        content=content,
        knowledge_points=[kp_name],
        source=source,
        source_ref=source_ref,
    )
    db.add(resource)
    db.commit()
    db.refresh(resource)
    return resource


# ── Endpoints ──

@router.get("", response_model=ResourceListResponse)
async def list_resources(
    knowledge_point: Optional[str] = None,
    resource_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """列出当前用户的所有资源，可按知识点过滤"""
    query = db.query(KnowledgeResource).filter(
        KnowledgeResource.user_id == current_user.student_id
    )
    if knowledge_point:
        query = query.filter(
            KnowledgeResource.knowledge_points.op('?')(knowledge_point)
        )
    if resource_type:
        query = query.filter(KnowledgeResource.resource_type == resource_type)

    total = query.count()
    resources = query.order_by(desc(KnowledgeResource.updated_at)).all()

    return ResourceListResponse(
        resources=[_resource_to_list_item(r) for r in resources],
        total=total,
    )


@router.get("/knowledge-points", response_model=KnowledgePointsResponse)
async def list_knowledge_points(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """按知识点分组列出资源"""
    resources = (
        db.query(KnowledgeResource)
        .filter(KnowledgeResource.user_id == current_user.student_id)
        .order_by(desc(KnowledgeResource.updated_at))
        .all()
    )

    # 按知识点分组
    groups: dict[str, dict] = {}
    for r in resources:
        kps = list(r.knowledge_points or [])
        if not kps:
            kps = ["未分类"]
        for kp in kps:
            if kp not in groups:
                groups[kp] = {"name": kp, "resources": []}
            groups[kp]["resources"].append(_resource_to_list_item(r))

    result = []
    for name, group in groups.items():
        result.append(KnowledgePointGroup(
            name=name,
            resource_count=len(group["resources"]),
            resources=group["resources"],
        ))

    # 按知识点名称排序
    result.sort(key=lambda x: x.name)

    return KnowledgePointsResponse(knowledge_points=result, total=len(result))


@router.get("/{resource_id}", response_model=ResourceOut)
async def get_resource(
    resource_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """获取单个资源详情（含 content）"""
    resource = db.query(KnowledgeResource).filter(
        KnowledgeResource.id == resource_id,
        KnowledgeResource.user_id == current_user.student_id,
    ).first()
    if not resource:
        raise HTTPException(status_code=404, detail="资源不存在")
    return _resource_to_out(resource)


@router.post("/generate", response_model=GenerateResponse)
async def generate_resource(
    req: GenerateRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """手动生成思维导图"""
    if not req.knowledge_points:
        raise HTTPException(status_code=400, detail="请指定至少一个知识点")

    # 获取用户 API Key（含 provider 和 model）
    api_info = _get_user_api(db, str(current_user.student_id))

    kp_text = "、".join(req.knowledge_points)
    generator = ResourceGenerator(
        api_key=api_info.get("api_key") if api_info else None,
        base_url=api_info.get("base_url") if api_info else None,
        model=api_info.get("model") if api_info else None,
    )
    content = await generator.generate_mindmap(req.knowledge_points)

    if not content:
        raise HTTPException(
            status_code=502,
            detail="思维导图生成失败，请检查 API 配置是否可用",
        )

    title = req.title or f"{kp_text} 思维导图"
    resource = KnowledgeResource(
        user_id=current_user.student_id,
        title=title,
        resource_type="mind_map",
        content=content,
        knowledge_points=req.knowledge_points,
        source="manual",
    )
    db.add(resource)
    db.commit()
    db.refresh(resource)

    return GenerateResponse(
        id=str(resource.id),
        title=resource.title,
        content=resource.content,
        knowledge_points=list(resource.knowledge_points or []),
    )


@router.put("/{resource_id}", response_model=ResourceOut)
async def update_resource(
    resource_id: UUID,
    req: UpdateRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """更新资源（标题、内容、知识点标签）"""
    resource = db.query(KnowledgeResource).filter(
        KnowledgeResource.id == resource_id,
        KnowledgeResource.user_id == current_user.student_id,
    ).first()
    if not resource:
        raise HTTPException(status_code=404, detail="资源不存在")

    if req.title is not None:
        resource.title = req.title
    if req.content is not None:
        resource.content = req.content
    if req.knowledge_points is not None:
        resource.knowledge_points = req.knowledge_points

    db.commit()
    db.refresh(resource)
    return _resource_to_out(resource)


@router.delete("/{resource_id}")
async def delete_resource(
    resource_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """删除资源"""
    resource = db.query(KnowledgeResource).filter(
        KnowledgeResource.id == resource_id,
        KnowledgeResource.user_id == current_user.student_id,
    ).first()
    if not resource:
        raise HTTPException(status_code=404, detail="资源不存在")

    db.delete(resource)
    db.commit()
    return {"detail": "删除成功"}


@router.post("/auto-generate", response_model=AutoGenerateResponse)
async def auto_generate_resources(
    req: AutoGenerateRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """自动生成资源（由 Chat 盲区检测或题库答错后台触发）

    不会重复生成已有资源的知识点。
    """
    if not req.knowledge_points:
        raise HTTPException(status_code=400, detail="请指定至少一个知识点")

    student_id = current_user.student_id
    generated = []
    skipped = []

    # 获取用户 API Key
    api_info = _get_user_api(db, str(current_user.student_id))

    for kp in req.knowledge_points:
        # 检查是否已有资源关联该知识点
        existing = (
            db.query(KnowledgeResource)
            .filter(
                KnowledgeResource.user_id == student_id,
                KnowledgeResource.knowledge_points.op('?')(kp),
            )
            .first()
        )
        if existing:
            skipped.append(kp)
            continue

        resource = await _generate_and_save(
            db, student_id, kp, req.source, req.source_ref, api_info,
        )
        if resource:
            generated.append({
                "knowledge_point": kp,
                "resource_id": str(resource.id),
                "title": resource.title,
            })
        else:
            skipped.append(kp)

    return AutoGenerateResponse(generated=generated, skipped=skipped)


# ── Unsplash 图片搜索（供前端使用） ──

class UnsplashSearchRequest(BaseModel):
    query: str
    per_page: int = 10
    orientation: str = "landscape"


class UnsplashImageOut(BaseModel):
    id: str
    description: str
    url_raw: str
    url_regular: str
    url_small: str
    url_thumb: str
    author: str
    width: int
    height: int


class UnsplashSearchResponse(BaseModel):
    images: List[UnsplashImageOut]
    total: int


@router.post("/unsplash-search", response_model=UnsplashSearchResponse)
async def search_unsplash_images(
    req: UnsplashSearchRequest,
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """搜索 Unsplash 高清图片

    使用当前用户的 Unsplash API 配置进行图片搜索。
    返回的图片可自由用于视频配图、页面背景等场景。
    """
    from app.crud.api_settings import api_settings_crud

    setting = api_settings_crud.get_setting_value(db, str(current_user.student_id), "unsplash")
    access_key = setting.get("api_key") if setting else None

    if not access_key:
        raise HTTPException(
            status_code=400,
            detail="Unsplash 图片服务未配置，请先在 API 设置中配置 Unsplash Access Key",
        )

    from app.services.unsplash_service import UnsplashService
    service = UnsplashService(access_key=access_key)
    results = await service.search_photos(req.query, req.per_page, req.orientation)

    return UnsplashSearchResponse(
        images=[
            UnsplashImageOut(
                id=img["id"],
                description=img["description"],
                url_raw=img["url_raw"],
                url_regular=img["url_regular"],
                url_small=img["url_small"],
                url_thumb=img["url_thumb"],
                author=img["author"],
                width=img["width"],
                height=img["height"],
            )
            for img in results
        ],
        total=len(results),
    )
