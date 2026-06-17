"""用户画像聚合器 — ProfileAggregator

聚合多源用户数据，构建统一的 PersonalizationContext，供路径规划引擎使用。

数据源：
- PostgreSQL: UserProfile, KnowledgePointRecord, PracticeSession, DailyPracticeRecord,
  WrongAnswerRecord, ApiSettings
- Neo4j: CognitiveStyle, ErrorProneTopics, KnowledgeMastery
- MongoDB: student_profiles (active_hours, learning_rhythm)
"""

import logging
from typing import Optional, Dict, Any
from datetime import datetime
from uuid import UUID

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.schemas.path_personalization import PersonalizationContext
from app.models.user import User, UserProfile
from app.models.question_bank import (
    KnowledgePointRecord, Subject, DailyPracticeRecord,
    PracticeSession, WrongAnswerRecord,
)
from app.models.api_settings import ApiSettings
from app.db.neo4j import get_neo4j, Neo4jConnection
from app.db.mongodb import get_mongodb, MongoDBConnection

logger = logging.getLogger(__name__)


class ProfileAggregator:
    """聚合用户画像数据"""

    def __init__(self, db: Session):
        self.db = db

    async def collect(
        self,
        user_id: str,
        subject_id: str,
        goal_type: str = "",
        goal_description: str = "",
        target_score: str = "",
        deadline: str = "",
    ) -> PersonalizationContext:
        """聚合所有数据源，构建完整的个性化上下文

        Args:
            user_id: 用户 ID
            subject_id: 学科 ID
            goal_type: 目标类型
            goal_description: 目标描述
            target_score: 目标分数
            deadline: 截止日期
        """
        ctx = PersonalizationContext(
            user_id=user_id,
            subject_id=subject_id,
            goal_type=goal_type,
            goal_description=goal_description,
            target_score=target_score,
            deadline=deadline,
        )

        try:
            # ── 1. PostgreSQL: 用户基础画像 ──
            self._collect_user_profile(ctx, user_id)

            # ── 2. PostgreSQL: 学科信息 ──
            self._collect_subject_info(ctx, subject_id)

            # ── 3. PostgreSQL: 知识点掌握度记录 ──
            has_mastery_data = self._collect_mastery_records(ctx, user_id)

            # ── 4. PostgreSQL: 练习统计 ──
            self._collect_practice_stats(ctx, user_id)

            # ── 5. PostgreSQL: 错题统计 ──
            self._collect_wrong_answers(ctx, user_id)

            # ── 6. PostgreSQL: API 设置 ──
            self._collect_api_settings(ctx, user_id)

            # ── 7. Neo4j: 认知风格、薄弱点 ──
            neo4j = get_neo4j()
            if neo4j.verify_connectivity():
                self._collect_neo4j_data(ctx, user_id, neo4j)

            # ── 8. MongoDB: 学习行为维度 ──
            try:
                mongo = get_mongodb()
                if mongo.verify_connectivity():
                    self._collect_mongo_data(ctx, user_id, mongo)
            except Exception as e:
                logger.warning(f"MongoDB 数据采集失败（非致命）: {e}")

            # ── 判断冷启动状态 ──
            ctx.is_cold_start = not has_mastery_data and ctx.total_practiced == 0
            ctx.has_cognitive_data = bool(ctx.cognitive_style)

            ctx.aggregated_at = datetime.utcnow()

        except Exception as e:
            logger.error(f"画像聚合异常: {e}", exc_info=True)
            # 返回部分聚合的上下文，不抛异常

        return ctx

    # ── 各数据源采集方法 ──

    def _collect_user_profile(self, ctx: PersonalizationContext, user_id: str) -> None:
        """采集用户注册信息"""
        if not user_id:
            return
        try:
            profile = (
                self.db.query(UserProfile)
                .filter(UserProfile.user_id == user_id)
                .first()
            )
            if profile:
                ctx.major = profile.major or ""
                ctx.grade = profile.grade or ""
                ctx.university = profile.university or ""
                ctx.learning_goal = profile.learning_goal or ""
        except Exception as e:
            self.db.rollback()
            logger.warning(f"用户画像采集失败: {e}")

    def _collect_subject_info(self, ctx: PersonalizationContext, subject_id: str) -> None:
        """采集学科名称"""
        if not subject_id or not subject_id.strip():
            return
        try:
            subject = (
                self.db.query(Subject)
                .filter(Subject.id == subject_id)
                .first()
            )
            if subject:
                ctx.subject_name = subject.name
        except Exception as e:
            self.db.rollback()
            logger.warning(f"学科信息采集失败: {e}")

    def _collect_mastery_records(self, ctx: PersonalizationContext, user_id: str) -> bool:
        """采集知识点掌握度记录，返回是否有真实数据"""
        if not user_id:
            return False
        try:
            records = (
                self.db.query(KnowledgePointRecord)
                .filter(KnowledgePointRecord.user_id == user_id)
                .all()
            )
            if not records:
                return False

            has_data = False
            for r in records:
                ctx.existing_mastery[str(r.point_id)] = r.mastery_score or 0
                if r.mastery_score > 0 or r.total_practiced > 0:
                    has_data = True

            return has_data
        except Exception as e:
            self.db.rollback()
            logger.warning(f"掌握度记录采集失败: {e}")
            return False

    def _collect_practice_stats(self, ctx: PersonalizationContext, user_id: str) -> None:
        """采集练习统计数据"""
        try:
            # 所有练习记录汇总
            records = (
                self.db.query(KnowledgePointRecord)
                .filter(KnowledgePointRecord.user_id == user_id)
                .all()
            )
            total_practiced = 0
            total_correct = 0
            total_study = 0
            total_time = 0
            for r in records:
                total_practiced += r.total_practiced or 0
                total_correct += r.total_correct or 0
                total_study += r.study_count or 0
                total_time += r.total_time_spent_seconds or 0

            ctx.total_practiced = total_practiced
            ctx.total_correct = total_correct
            ctx.total_study_count = total_study
            if total_practiced > 0:
                ctx.practice_accuracy = round(total_correct / total_practiced * 100, 1)

            # 偏好的练习模式
            sessions = (
                self.db.query(PracticeSession)
                .filter(PracticeSession.user_id == user_id)
                .all()
            )
            if sessions:
                ctx.practice_session_count = len(sessions)
                mode_counts: Dict[str, int] = {}
                for s in sessions:
                    mode = s.mode or "sequential"
                    mode_counts[mode] = mode_counts.get(mode, 0) + 1
                ctx.preferred_practice_mode = max(mode_counts, key=mode_counts.get)  # type: ignore[arg-type]

            # 每日统计
            daily_records = (
                self.db.query(DailyPracticeRecord)
                .filter(DailyPracticeRecord.user_id == user_id)
                .order_by(DailyPracticeRecord.record_date.desc())
                .all()
            )
            if daily_records:
                # 连续学习天数
                streak = 0
                today = datetime.utcnow().date()
                for dr in daily_records:
                    if dr.record_date:
                        date = dr.record_date if hasattr(dr.record_date, 'date') else dr.record_date
                        if hasattr(date, 'date'):
                            date = date.date()
                        diff = (today - date).days if hasattr(date, 'days') else 0
                        if diff == streak:
                            streak += 1
                        elif diff > streak:
                            break
                ctx.daily_streak = min(streak, len(daily_records))

                total_q = sum(d.total_questions or 0 for d in daily_records)
                total_t = sum(d.total_time_spent_seconds or 0 for d in daily_records)
                if len(daily_records) > 0:
                    ctx.avg_daily_questions = round(total_q / len(daily_records), 1)
                    ctx.avg_daily_time_seconds = int(total_t / len(daily_records))

        except Exception as e:
            self.db.rollback()
            logger.warning(f"练习统计采集失败: {e}")

    def _collect_wrong_answers(self, ctx: PersonalizationContext, user_id: str) -> None:
        """采集错题统计"""
        try:
            wrong_records = (
                self.db.query(WrongAnswerRecord)
                .filter(WrongAnswerRecord.user_id == user_id)
                .all()
            )
            ctx.wrong_answer_count = len(wrong_records)
        except Exception as e:
            self.db.rollback()
            logger.warning(f"错题统计采集失败: {e}")

    def _collect_api_settings(self, ctx: PersonalizationContext, user_id: str) -> None:
        """采集用户 API 配置"""
        try:
            settings_list = (
                self.db.query(ApiSettings)
                .filter(
                    ApiSettings.user_id == user_id,
                    ApiSettings.is_enabled == True,
                )
                .all()
            )

            api_settings: Dict[str, Any] = {}
            for s in settings_list:
                provider = s.provider
                api_settings[provider] = {
                    "api_key": s.api_key,
                    "base_url": s.base_url,
                    "model_version": s.model_version,
                    "is_enabled": s.is_enabled,
                }
                if s.secret_key:
                    api_settings[provider]["secret_key"] = s.secret_key

            ctx.api_settings = api_settings
            ctx.has_llm_configured = bool(
                api_settings.get("deepseek", {}).get("api_key")
                or api_settings.get("qwen", {}).get("api_key")
            )

        except Exception as e:
            self.db.rollback()
            logger.warning(f"API 设置采集失败: {e}")

    def _collect_neo4j_data(
        self, ctx: PersonalizationContext, user_id: str, neo4j: Neo4jConnection
    ) -> None:
        """采集 Neo4j 中的认知风格和易错数据"""
        try:
            # 认知风格
            style = neo4j.get_cognitive_style(user_id)
            if style:
                ctx.cognitive_style = style.get("style_type", "")
                ctx.cognitive_style_confidence = style.get("confidence", 0.0)
                ctx.has_cognitive_data = True

            # 薄弱知识点（易错话题）
            error_topics = neo4j.get_error_prone_topics(user_id)
            if error_topics:
                ctx.error_prone_topics = [
                    {
                        "topic": t.get("topic", ""),
                        "error_count": t.get("error_count", 0),
                        "domain_name": t.get("domain_name", ""),
                        "subject_name": t.get("subject_name", ""),
                    }
                    for t in error_topics[:10]
                ]

        except Exception as e:
            logger.warning(f"Neo4j 数据采集失败: {e}")

    def _collect_mongo_data(
        self, ctx: PersonalizationContext, user_id: str, mongo: MongoDBConnection
    ) -> None:
        """采集 MongoDB 中的学习行为维度"""
        try:
            profile = mongo.get_student_profile(user_id)
            if profile:
                dimensions = profile.get("dimensions", {})

                # 活跃时段
                active_hours = dimensions.get("active_hours")
                if active_hours:
                    ctx.active_hours = active_hours

                # 学习节奏
                rhythm = dimensions.get("learning_rhythm", {})
                if rhythm:
                    ctx.learning_rhythm_scalar = rhythm.get("scalar", 0.5)
                    ctx.learning_rhythm_trend = rhythm.get("trend", 0.0)

                # 元认知校准
                ctx.metacognitive_calibration = dimensions.get(
                    "metacognitive_calibration", 0.0
                )

                # 注意力特征
                ctx.attention_feature = dimensions.get("attention_feature", 0.5)

        except Exception as e:
            logger.warning(f"MongoDB 数据采集失败: {e}")


# ── 获取单例 ──

_profile_aggregator: Optional[ProfileAggregator] = None


def get_profile_aggregator(db: Session) -> ProfileAggregator:
    """获取 ProfileAggregator 实例（每个 Session 新建）"""
    return ProfileAggregator(db)
