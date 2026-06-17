"""Agent Scheduler — 学习路径调度决策引擎

周期性地（每完成一个知识点或每5道题）执行决策逻辑：
- 掌握度判断
- 困难点检测
- 疲劳检测
- 遗忘曲线复习推荐
- 跳过前置检测
"""

import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.models.question_bank import KnowledgePointRecord, KnowledgePoint, KnowledgeDomain
from app.services.mastery_calculator import calculate_mastery, detect_fatigue, needs_review
from app.schemas.question_bank import AgentRecommendation

logger = logging.getLogger(__name__)


class LearningAgent:
    """学习路径 Agent 调度器"""

    def __init__(self, db: Session):
        self.db = db

    def get_recommendations(
        self,
        user_id: str,
        current_point_id: Optional[str] = None,
        session_start: Optional[datetime] = None,
        session_questions: int = 0,
        session_correct: int = 0,
        fatigue_since: Optional[datetime] = None,
        subject_id: Optional[str] = None,
    ) -> List[AgentRecommendation]:
        """获取 Agent 推荐列表

        执行所有检测规则，按优先级排序返回推荐卡片。
        """
        recommendations: List[AgentRecommendation] = []

        # 获取该用户的所有知识点记录（可按学科过滤）
        query = self.db.query(KnowledgePointRecord).filter(KnowledgePointRecord.user_id == user_id)
        if subject_id:
            query = query.join(KnowledgePoint, KnowledgePointRecord.point_id == KnowledgePoint.id) \
                .join(KnowledgeDomain, KnowledgePoint.domain_id == KnowledgeDomain.id) \
                .filter(KnowledgeDomain.subject_id == subject_id)
        records = query.all()
        records_map = {str(r.point_id): r for r in records}

        # 1. 【高优先级】疲劳检测
        if self._check_fatigue(session_start, session_questions, session_correct):
            recommendations.append(AgentRecommendation(
                type="study_rest",
                title="建议休息一下",
                description="你已连续练习一段时间且正确率下降，建议休息5分钟或切换为知识点阅读模式",
                priority="high",
                action_label="去休息",
                action_url="",
            ))

        # 2. 【高优先级】当前知识点困难点检测
        if current_point_id:
            record = records_map.get(current_point_id)
            if record and record.consecutive_errors >= 3:
                recommendations.append(AgentRecommendation(
                    type="breakthrough",
                    title=f"「{record.point_name}」需要重点突破",
                    description=f"连续错了 {record.consecutive_errors} 题，建议先看讲解视频，再做同类题巩固",
                    priority="high",
                    related_point_id=str(record.point_id),
                    related_point_name=record.point_name,
                    action_label="去学习",
                    action_url=f"/banks?point={record.point_id}",
                ))

        # 3. 【高优先级】掌握度低于60%
        for record in records:
            if record.mastery_score < 60 and record.total_practiced > 0:
                mastery = calculate_mastery(
                    record.total_practiced, record.total_correct,
                    record.recent_accuracy, record.study_count,
                    record.consecutive_errors, record.last_practice_at,
                )
                if mastery < 60:
                    rec_type = "practice" if record.total_practiced >= 3 else "study"
                    label = "更多练习" if rec_type == "practice" else "重新学习"
                    recommendations.append(AgentRecommendation(
                        type=rec_type,
                        title=f"「{record.point_name}」掌握度仅 {mastery}%",
                        description=f"建议{label}，当前知识点还需巩固",
                        priority="high" if mastery < 40 else "normal",
                        related_point_id=str(record.point_id),
                        related_point_name=record.point_name,
                        action_label=label,
                        action_url=f"/banks?point={record.point_id}",
                    ))

        # 4. 【中优先级】待复习检测（艾宾浩斯）
        for record in records:
            if record.status == "mastered" or record.status == "reviewing":
                if record.last_practice_at:
                    # 基于复习次数计算间隔
                    review_count = record.study_count
                    if needs_review(record.last_practice_at, review_count):
                        recommendations.append(AgentRecommendation(
                            type="review",
                            title=f"该复习「{record.point_name}」了",
                            description="根据艾宾浩斯遗忘曲线，现在复习效果最佳",
                            priority="normal",
                            related_point_id=str(record.point_id),
                            related_point_name=record.point_name,
                            action_label="去复习",
                            action_url=f"/banks?point={record.point_id}",
                        ))

        # 5. 【中优先级】跳过前置检测
        skip_recs = self._check_skip_prerequisite(records_map)
        recommendations.extend(skip_recs)

        # 6. 【低优先级】解锁新知识点
        unlock_recs = self._check_unlock_next(records_map)
        recommendations.extend(unlock_recs)

        # 去重：相同 point_id + type 只保留一个
        seen = set()
        unique_recs = []
        for rec in recommendations:
            key = (rec.type, rec.related_point_name)
            if key not in seen:
                seen.add(key)
                unique_recs.append(rec)

        # 按优先级排序
        priority_order = {"high": 0, "normal": 1, "low": 2}
        unique_recs.sort(key=lambda r: priority_order.get(r.priority, 3))

        return unique_recs[:10]  # 最多返回10条

    def _check_fatigue(
        self,
        session_start: Optional[datetime],
        session_questions: int,
        session_correct: int,
    ) -> bool:
        """检测疲劳度"""
        if not session_start:
            return False
        elapsed = (datetime.utcnow() - session_start).total_seconds() / 60
        if elapsed < 20:
            return False
        if session_questions < 5:
            return False
        acc = (session_correct / session_questions) * 100
        return (70 - acc) >= 15  # 相对于预期70%基线下降15%

    def _check_skip_prerequisite(
        self,
        records_map: Dict[str, Any],
    ) -> List[AgentRecommendation]:
        """检测跳过前置知识点直接做题的情况"""
        recommendations = []
        for pid, record in records_map.items():
            if record.total_practiced > 0 and record.mastery_score < 40 and record.consecutive_errors >= 2:
                # 查找前置知识点
                point = self.db.query(KnowledgePoint).filter(
                    KnowledgePoint.id == record.point_id
                ).first()
                if point:
                    # 检查是否存在更低sort_order的同一domain知识点
                    domain_points = (
                        self.db.query(KnowledgePoint)
                        .filter(
                            KnowledgePoint.domain_id == point.domain_id,
                            KnowledgePoint.sort_order < point.sort_order,
                        )
                        .all()
                    )
                    for prev in domain_points:
                        prev_record = records_map.get(str(prev.id))
                        if prev_record and prev_record.mastery_score < 60:
                            recommendations.append(AgentRecommendation(
                                type="study",
                                title=f"建议先学习「{prev.name}」再做题",
                                description=f"「{record.point_name}」的错误率较高，建议先掌握前置知识点「{prev.name}」",
                                priority="normal",
                                related_point_id=str(prev.id),
                                related_point_name=prev.name,
                                action_label="去学习",
                                action_url=f"/banks?point={prev.id}",
                            ))
                            break
        return recommendations

    def _check_unlock_next(
        self,
        records_map: Dict[str, Any],
    ) -> List[AgentRecommendation]:
        """检测掌握度≥80%的知识点，建议解锁下一知识点"""
        recommendations = []
        for pid, record in records_map.items():
            if record.mastery_score >= 80 and record.total_practiced >= 3:
                point = self.db.query(KnowledgePoint).filter(
                    KnowledgePoint.id == record.point_id
                ).first()
                if not point:
                    continue
                next_point = (
                    self.db.query(KnowledgePoint)
                    .filter(
                        KnowledgePoint.domain_id == point.domain_id,
                        KnowledgePoint.sort_order > point.sort_order,
                    )
                    .order_by(KnowledgePoint.sort_order)
                    .first()
                )
                if next_point:
                    next_pid = str(next_point.id)
                    next_record = records_map.get(next_pid)
                    if not next_record or next_record.status == "not_started":
                        recommendations.append(AgentRecommendation(
                            type="unlock",
                            title=f"可以学习「{next_point.name}」了",
                            description=f"「{record.point_name}」已掌握 {record.mastery_score}%，可以解锁下一个知识点",
                            priority="low",
                            related_point_id=next_pid,
                            related_point_name=next_point.name,
                            action_label="开始学习",
                            action_url=f"/banks?point={next_pid}",
                        ))
        return recommendations
