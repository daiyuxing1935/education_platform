"""个性化资源推送中心 API

- GET  /recommendations/personalized    获取个性化推荐资源列表（支持类型筛选）
- POST /recommendations/{id}/feedback   提交资源推荐反馈（有用/无用）
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime
import logging

from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.db.database import get_db
from app.api.dependencies import get_current_user, CurrentUser
from app.models.resource import KnowledgeResource, RecommendationFeedback
from app.models.question_bank import KnowledgeDomain, KnowledgePointRecord

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/recommendations", tags=["Recommendations"])


# ── Schemas ──

class RecommendationResourceOut(BaseModel):
    id: str
    title: str
    resource_type: str
    resource_type_label: str  # 中文类型标签
    knowledge_points: List[str]
    difficulty_level: Optional[int] = None  # 1-5 难度星级
    source: Optional[str] = None
    source_label: Optional[str] = None  # 中文来源标签
    tags: List[str] = []
    created_at: str
    mastery_score: Optional[float] = None  # 关联知识点的掌握度

    class Config:
        from_attributes = True


class PersonalizedResponse(BaseModel):
    resources: List[RecommendationResourceOut]
    total: int


class FeedbackRequest(BaseModel):
    useful: bool


class FeedbackResponse(BaseModel):
    success: bool
    message: str


# ── Helpers ──

RESOURCE_TYPE_LABELS: dict[str, str] = {
    "mind_map": "思维导图",
    "video": "视频",
    "video_script": "视频脚本",
    "document": "文档",
    "exercise": "题库练习",
    "code_case": "代码案例",
    "image_text": "图文讲解",
    "explanation": "知识讲解",
    "review_question": "复习题",
    "memory_card": "记忆卡片",
    "variation_exercise": "变式练习",
    "knowledge_comic": "知识漫画",
    "infographic": "信息图解",
    "summary_report": "总结报告",
    "flash_card": "闪卡",
}

SOURCE_LABELS: dict[str, str] = {
    "chat_gap": "AI对话生成",
    "wrong_answer": "答题推荐",
    "manual": "手动生成",
    "auto": "自动生成",
}


def _resource_to_out(
    r: KnowledgeResource,
    mastery_map: dict[str, float],
) -> RecommendationResourceOut:
    kps = list(r.knowledge_points or [])
    # 取掌握度最低的知识点分数
    scores = [mastery_map.get(kp, 0) for kp in kps]
    min_score = min(scores) if scores else None
    return RecommendationResourceOut(
        id=str(r.id),
        title=r.title,
        resource_type=r.resource_type,
        resource_type_label=RESOURCE_TYPE_LABELS.get(r.resource_type, r.resource_type),
        knowledge_points=kps,
        difficulty_level=r.difficulty_level,
        source=r.source,
        source_label=SOURCE_LABELS.get(r.source or "", r.source or ""),
        tags=list(r.tags or []),
        created_at=r.created_at.isoformat() if r.created_at else "",
        mastery_score=min_score,
    )


# ── Endpoints ──

@router.get("/personalized", response_model=PersonalizedResponse)
async def get_personalized_recommendations(
    resource_type: Optional[str] = Query(None, description="按资源类型筛选"),
    subject_id: Optional[str] = Query(None, description="按学科筛选"),
    page: int = Query(1, ge=1),
    page_size: int = Query(500, ge=1, le=500),
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取个性化推荐资源列表

    基于学生画像中的薄弱知识点（掌握度 < 60%）推荐关联资源。
    支持按资源类型、学科筛选，分页返回。

    注意：KnowledgeResource.knowledge_points 存储的是知识点名称（如"Python装饰器"），
    而非 UUID。因此需要先通过 KnowledgePoint 表做 name→id 映射。
    """
    user_id = str(current_user.student_id)

    # 1. 获取学生所有知识点掌握度记录 + 建立 point_id → (name, mastery_score) 映射
    from app.models.question_bank import KnowledgeDomain, KnowledgePoint
    kp_records = (
        db.query(KnowledgePointRecord)
        .filter(KnowledgePointRecord.user_id == user_id)
        .all()
    )
    # point_id → mastery_score
    mastery_by_id: dict[str, float] = {}
    weak_point_ids: list[str] = []
    for rec in kp_records:
        pid = str(rec.point_id)
        mastery_by_id[pid] = rec.mastery_score
        if rec.mastery_score < 60:
            weak_point_ids.append(pid)

    # 获取所有知识点（用于 name↔id 映射）
    all_kps = db.query(KnowledgePoint).all()
    kp_id_to_name: dict[str, str] = {str(k.id): k.name for k in all_kps}
    kp_name_to_id: dict[str, str] = {k.name: str(k.id) for k in all_kps}

    # 薄弱知识点名称列表
    weak_point_names: set[str] = set()
    for pid in weak_point_ids:
        name = kp_id_to_name.get(pid)
        if name:
            weak_point_names.add(name)

    # mastery_by_name: name → score
    mastery_by_name: dict[str, float] = {}
    for k in all_kps:
        sid = str(k.id)
        if sid in mastery_by_id:
            mastery_by_name[k.name] = mastery_by_id[sid]

    # 2. 构建查询（自己的资源 + 公开资源）
    query = db.query(KnowledgeResource).filter(
        (KnowledgeResource.user_id == user_id) |
        (KnowledgeResource.is_public == True)
    )

    # 按资源类型筛选
    if resource_type:
        query = query.filter(KnowledgeResource.resource_type == resource_type)

    # 按学科筛选：找出该学科下所有知识点名称
    if subject_id:
        domains = (
            db.query(KnowledgeDomain)
            .filter(KnowledgeDomain.subject_id == subject_id)
            .all()
        )
        domain_ids = [str(d.id) for d in domains]
        if domain_ids:
            subject_kps = (
                db.query(KnowledgePoint)
                .filter(KnowledgePoint.domain_id.in_(domain_ids))
                .all()
            )
            subject_kp_names = {k.name for k in subject_kps}
            if subject_kp_names:
                from sqlalchemy import or_
                conditions = [KnowledgeResource.knowledge_points.op('?')(name) for name in subject_kp_names]
                query = query.filter(or_(*conditions))

    # 3. 获取资源
    all_resources = query.order_by(desc(KnowledgeResource.updated_at)).all()

    # 4. 排序：薄弱知识点关联的优先，然后按掌握度升序
    def sort_key(r: KnowledgeResource):
        kps = list(r.knowledge_points or [])
        is_weak = any(kp in weak_point_names for kp in kps)
        scores = [mastery_by_name.get(kp, 100) for kp in kps]
        min_score = min(scores) if scores else 100
        return (0 if is_weak else 1, min_score)

    sorted_resources = sorted(all_resources, key=sort_key)

    # 5. 分页
    total = len(sorted_resources)
    start = (page - 1) * page_size
    page_items = sorted_resources[start:start + page_size]

    # 6. 构建响应（knowledge_points 已经是名称，直接使用）
    resources_out = []
    for r in page_items:
        out = _resource_to_out(r, mastery_by_name)
        resources_out.append(out)

    return PersonalizedResponse(resources=resources_out, total=total)


@router.post("/{resource_id}/feedback", response_model=FeedbackResponse)
async def submit_feedback(
    resource_id: str,
    req: FeedbackRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """提交资源推荐反馈（有用/无用）"""
    # 验证资源存在（自己的资源或公开资源）
    resource = db.query(KnowledgeResource).filter(
        KnowledgeResource.id == resource_id,
        (KnowledgeResource.user_id == current_user.student_id) |
        (KnowledgeResource.is_public == True),
    ).first()
    if not resource:
        raise HTTPException(status_code=404, detail="资源不存在")

    # 检查是否已提交过反馈
    existing = (
        db.query(RecommendationFeedback)
        .filter(
            RecommendationFeedback.user_id == current_user.student_id,
            RecommendationFeedback.resource_id == resource_id,
        )
        .first()
    )
    if existing:
        # 更新已有反馈
        existing.useful = req.useful
        existing.created_at = datetime.utcnow()
        db.commit()
        return FeedbackResponse(success=True, message="反馈已更新")
    else:
        # 新增反馈
        feedback = RecommendationFeedback(
            user_id=current_user.student_id,
            resource_id=resource_id,
            useful=req.useful,
        )
        db.add(feedback)
        db.commit()
        return FeedbackResponse(success=True, message="反馈已提交")
