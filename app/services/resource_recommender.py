"""
个性化资源推荐服务

整合 8 种推荐策略，为学生推荐最合适的学习资源：
1. 薄弱点识别 → 复习题/讲解/记忆卡片
2. 艾宾浩斯遗忘曲线 → 临界点复习
3. 知识链推荐 → 前置完成后解锁后继
4. 变式练习 → 同知识点不同表述/数据
5. 难度自适应 → 近10题正确率调整
6. 周期性总结报告 → 每周/章末报告
7. 疲劳检测 → 知识漫画/趣味图
8. 重要资源推荐 → 教师/高年级标记
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.question_bank import (
    KnowledgePointRecord,
    StudentAnswer,
    WrongAnswerRecord,
    KnowledgePoint,
    Question,
    DailyPracticeRecord,
)
from app.models.resource import KnowledgeResource
from app.services.mastery_calculator import calculate_review_interval

logger = logging.getLogger(__name__)

# 中国时区
_CHINA_TZ = timezone(timedelta(hours=8))


class RecommenderItem:
    """单条推荐项"""
    def __init__(
        self,
        rec_type: str,
        priority: int,
        title: str,
        reason: str,
        knowledge_point: Optional[str] = None,
        point_id: Optional[str] = None,
        resources: Optional[list] = None,
        suggested_actions: Optional[list] = None,
        metadata: Optional[dict] = None,
    ):
        self.type = rec_type
        self.priority = priority
        self.title = title
        self.reason = reason
        self.knowledge_point = knowledge_point
        self.point_id = point_id
        self.resources = resources or []
        self.suggested_actions = suggested_actions or []
        self.metadata = metadata or {}

    def to_dict(self) -> dict:
        return {
            "type": self.type,
            "priority": self.priority,
            "title": self.title,
            "reason": self.reason,
            "knowledge_point": self.knowledge_point,
            "point_id": self.point_id,
            "resources": self.resources,
            "suggested_actions": self.suggested_actions,
            "metadata": self.metadata,
        }


class ResourceRecommender:
    """个性化资源推荐引擎"""

    # 推荐类型常量
    TYPE_WEAK_POINT = "weak_point"
    TYPE_REVIEW = "ebbinghaus_review"
    TYPE_CHAIN = "knowledge_chain"
    TYPE_VARIATION = "variation_exercise"
    TYPE_DIFFICULTY = "difficulty_adjust"
    TYPE_SUMMARY = "periodic_summary"
    TYPE_FATIGUE = "fatigue_recovery"
    TYPE_IMPORTANT = "important_resource"

    def __init__(self, db: Session, user_id: str):
        self.db = db
        self.user_id = user_id
        self._now = datetime.utcnow()

    def get_all_recommendations(self, max_results: int = 15, subject_id: str = None) -> list[dict]:
        """获取所有推荐，按优先级排序"""
        items: list[RecommenderItem] = []

        items.extend(self._weak_point_recommendations(subject_id=subject_id))
        items.extend(self._ebbinghaus_review_recommendations())
        items.extend(self._knowledge_chain_recommendations())
        items.extend(self._variation_exercise_recommendations())
        items.extend(self._difficulty_adjustment_recommendations())
        items.extend(self._fatigue_recommendations())
        items.extend(self._important_resource_recommendations())

        # 去重（按 knowledge_point + type 去重，保留优先级高的）
        seen = set()
        unique = []
        for item in sorted(items, key=lambda x: x.priority, reverse=True):
            key = (item.type, item.knowledge_point or "")
            if key not in seen:
                seen.add(key)
                unique.append(item)

        return [item.to_dict() for item in unique[:max_results]]

    # ────────── 1. 薄弱点识别 ──────────

    def _weak_point_recommendations(self, subject_id: str = None) -> list[RecommenderItem]:
        """识别掌握不足的薄弱点，推荐复习题/讲解/记忆卡片"""
        results = []
        query = (
            self.db.query(KnowledgePointRecord)
            .filter(
                KnowledgePointRecord.user_id == self.user_id,
                KnowledgePointRecord.mastery_score < 60,
                KnowledgePointRecord.total_practiced > 0,
            )
        )

        # 按学科过滤：只推荐当前学科的薄弱点
        if subject_id:
            from app.models.question_bank import KnowledgeDomain
            query = query.join(KnowledgePoint, KnowledgePointRecord.point_id == KnowledgePoint.id) \
                .join(KnowledgeDomain, KnowledgePoint.domain_id == KnowledgeDomain.id) \
                .filter(KnowledgeDomain.subject_id == subject_id)

        records = query.order_by(KnowledgePointRecord.mastery_score.asc()).all()

        for rec in records[:5]:  # 最多5个
            # 计算优先级：掌握度越低越优先
            priority = max(10, 80 - rec.mastery_score)
            # 连续错误加成
            if rec.consecutive_errors >= 3:
                priority += 15

            resources = self._find_resources_for_kp(
                rec.point_name,
                categories=["explanation", "review_question", "memory_card"],
            )

            reasons = []
            if rec.mastery_score < 30:
                reasons.append(f"掌握度仅 {rec.mastery_score}%（严重不足）")
            elif rec.mastery_score < 50:
                reasons.append(f"掌握度 {rec.mastery_score}%（明显不足）")
            else:
                reasons.append(f"掌握度 {rec.mastery_score}%（有待加强）")
            if rec.consecutive_errors >= 3:
                reasons.append(f"连续 {rec.consecutive_errors} 次答错")
            if rec.recent_accuracy < 40:
                reasons.append(f"近期正确率仅 {rec.recent_accuracy}%")

            results.append(RecommenderItem(
                rec_type=self.TYPE_WEAK_POINT,
                priority=priority,
                title=f"攻克薄弱点：{rec.point_name}",
                reason="；".join(reasons),
                knowledge_point=rec.point_name,
                point_id=str(rec.point_id),
                resources=resources,
                suggested_actions=[
                    "查看知识点讲解/思维导图",
                    "做针对性的复习题",
                    "使用记忆卡片巩固",
                ],
            ))

        return results

    # ────────── 2. 艾宾浩斯复习推荐 ──────────

    def _ebbinghaus_review_recommendations(self) -> list[RecommenderItem]:
        """计算距离上次复习的时间，推荐即将达到遗忘临界点的知识点"""
        results = []
        records = (
            self.db.query(KnowledgePointRecord)
            .filter(
                KnowledgePointRecord.user_id == self.user_id,
                KnowledgePointRecord.status.in_(["learning", "mastered", "reviewing"]),
                KnowledgePointRecord.mastery_score > 0,
            )
            .all()
        )

        for rec in records:
            if not rec.last_study_at and not rec.last_practice_at:
                continue

            # 计算预计间隔
            review_count = rec.study_count or 1
            interval_days = calculate_review_interval(min(review_count, 5))

            # 上次学习时间
            last_time = rec.last_study_at or rec.last_practice_at
            if not last_time:
                continue

            elapsed_days = (self._now - last_time).total_seconds() / 86400
            # 即将到达临界点：已过间隔的 70%-100%，或已超期
            threshold = interval_days * 0.7
            is_due = elapsed_days >= threshold

            if not is_due:
                continue

            # 计算优先级：越接近遗忘临界点越优先
            if elapsed_days >= interval_days:
                priority = 75  # 已超期
            else:
                priority = int(50 + 25 * (elapsed_days - threshold) / (interval_days - threshold))

            resources = self._find_resources_for_kp(
                rec.point_name,
                categories=["explanation", "memory_card"],
            )

            remaining = max(0, int(interval_days - elapsed_days))
            status = "已超过复习时间" if elapsed_days >= interval_days else f"距离遗忘临界点还有约 {remaining} 天"

            results.append(RecommenderItem(
                rec_type=self.TYPE_REVIEW,
                priority=priority,
                title=f"复习提醒：{rec.point_name}",
                reason=f"上次复习距今 {int(elapsed_days)} 天（艾宾浩斯建议 {interval_days} 天复习），{status}",
                knowledge_point=rec.point_name,
                point_id=str(rec.point_id),
                resources=resources,
                suggested_actions=[
                    "快速浏览知识点概要",
                    "做几道相关练习题巩固",
                    "使用记忆卡片强化记忆",
                ],
            ))

        return results[:5]

    # ────────── 3. 知识链推荐 ──────────

    def _knowledge_chain_recommendations(self) -> list[RecommenderItem]:
        """掌握当前知识点后，推荐逻辑衔接的下一组知识点"""
        results = []
        mastered = (
            self.db.query(KnowledgePointRecord)
            .filter(
                KnowledgePointRecord.user_id == self.user_id,
                KnowledgePointRecord.mastery_score >= 80,
                KnowledgePointRecord.total_practiced >= 3,
            )
            .all()
        )

        for rec in mastered:
            # 查找同一 domain 中下一个 sort_order 的知识点
            current_kp = (
                self.db.query(KnowledgePoint)
                .filter(KnowledgePoint.id == rec.point_id)
                .first()
            )
            if not current_kp:
                continue

            # 查找同 domain 中 sort_order 更大的下一个知识点
            next_kp = (
                self.db.query(KnowledgePoint)
                .filter(
                    KnowledgePoint.domain_id == current_kp.domain_id,
                    KnowledgePoint.sort_order > current_kp.sort_order,
                )
                .order_by(KnowledgePoint.sort_order.asc())
                .first()
            )

            if not next_kp:
                continue

            # 检查是否已开始学习
            next_record = (
                self.db.query(KnowledgePointRecord)
                .filter(
                    KnowledgePointRecord.user_id == self.user_id,
                    KnowledgePointRecord.point_id == next_kp.id,
                )
                .first()
            )
            if next_record and next_record.mastery_score >= 50:
                continue  # 已掌握或学习中，跳过

            status_text = "未开始" if not next_record else f"掌握度 {next_record.mastery_score}%"
            resources = self._find_resources_for_kp(
                next_kp.name,
                categories=["explanation", "memory_card"],
            )

            results.append(RecommenderItem(
                rec_type=self.TYPE_CHAIN,
                priority=45,
                title=f"继续学习：{next_kp.name}",
                reason=f"已掌握「{rec.point_name}」({rec.mastery_score}%)，下一个建议学习「{next_kp.name}」（当前{status_text}）",
                knowledge_point=next_kp.name,
                point_id=str(next_kp.id),
                resources=resources,
                suggested_actions=[
                    "学习知识点讲解材料",
                    "完成入门练习题",
                    "标记为已学以解锁后续内容",
                ],
            ))

        return results[:3]

    # ────────── 4. 变式练习推荐 ──────────

    def _variation_exercise_recommendations(self) -> list[RecommenderItem]:
        """出错的题 → 推荐同一知识点、不同表述的变式题"""
        results = []

        # 找到最近的错题记录（近7天）
        week_ago = self._now - timedelta(days=7)
        wrong_records = (
            self.db.query(WrongAnswerRecord)
            .filter(
                WrongAnswerRecord.user_id == self.user_id,
                WrongAnswerRecord.last_wrong_at >= week_ago,
            )
            .order_by(desc(WrongAnswerRecord.last_wrong_at))
            .limit(10)
            .all()
        )

        processed_kps = set()
        for wr in wrong_records:
            # 找到错题对应的知识点
            question = (
                self.db.query(Question)
                .filter(Question.id == wr.question_id)
                .first()
            )
            if not question or not question.knowledge_point_uuids:
                continue

            kp_uuids = question.knowledge_point_uuids
            kp = (
                self.db.query(KnowledgePoint)
                .filter(KnowledgePoint.id.in_(kp_uuids))
                .first()
            )
            if not kp or kp.name in processed_kps:
                continue

            processed_kps.add(kp.name)

            # 找到该知识点的其他题目（变式）
            variation_questions = (
                self.db.query(Question)
                .filter(
                    Question.knowledge_point_uuids.contains(kp_uuids),
                    Question.id != wr.question_id,  # 排除原题
                )
                .limit(3)
                .all()
            )

            if not variation_questions:
                continue

            resources = [
                {
                    "resource_type": "question",
                    "title": q.content.get("stem", "")[:80] if isinstance(q.content, dict) else str(q.content)[:80],
                    "question_id": str(q.id),
                    "difficulty": q.difficulty,
                }
                for q in variation_questions
            ]

            results.append(RecommenderItem(
                rec_type=self.TYPE_VARIATION,
                priority=60,
                title=f"变式练习：{kp.name}",
                reason=f"该知识点曾答错 {wr.wrong_count} 次，推荐 {len(variation_questions)} 道变式题检验是否真正理解",
                knowledge_point=kp.name,
                point_id=str(kp.id),
                resources=resources,
                suggested_actions=[
                    "先复习知识点再做变式题",
                    "注意题目条件的变化",
                    "做完后对照解析理解差异",
                ],
            ))

        return results[:3]

    # ────────── 5. 难度自适应推荐 ──────────

    def _difficulty_adjustment_recommendations(self) -> list[RecommenderItem]:
        """根据近期答题正确率调整推荐难度"""
        recent_answers = (
            self.db.query(StudentAnswer)
            .filter(StudentAnswer.user_id == self.user_id)
            .order_by(desc(StudentAnswer.created_at))
            .limit(10)
            .all()
        )

        if len(recent_answers) < 3:
            return []

        correct_count = sum(1 for a in recent_answers if a.is_correct)
        accuracy = correct_count / len(recent_answers) * 100

        if accuracy > 80:
            # 提升难度：推荐高阶知识点或竞赛题
            kps = (
                self.db.query(KnowledgePoint)
                .filter(KnowledgePoint.difficulty >= 4)
                .order_by(KnowledgePoint.difficulty.desc())
                .limit(3)
                .all()
            )
            if not kps:
                return []

            resources = []
            for kp in kps:
                kp_resources = self._find_resources_for_kp(kp.name)
                resources.extend(kp_resources)

            return [RecommenderItem(
                rec_type=self.TYPE_DIFFICULTY,
                priority=50,
                title="挑战更高难度",
                reason=f"近 10 题正确率 {accuracy:.0f}%，掌握良好！推荐尝试以下高阶知识点",
                knowledge_point=None,
                point_id=None,
                resources=resources[:5],
                suggested_actions=[
                    "尝试高阶挑战题",
                    "学习进阶知识点",
                    "参加竞赛难度练习",
                ],
                metadata={"recent_accuracy": accuracy, "adjustment": "up"},
            )]

        elif accuracy < 50:
            # 降低难度：推荐基础知识
            kps = (
                self.db.query(KnowledgePoint)
                .filter(KnowledgePoint.difficulty <= 2)
                .order_by(KnowledgePoint.difficulty.asc())
                .limit(3)
                .all()
            )
            if not kps:
                return []

            resources = []
            for kp in kps:
                kp_resources = self._find_resources_for_kp(
                    kp.name,
                    categories=["explanation", "memory_card"],
                )
                resources.extend(kp_resources)

            return [RecommenderItem(
                rec_type=self.TYPE_DIFFICULTY,
                priority=50,
                title="回归基础巩固",
                reason=f"近 10 题正确率 {accuracy:.0f}%，建议先巩固以下基础知识点再挑战难题",
                knowledge_point=None,
                point_id=None,
                resources=resources[:5],
                suggested_actions=[
                    "复习基础知识讲解",
                    "做基础难度的练习题",
                    "确认掌握后再尝试进阶",
                ],
                metadata={"recent_accuracy": accuracy, "adjustment": "down"},
            )]

        return []

    # ────────── 6. 周期性总结报告 ──────────

    def _check_weekly_summary_due(self) -> bool:
        """检查是否需要生成周总结（每周一次）"""
        week_ago = self._now - timedelta(days=7)
        existing = (
            self.db.query(KnowledgeResource)
            .filter(
                KnowledgeResource.user_id == self.user_id,
                KnowledgeResource.resource_category == "summary_report",
                KnowledgeResource.created_at >= week_ago,
            )
            .first()
        )
        return existing is None

    def get_periodic_summary(self) -> Optional[RecommenderItem]:
        """生成个性化总结报告"""
        if not self._check_weekly_summary_due():
            return None

        # 查找波动最大的知识点（连续错误 vs 之前正确）
        records = (
            self.db.query(KnowledgePointRecord)
            .filter(
                KnowledgePointRecord.user_id == self.user_id,
                KnowledgePointRecord.total_practiced >= 3,
            )
            .order_by(KnowledgePointRecord.mastery_score.asc())
            .all()
        )

        if not records:
            return None

        # 波动最大：连续错误多但之前正确率高的
        volatile = [r for r in records if r.consecutive_errors >= 2 and r.mastery_score >= 40]
        # 练习频率最低的
        low_freq = sorted(records, key=lambda r: r.total_practiced)[:3]
        # 遗忘风险最高（距离上次练习最久且掌握度不为0）
        at_risk = [
            r for r in records
            if r.mastery_score > 0 and r.last_practice_at
            and (self._now - r.last_practice_at).days >= 3
        ]
        at_risk.sort(key=lambda r: (self._now - (r.last_practice_at or self._now)).days, reverse=True)

        summary_parts = []
        if volatile:
            summary_parts.append(
                f"掌握波动最大：{'、'.join(v.point_name for v in volatile[:3])}"
            )
        if low_freq:
            summary_parts.append(
                f"练习频率最低：{'、'.join(r.point_name for r in low_freq[:3])}"
            )
        if at_risk:
            summary_parts.append(
                f"遗忘风险最高：{'、'.join(r.point_name for r in at_risk[:3])}"
            )

        if not summary_parts:
            return None

        # 收集相关资源
        all_kps = set()
        for r in (volatile[:3] + low_freq[:3] + at_risk[:3]):
            all_kps.add(r.point_name)
        resources = []
        for kp in all_kps:
            resources.extend(self._find_resources_for_kp(kp))

        return RecommenderItem(
            rec_type=self.TYPE_SUMMARY,
            priority=70,
            title="📊 本周学习总结报告",
            reason="；".join(summary_parts),
            knowledge_point=None,
            point_id=None,
            resources=resources[:8],
            suggested_actions=[
                "优先复习波动较大的知识点",
                "增加低频知识点的练习",
                "在遗忘前及时巩固",
            ],
            metadata={"generated_at": self._now.isoformat()},
        )

    # ────────── 7. 疲劳检测 ──────────

    def _fatigue_recommendations(self) -> list[RecommenderItem]:
        """监测连续错误或单日学习时长过长，推荐轻松但相关的学习内容"""
        results = []

        # 检查今日学习时长
        today_start = self._now.replace(hour=0, minute=0, second=0, microsecond=0)
        today_records = (
            self.db.query(DailyPracticeRecord)
            .filter(
                DailyPracticeRecord.user_id == self.user_id,
                DailyPracticeRecord.record_date >= today_start,
            )
            .all()
        )
        total_today_seconds = sum(r.total_time_spent_seconds for r in today_records)

        # 检查连续错误率（最近5题）
        recent_answers = (
            self.db.query(StudentAnswer)
            .filter(StudentAnswer.user_id == self.user_id)
            .order_by(desc(StudentAnswer.created_at))
            .limit(5)
            .all()
        )
        consecutive_errors = sum(1 for a in recent_answers if not a.is_correct)
        error_rate_increasing = consecutive_errors >= 3 and len(recent_answers) >= 3

        is_fatigued = total_today_seconds > 7200  # 超过2小时
        is_frustrated = error_rate_increasing

        if not is_fatigued and not is_frustrated:
            return []

        resources = self.db.query(KnowledgeResource).filter(
            KnowledgeResource.resource_category.in_(["knowledge_comic", "infographic"]),
        ).limit(5).all()

        resource_list = [
            {
                "resource_type": r.resource_type,
                "title": r.title,
                "id": str(r.id),
                "category": r.resource_category,
            }
            for r in resources
        ]

        if is_fatigued:
            hours = total_today_seconds / 3600
            results.append(RecommenderItem(
                rec_type=self.TYPE_FATIGUE,
                priority=40,
                title="学习疲劳提醒",
                reason=f"今日已学习 {hours:.1f} 小时，建议休息片刻，看看知识漫画调节一下",
                knowledge_point=None,
                resources=resource_list or [],
                suggested_actions=[
                    "休息 10-15 分钟",
                    "浏览知识漫画/趣味图解",
                    "调整学习节奏，避免过度疲劳",
                ],
                metadata={"study_hours": round(hours, 1)},
            ))

        if is_frustrated:
            results.append(RecommenderItem(
                rec_type=self.TYPE_FATIGUE,
                priority=35,
                title="连续答错，换个方式",
                reason=f"连续 {consecutive_errors} 题答错，建议先查看知识体系图谱或趣味示意图，换个角度理解",
                knowledge_point=None,
                resources=resource_list or [],
                suggested_actions=[
                    "查看知识体系总览图",
                    "浏览相关趣味示意图",
                    "调整心态后再回来练习",
                ],
                metadata={"consecutive_errors": consecutive_errors},
            ))

        return results[:2]

    # ────────── 8. 重要资源推荐 ──────────

    def _important_resource_recommendations(self) -> list[RecommenderItem]:
        """教师/高年级标记为重要的资源，推荐给尚未掌握该知识点的学生"""
        # 查找标记为重要的资源
        important_resources = (
            self.db.query(KnowledgeResource)
            .filter(
                KnowledgeResource.is_official_important == True,
                KnowledgeResource.user_id != self.user_id,  # 别人标记的
            )
            .all()
        )

        if not important_resources:
            return []

        results = []
        for res in important_resources:
            if not res.knowledge_points:
                continue

            # 检查学生的掌握情况
            for kp_name in res.knowledge_points:
                record = (
                    self.db.query(KnowledgePointRecord)
                    .filter(
                        KnowledgePointRecord.user_id == self.user_id,
                        KnowledgePointRecord.point_name == kp_name,
                    )
                    .first()
                )
                # 未掌握或未开始
                if record and record.mastery_score >= 60:
                    continue

                marker_count = len(res.marked_by_important) if isinstance(res.marked_by_important, list) else 0
                status = f"掌握度 {record.mastery_score}%" if record else "未开始学习"
                reason_parts = [f"「{kp_name}」当前{status}"]
                if marker_count > 0:
                    reason_parts.append(f"被 {marker_count} 位同学标记为重要资源")
                if res.error_frequency_score and res.error_frequency_score > 0.5:
                    reason_parts.append("属于高频错点")

                results.append(RecommenderItem(
                    rec_type=self.TYPE_IMPORTANT,
                    priority=55,
                    title=f"推荐资源：{res.title}",
                    reason="；".join(reason_parts),
                    knowledge_point=kp_name,
                    resources=[{
                        "resource_type": res.resource_type,
                        "title": res.title,
                        "id": str(res.id),
                        "category": res.resource_category,
                    }],
                    suggested_actions=[
                        "查看该重要资源",
                        "完成相关练习题",
                        "标记为已掌握",
                    ],
                ))
                break  # 每条资源只推荐一次

        return results[:3]

    # ────────── 辅助方法 ──────────

    def _find_resources_for_kp(
        self,
        kp_name: str,
        categories: Optional[list] = None,
        limit: int = 3,
    ) -> list:
        """查找与知识点相关的资源"""
        query = self.db.query(KnowledgeResource).filter(
            KnowledgeResource.knowledge_points.contains([kp_name]),
        )
        if categories:
            query = query.filter(KnowledgeResource.resource_category.in_(categories))
        resources = query.order_by(desc(KnowledgeResource.updated_at)).limit(limit).all()

        return [
            {
                "resource_type": r.resource_type,
                "title": r.title,
                "id": str(r.id),
                "category": r.resource_category,
                "difficulty": r.difficulty_level,
                "source": r.source,
            }
            for r in resources
        ]
