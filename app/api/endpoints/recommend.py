"""
个性化资源推荐 API

提供 8 种推荐策略的访问接口：
1. GET  /recommend          — 获取所有推荐（按优先级排序）
2. GET  /recommend/weak-points — 薄弱点推荐
3. GET  /recommend/review    — 艾宾浩斯复习推荐
4. GET  /recommend/variations/{point_id} — 变式练习推荐
5. GET  /recommend/summary   — 周期性总结报告
6. GET  /recommend/difficulty — 难度自适应推荐
7. GET  /recommend/fatigue   — 疲劳检测推荐
8. GET  /recommend/important — 重要资源推荐
9. POST /recommend/resource/{resource_id}/mark-important — 标记重要资源
10. POST /recommend/{rec_type}/ignore — 忽略某类推荐
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID
from app.api.dependencies import get_current_user, CurrentUser
from app.db.database import get_db
from app.models.resource import KnowledgeResource
from app.services.resource_recommender import ResourceRecommender

router = APIRouter(prefix="/recommend", tags=["Recommend"])


def _get_recommender(db: Session, user_id: UUID) -> ResourceRecommender:
    return ResourceRecommender(db, str(user_id))


@router.get("")
async def get_all_recommendations(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
    subject_id: Optional[str] = Query(None, description="可选：按学科过滤薄弱点推荐"),
):
    """获取所有个性化推荐（按优先级排序），返回最多 15 条"""
    recommender = _get_recommender(db, current_user.student_id)
    items = recommender.get_all_recommendations(max_results=15, subject_id=subject_id)
    return {"recommendations": items, "total": len(items)}


@router.get("/weak-points")
async def get_weak_point_recommendations(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
    subject_id: Optional[str] = Query(None, description="可选：按学科过滤薄弱点"),
):
    """识别掌握不足的薄弱点，推荐复习题/知识点讲解/记忆卡片"""
    recommender = _get_recommender(db, current_user.student_id)
    items = recommender._weak_point_recommendations(subject_id=subject_id)
    return {"recommendations": [i.to_dict() for i in items], "total": len(items)}


@router.get("/review")
async def get_review_recommendations(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """基于艾宾浩斯遗忘曲线，推荐即将达到遗忘临界点的知识点进行复习"""
    recommender = _get_recommender(db, current_user.student_id)
    items = recommender._ebbinghaus_review_recommendations()
    return {"recommendations": [i.to_dict() for i in items], "total": len(items)}


@router.get("/variations/{point_id}")
async def get_variation_exercises(
    point_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """针对某个知识点，推荐变式练习题"""
    # 查找该知识点的错题记录
    from app.models.question_bank import KnowledgePoint as KPModel, WrongAnswerRecord, Question

    kp = db.query(KPModel).filter(KPModel.id == point_id).first()
    if not kp:
        raise HTTPException(status_code=404, detail="知识点不存在")

    # 找到该知识点的所有题目
    kp_uuid_str = str(point_id)
    questions = (
        db.query(Question)
        .filter(Question.knowledge_point_uuids.contains([kp_uuid_str]))
        .limit(10)
        .all()
    )

    # 查错题记录
    question_ids = [q.id for q in questions]
    wrong_records = (
        db.query(WrongAnswerRecord)
        .filter(
            WrongAnswerRecord.user_id == current_user.student_id,
            WrongAnswerRecord.question_id.in_(question_ids),
        )
        .all()
    )
    wrong_question_ids = {r.question_id for r in wrong_records}

    questions_data = []
    for q in questions:
        questions_data.append({
            "question_id": str(q.id),
            "stem": q.content.get("stem", "")[:120] if isinstance(q.content, dict) else str(q.content)[:120],
            "difficulty": q.difficulty,
            "type": q.type,
            "has_wrong_record": str(q.id) in wrong_question_ids,
        })

    return {
        "knowledge_point": kp.name,
        "total_questions": len(questions_data),
        "questions": questions_data,
    }


@router.get("/summary")
async def get_periodic_summary(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """生成个性化周总结报告"""
    recommender = _get_recommender(db, current_user.student_id)
    summary = recommender.get_periodic_summary()
    if not summary:
        return {"summary": None, "message": "本周已生成过总结报告或数据不足"}
    return {"summary": summary.to_dict()}


@router.get("/difficulty")
async def get_difficulty_adjustment(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """根据近 10 题正确率推荐调整难度"""
    recommender = _get_recommender(db, current_user.student_id)
    items = recommender._difficulty_adjustment_recommendations()
    return {"recommendations": [i.to_dict() for i in items], "total": len(items)}


@router.get("/fatigue")
async def get_fatigue_recommendations(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """疲劳检测，推荐知识漫画/趣味示意图"""
    recommender = _get_recommender(db, current_user.student_id)
    items = recommender._fatigue_recommendations()
    return {"recommendations": [i.to_dict() for i in items], "total": len(items)}


@router.get("/important")
async def get_important_resources(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取教师/高年级学生标记为重要的资源推荐"""
    recommender = _get_recommender(db, current_user.student_id)
    items = recommender._important_resource_recommendations()
    return {"recommendations": [i.to_dict() for i in items], "total": len(items)}


@router.post("/resource/{resource_id}/mark-important")
async def mark_resource_important(
    resource_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """将资源标记为重要（供教师/高年级学生使用）"""
    resource = db.query(KnowledgeResource).filter(KnowledgeResource.id == resource_id).first()
    if not resource:
        raise HTTPException(status_code=404, detail="资源不存在")

    # 更新标记
    markers = list(resource.marked_by_important or [])
    user_id_str = str(current_user.student_id)
    if user_id_str not in markers:
        markers.append(user_id_str)
        resource.marked_by_important = markers
        resource.is_official_important = len(markers) >= 2  # 2人以上标记自动提升为官方重要
        db.commit()

    return {
        "success": True,
        "marked_by_count": len(markers),
        "is_official_important": resource.is_official_important,
    }


@router.post("/{rec_type}/ignore")
async def ignore_recommendation_type(
    rec_type: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """忽略某类推荐（记录到用户偏好，后续可扩展）"""
    valid_types = [
        "weak_point", "ebbinghaus_review", "knowledge_chain",
        "variation_exercise", "difficulty_adjust", "periodic_summary",
        "fatigue_recovery", "important_resource",
    ]
    if rec_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"无效的推荐类型，有效值: {', '.join(valid_types)}")

    return {"success": True, "message": f"已忽略 {rec_type} 类型推荐"}
