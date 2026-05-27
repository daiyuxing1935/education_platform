from app.db.neo4j import Neo4jConnection, get_neo4j
from app.db.mongodb import MongoDBConnection, get_mongodb
from app.models.profile import (
    ProfileCreateRequest,
    ProfileUpdateRequest,
    KnowledgeMasteryUpdateRequest,
    PreferenceVectorRequest,
    ProfileResponse,
    ProfileSummaryResponse,
    KnowledgeMasteryData,
    SubjectMasteryData,
    DomainMasteryData,
    CognitiveStyleData,
    ErrorProneTopicData,
    ErrorProneSubjectData,
    ErrorProneDomainData,
    CognitiveStyleType
)
from typing import Optional, List, Dict, Any
from datetime import datetime
import json


class ProfileCRUD:
    def __init__(self, neo4j: Neo4jConnection, mongodb: MongoDBConnection):
        self.neo4j = neo4j
        self.mongodb = mongodb

    def create_profile(self, request: ProfileCreateRequest) -> bool:
        self.neo4j.create_student_node(request.student_id)

        if request.cognitive_style:
            self.neo4j.set_cognitive_style(
                request.student_id,
                request.cognitive_style.value,
                request.cognitive_style_confidence
            )

        if request.knowledge_points:
            for kp in request.knowledge_points:
                knowledge_point = kp.get("knowledge_point", "")
                score = kp.get("score", 0.0)
                confidence = kp.get("confidence", 0.3)
                if knowledge_point:
                    self.neo4j.add_knowledge_mastery(
                        request.student_id,
                        knowledge_point,
                        score,
                        confidence
                    )

        self.mongodb.create_student_profile(
            student_id=request.student_id,
            active_hours=request.active_hours,
            learning_rhythm_scalar=request.learning_rhythm_scalar,
            learning_rhythm_trend=request.learning_rhythm_trend,
            metacognitive_calibration=request.metacognitive_calibration,
            attention_feature=request.attention_feature
        )

        return True

    def _convert_datetime(self, dt):
        if dt is None:
            return None
        if hasattr(dt, 'isoformat'):
            return dt.isoformat()
        return str(dt)

    def _build_knowledge_hierarchy(
        self, flat_mastery: List[Dict[str, Any]]
    ) -> List[SubjectMasteryData]:
        """将扁平的知识掌握度列表按 学科→领域→知识点 组织"""
        from collections import OrderedDict

        subjects: Dict[str, SubjectMasteryData] = OrderedDict()

        for km in flat_mastery:
            kp_name = km["knowledge_point"]
            domain_name = km.get("domain_name") or ""
            domain_uuid = km.get("domain_uuid") or ""
            subject_name = km.get("subject_name") or ""
            subject_uuid = km.get("subject_uuid") or ""

            # 决定学科 key（无学科时归入"未分类"）
            sub_key = subject_uuid if subject_uuid and subject_name else "_uncategorized"
            if sub_key not in subjects:
                subjects[sub_key] = SubjectMasteryData(
                    subject_id=subject_uuid,
                    subject_name=subject_name if subject_name else "未分类",
                    domains=[],
                )
            subject = subjects[sub_key]

            # 决定章节 key（无章节时归入"未分类"）
            dom_key = domain_uuid if domain_uuid and domain_name else "_uncategorized"
            domain = None
            for d in subject.domains:
                did = d.domain_id
                if dom_key != "_uncategorized" and did == domain_uuid:
                    domain = d
                    break
                if dom_key == "_uncategorized" and d.domain_id == "":
                    domain = d
                    break
            if not domain:
                domain = DomainMasteryData(
                    domain_id=domain_uuid,
                    domain_name=domain_name if domain_name else "未分类",
                    knowledge_points=[],
                )
                subject.domains.append(domain)

            domain.knowledge_points.append(KnowledgeMasteryData(
                knowledge_point=kp_name,
                score=km.get("score", 0.0),
                confidence=km.get("confidence", 0.3),
                last_updated=self._convert_datetime(km.get("last_updated")),
            ))

        # 排序：学科 → 章节 → 知识点
        for sub in subjects.values():
            sub.domains.sort(key=lambda d: d.domain_name)
            for dom in sub.domains:
                dom.knowledge_points.sort(key=lambda kp: kp.knowledge_point)

        return list(subjects.values())

    def _build_error_prone_hierarchy(
        self, flat_topics: List[Dict[str, Any]]
    ) -> List[ErrorProneSubjectData]:
        """将扁平的易错点列表按 学科→章节→知识点 组织"""
        from collections import OrderedDict

        subjects: Dict[str, ErrorProneSubjectData] = OrderedDict()

        for ep in flat_topics:
            topic = ep["topic"]
            domain_name = ep.get("domain_name") or ""
            domain_uuid = ep.get("domain_uuid") or ""
            subject_name = ep.get("subject_name") or ""
            subject_uuid = ep.get("subject_uuid") or ""

            sub_key = subject_uuid if subject_uuid and subject_name else "_uncategorized"
            if sub_key not in subjects:
                subjects[sub_key] = ErrorProneSubjectData(
                    subject_id=subject_uuid,
                    subject_name=subject_name if subject_name else "未分类",
                    domains=[],
                )
            subject = subjects[sub_key]

            dom_key = domain_uuid if domain_uuid and domain_name else "_uncategorized"
            domain = None
            for d in subject.domains:
                did = d.domain_id
                if dom_key != "_uncategorized" and did == domain_uuid:
                    domain = d
                    break
                if dom_key == "_uncategorized" and d.domain_id == "":
                    domain = d
                    break
            if not domain:
                domain = ErrorProneDomainData(
                    domain_id=domain_uuid,
                    domain_name=domain_name if domain_name else "未分类",
                    topics=[],
                )
                subject.domains.append(domain)

            domain.topics.append(ErrorProneTopicData(
                topic=topic,
                error_count=ep.get("error_count", 1),
                last_updated=self._convert_datetime(ep.get("last_updated")),
            ))

        for sub in subjects.values():
            sub.domains.sort(key=lambda d: d.domain_name)
            for dom in sub.domains:
                dom.topics.sort(key=lambda t: t.topic)

        return list(subjects.values())

    def get_profile(self, student_id: str) -> Optional[ProfileResponse]:
        neo4j_data = self.neo4j.get_student_profile_data(student_id)
        mongodb_data = self.mongodb.get_student_profile(student_id)

        if not mongodb_data:
            return None

        knowledge_mastery = self._build_knowledge_hierarchy(
            neo4j_data.get("knowledge_mastery", [])
        )

        cognitive_style = None
        if neo4j_data.get("cognitive_style"):
            cs = neo4j_data["cognitive_style"]
            cognitive_style = CognitiveStyleData(
                style_type=CognitiveStyleType(cs.get("style_type", "mixed")),
                confidence=cs.get("confidence", 0.5),
                last_updated=self._convert_datetime(cs.get("last_updated"))
            )

        error_prone_topics = self._build_error_prone_hierarchy(
            neo4j_data.get("error_prone_topics", [])
        )

        dimensions = mongodb_data.get("dimensions", {})
        active_hours = dimensions.get("active_hours", {})
        learning_rhythm = dimensions.get("learning_rhythm", {})

        return ProfileResponse(
            student_id=student_id,
            knowledge_mastery=knowledge_mastery,
            cognitive_style=cognitive_style,
            error_prone_topics=error_prone_topics,
            active_hours=active_hours,
            learning_rhythm=learning_rhythm,
            metacognitive_calibration=dimensions.get("metacognitive_calibration", 0.0),
            attention_feature=dimensions.get("attention_feature", 0.5),
            created_at=self._convert_datetime(mongodb_data.get("created_at")),
            updated_at=self._convert_datetime(mongodb_data.get("updated_at"))
        )

    def get_profile_summary(self, student_id: str) -> Optional[ProfileSummaryResponse]:
        profile = self.get_profile(student_id)
        if not profile:
            return None

        return ProfileSummaryResponse(
            student_id=student_id,
            cognitive_style=profile.cognitive_style.style_type.value if profile.cognitive_style else None,
            metacognitive_calibration=profile.metacognitive_calibration,
            attention_feature=profile.attention_feature,
            knowledge_point_count=sum(
                len(dom.knowledge_points)
                for sub in profile.knowledge_mastery
                for dom in sub.domains
            ),
            error_prone_topic_count=sum(
                len(dom.topics)
                for sub in profile.error_prone_topics
                for dom in sub.domains
            )
        )

    def update_profile(self, student_id: str, request: ProfileUpdateRequest) -> bool:
        if request.cognitive_style:
            self.neo4j.set_cognitive_style(
                student_id,
                request.cognitive_style.value,
                request.cognitive_style_confidence or 0.5
            )

        self.mongodb.update_student_profile(
            student_id=student_id,
            active_hours=request.active_hours,
            learning_rhythm_scalar=request.learning_rhythm_scalar,
            learning_rhythm_trend=request.learning_rhythm_trend,
            metacognitive_calibration=request.metacognitive_calibration,
            attention_feature=request.attention_feature
        )

        return True

    def update_knowledge_mastery(
        self,
        student_id: str,
        request: KnowledgeMasteryUpdateRequest
    ) -> bool:
        return self.neo4j.update_knowledge_mastery(
            student_id,
            request.knowledge_point,
            request.score,
            request.confidence
        )

    def add_knowledge_mastery(
        self,
        student_id: str,
        knowledge_point: str,
        score: float = 0.0,
        confidence: float = 0.3
    ) -> bool:
        return self.neo4j.add_knowledge_mastery(
            student_id, knowledge_point, score, confidence
        )

    def delete_knowledge_mastery(self, student_id: str, knowledge_point: str) -> bool:
        return self.neo4j.delete_knowledge_mastery(student_id, knowledge_point)

    def add_error_prone_topic(
        self,
        student_id: str,
        topic: str,
        error_count: int = 1
    ) -> bool:
        return self.neo4j.add_error_prone_topic(student_id, topic, error_count)

    def record_behavior_event(
        self,
        student_id: str,
        event_type: str,
        event_data: Dict[str, Any]
    ) -> bool:
        self.mongodb.add_timeline_event(student_id, event_type, event_data)
        return self.mongodb.record_behavior_event(student_id, event_type, event_data)

    def get_timeline(self, student_id: str, limit: int = 50, skip: int = 0) -> List[Dict[str, Any]]:
        return self.mongodb.get_timeline(student_id, limit, skip)

    def get_behavior_events(
        self,
        student_id: str,
        event_type: Optional[str] = None,
        limit: int = 100,
        skip: int = 0
    ) -> List[Dict[str, Any]]:
        return self.mongodb.get_behavior_events(student_id, event_type, limit, skip)

    def delete_profile(self, student_id: str) -> bool:
        self.neo4j.delete_student_data(student_id)
        self.mongodb.delete_student_profile(student_id)
        return True


def get_profile_crud() -> ProfileCRUD:
    return ProfileCRUD(get_neo4j(), get_mongodb())
