"""学习路径 V2 API — 基于思维导图的个性化学习系统

- GET  /path/current                    获取学习路径思维导图 Markdown
- GET  /path/agent/recommend            获取 Agent 推荐列表
- POST /path/agent/accept               接受 Agent 建议
- POST /path/agent/reject               拒绝 Agent 建议
- GET  /path/knowledge/{point_id}       获取知识点详情
- POST /path/knowledge/{point_id}/record-study  记录知识点了解
- GET  /path/history                    获取路径调整历史
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime
import logging

from sqlalchemy.orm import Session
from app.db.database import get_db
from app.api.dependencies import CurrentUser, get_current_user
from app.models.question_bank import (
    KnowledgePoint, KnowledgeDomain, Subject,
    KnowledgePointRecord, PathHistory,
)
from app.schemas.question_bank import (
    KnowledgePointRecordResponse, PathNodeStatus,
    LearningPathMarkdownResponse, PathHistoryItem, PathHistoryResponse,
    AgentRecommendation, AgentRecommendationListResponse,
)
from app.services.path_generator import generate_markdown, build_summary, generate_empty_path
from app.services.mastery_calculator import calculate_mastery
from app.services.learning_agent import LearningAgent
from app.services.path_planner import PathPlanner
from app.db.neo4j import get_neo4j
from app.schemas.question_bank import DagData, DagNode, DagEdge

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/path", tags=["Learning Path V2"])


class RecordStudyRequest(BaseModel):
    study_duration_seconds: int = 30  # 浏览时长
    action: str = "mark"  # "mark" or "unmark"


class AgentActionRequest(BaseModel):
    recommendation_type: str
    point_id: Optional[str] = None
    action: str = "accept"  # accept / reject


class PathHistoryCreate(BaseModel):
    snapshot_data: dict
    agent_reason: Optional[str] = None


@router.get("/current", response_model=LearningPathMarkdownResponse)
async def get_current_path(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取学习路径思维导图 Markdown + 节点状态列表"""
    user_id = str(current_user.student_id)
    subjects = (
        db.query(Subject)
        .order_by(Subject.sort_order)
        .all()
    )

    # 获取所有知识点记录
    records = (
        db.query(KnowledgePointRecord)
        .filter(KnowledgePointRecord.user_id == user_id)
        .all()
    )
    records_map = {str(r.point_id): r for r in records}

    # 构建困难点集合（连续错误 >= 3 且掌握度 < 60）
    difficult_points = set()
    for r in records:
        if r.consecutive_errors >= 3 and r.mastery_score < 60:
            difficult_points.add(str(r.point_id))

    # 构建带层级的数据结构
    subject_data = []
    for subj in subjects:
        domains = (
            db.query(KnowledgeDomain)
            .filter(KnowledgeDomain.subject_id == subj.id)
            .order_by(KnowledgeDomain.sort_order)
            .all()
        )
        domain_data = []
        for dom in domains:
            points = (
                db.query(KnowledgePoint)
                .filter(KnowledgePoint.domain_id == dom.id)
                .order_by(KnowledgePoint.sort_order)
                .all()
            )
            point_data = []
            for pt in points:
                point_data.append({
                    "id": pt.id,
                    "name": pt.name,
                    "difficulty": pt.difficulty,
                    "sort_order": pt.sort_order,
                })
            domain_data.append({
                "name": dom.name,
                "id": dom.id,
                "knowledge_points": point_data,
            })
        subject_data.append({
            "name": subj.name,
            "id": subj.id,
            "domains": domain_data,
        })

    # 生成 Markdown
    if not subject_data:
        markdown = generate_empty_path()
        return LearningPathMarkdownResponse(
            markdown=markdown,
            nodes=[],
            summary={"total": 0, "mastered": 0, "learning": 0, "not_started": 0, "reviewing": 0, "difficult": 0},
        )

    markdown = generate_markdown(subject_data, {
        str(r.point_id): {
            "mastery_score": r.mastery_score,
            "status": r.status,
            "consecutive_errors": r.consecutive_errors,
        }
        for r in records
    }, difficult_points)

    # 构建节点状态列表
    nodes = []
    for subj in subject_data:
        for dom in subj["domains"]:
            for pt in dom["knowledge_points"]:
                pid = str(pt["id"])
                record = records_map.get(pid)
                nodes.append(PathNodeStatus(
                    point_id=pid,
                    point_name=pt["name"],
                    domain_name=dom["name"],
                    mastery_score=record.mastery_score if record else 0,
                    status=record.status if record else "not_started",
                    is_difficult=pid in difficult_points,
                    needs_review=(record.status == "reviewing") if record else False,
                ))

    summary = build_summary(subject_data, {
        str(r.point_id): {
            "mastery_score": r.mastery_score,
            "status": r.status,
        }
        for r in records
    }, difficult_points)

    # 获取 DAG 图数据（Neo4j 路径规划）
    dag_data = DagData()
    try:
        neo4j = get_neo4j()
        if neo4j.verify_connectivity():
            planner = PathPlanner(neo4j)
            plan_result = await planner.plan(user_id)
            if plan_result.get("nodes"):
                dag_data = DagData(
                    nodes=[
                        DagNode(
                            id=n["id"],
                            point_id=n["id"],
                            label=n["data"]["label"],
                            progress=n["data"].get("progress", "not_started"),
                            mastery_score=n["data"].get("score") or 0,
                            is_weak=n["data"].get("is_weak", False),
                            domain=n["data"].get("domain", ""),
                            subject=n["data"].get("subject", ""),
                        )
                        for n in plan_result["nodes"]
                    ],
                    edges=[
                        DagEdge(
                            id=e["id"],
                            source=e["source"],
                            target=e["target"],
                            label=e.get("label", ""),
                            type="PREREQUISITE" if "前置" in e.get("label", "") else "RELATED_TO",
                            animated=e.get("animated", False),
                        )
                        for e in plan_result["edges"]
                    ],
                    metadata=plan_result.get("metadata", {}),
                )
    except Exception as e:
        logger.warning(f"获取 DAG 图数据失败（降级）: {e}")

    return LearningPathMarkdownResponse(
        markdown=markdown,
        nodes=nodes,
        summary=summary,
        dag_data=dag_data,
    )


@router.get("/agent/recommend", response_model=AgentRecommendationListResponse)
async def get_agent_recommendations(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
    subject_id: Optional[str] = Query(None, description="可选：按学科过滤推荐"),
):
    """获取 Agent 推荐列表"""
    user_id = str(current_user.student_id)
    agent = LearningAgent(db)
    recs = agent.get_recommendations(user_id, subject_id=subject_id)
    return AgentRecommendationListResponse(
        recommendations=recs,
        total=len(recs),
    )


@router.post("/agent/accept")
async def accept_recommendation(
    body: AgentActionRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """接受 Agent 建议（记录到路径历史）"""
    user_id = current_user.student_id
    if body.point_id:
        record = (
            db.query(KnowledgePointRecord)
            .filter(
                KnowledgePointRecord.user_id == user_id,
                KnowledgePointRecord.point_id == body.point_id,
            )
            .first()
        )
        if record and record.status == "not_started":
            record.status = "learning"

    # 记录到路径历史
    history = PathHistory(
        user_id=user_id,
        snapshot_data={
            "action": "accept",
            "recommendation_type": body.recommendation_type,
            "point_id": body.point_id,
        },
        agent_reason=f"用户接受了 {body.recommendation_type} 建议",
    )
    db.add(history)
    db.commit()

    return {"message": "建议已接受", "success": True}


@router.post("/agent/reject")
async def reject_recommendation(
    body: AgentActionRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """拒绝 Agent 建议（记录到路径历史）"""
    user_id = current_user.student_id

    history = PathHistory(
        user_id=user_id,
        snapshot_data={
            "action": "reject",
            "recommendation_type": body.recommendation_type,
            "point_id": body.point_id,
        },
        agent_reason=f"用户拒绝了 {body.recommendation_type} 建议",
    )
    db.add(history)
    db.commit()

    return {"message": "建议已忽略，将重新规划", "success": True}


@router.get("/knowledge/{point_id}", response_model=KnowledgePointRecordResponse)
async def get_knowledge_detail(
    point_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取单个知识点的学习详情"""
    user_id = current_user.student_id
    pid = UUID(point_id) if len(point_id) == 36 else point_id

    record = (
        db.query(KnowledgePointRecord)
        .filter(
            KnowledgePointRecord.user_id == user_id,
            KnowledgePointRecord.point_id == pid,
        )
        .first()
    )

    point = db.query(KnowledgePoint).filter(KnowledgePoint.id == pid).first()
    if not point:
        raise HTTPException(status_code=404, detail="知识点不存在")

    domain_name = ""
    if point.domain:
        domain_name = point.domain.name

    subject_name = ""
    if point.domain and point.domain.subject:
        subject_name = point.domain.subject.name

    if record:
        return KnowledgePointRecordResponse(
            point_id=str(point.id),
            point_name=point.name,
            domain_name=domain_name,
            subject_name=subject_name,
            mastery_score=record.mastery_score,
            recent_accuracy=record.recent_accuracy,
            consecutive_errors=record.consecutive_errors,
            total_practiced=record.total_practiced,
            total_correct=record.total_correct,
            total_time_spent_seconds=record.total_time_spent_seconds,
            study_count=record.study_count,
            last_study_at=record.last_study_at,
            last_practice_at=record.last_practice_at,
            next_review_at=record.next_review_at,
            status=record.status,
        )

    return KnowledgePointRecordResponse(
        point_id=str(point.id),
        point_name=point.name,
        domain_name=domain_name,
        subject_name=subject_name,
        status="not_started",
    )


@router.post("/knowledge/{point_id}/record-study")
async def record_knowledge_study(
    point_id: str,
    body: RecordStudyRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """记录"知识点了解"行为

    用户点击浏览知识点内容超过30秒时调用。
    """
    user_id = current_user.student_id
    pid = UUID(point_id) if len(point_id) == 36 else point_id

    point = db.query(KnowledgePoint).filter(KnowledgePoint.id == pid).first()
    if not point:
        raise HTTPException(status_code=404, detail="知识点不存在")

    record = (
        db.query(KnowledgePointRecord)
        .filter(
            KnowledgePointRecord.user_id == user_id,
            KnowledgePointRecord.point_id == pid,
        )
        .first()
    )

    if body.action == "unmark":
        if record:
            record.study_count = max(0, (record.study_count or 0) - 1)
            record.last_study_at = None if record.study_count == 0 else record.last_study_at
            if record.study_count == 0:
                record.status = "not_started"
            record.mastery_score = 0
    else:
        if not record:
            record = KnowledgePointRecord(
                user_id=user_id,
                point_id=pid,
                point_name=point.name,
                study_count=1,
                mastery_score=5,
                last_study_at=datetime.utcnow(),
                status="learning",
            )
            db.add(record)
        else:
            record.study_count = (record.study_count or 0) + 1
            record.last_study_at = datetime.utcnow()
            if record.status == "not_started":
                record.status = "learning"

    db.commit()

    return {
        "message": "已记录学习行为" if body.action == "mark" else "已取消学习标记",
        "study_count": record.study_count if record else 0,
        "status": record.status if record else "not_started",
    }


@router.get("/history", response_model=PathHistoryResponse)
async def get_path_history(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取路径调整历史"""
    user_id = current_user.student_id
    items = (
        db.query(PathHistory)
        .filter(PathHistory.user_id == user_id)
        .order_by(PathHistory.created_at.desc())
        .limit(50)
        .all()
    )

    return PathHistoryResponse(
        items=[
            PathHistoryItem(
                id=str(h.id),
                agent_reason=h.agent_reason,
                snapshot_data=h.snapshot_data,
                created_at=h.created_at,
            )
            for h in items
        ],
        total=len(items),
    )
