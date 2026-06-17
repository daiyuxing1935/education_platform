import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Uuid, Integer, Boolean, Float
from sqlalchemy.dialects.postgresql import JSONB
from app.db.database import Base


class KnowledgeResource(Base):
    """个性化学习资源表（思维导图、记忆卡片、知识漫画等）"""
    __tablename__ = "knowledge_resources"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id = Column(Uuid, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    resource_type = Column(String(50), nullable=False, default="mind_map")
    content = Column(Text, nullable=False)
    knowledge_points = Column(JSONB, nullable=False, default=list)
    source = Column(String(50), nullable=True)
    source_ref = Column(String(100), nullable=True)
    tags = Column(JSONB, nullable=False, default=list)

    # 推荐系统字段
    difficulty_level = Column(Integer, nullable=True)  # 1-5 难度等级
    resource_category = Column(String(50), nullable=True)  # explanation / review_question / memory_card / variation_exercise / knowledge_comic / infographic / summary_report
    is_public = Column(Boolean, default=True)  # 是否公开（所有资源对所有用户可见）
    is_official_important = Column(Boolean, default=False)  # 教师/管理员标记为重要
    marked_by_important = Column(JSONB, default=list)  # 标记为重要的用户ID列表
    error_frequency_score = Column(Float, nullable=True)  # 0-1 高频错点分数
    related_question_ids = Column(JSONB, default=list)  # 关联的题目UUID列表（变式练习用）

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class RecommendationFeedback(Base):
    """资源推荐反馈表——记录用户对推荐资源的反馈"""
    __tablename__ = "recommendation_feedbacks"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id = Column(Uuid, ForeignKey("users.id"), nullable=False, index=True)
    resource_id = Column(Uuid, ForeignKey("knowledge_resources.id"), nullable=False, index=True)
    useful = Column(Boolean, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
