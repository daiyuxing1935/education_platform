"""AgentTask — 多智能体任务持久化模型

存储每个 Agent 任务的完整状态，支持前端轮询查询进度。
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Uuid, Float, Integer
from sqlalchemy.dialects.postgresql import JSONB
from app.db.database import Base


class AgentTask(Base):
    """多智能体协同任务表"""
    __tablename__ = "agent_tasks"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id = Column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # 任务输入
    query = Column(Text, nullable=False, default="")
    knowledge_points = Column(JSONB, nullable=False, default=list)
    resource_types = Column(JSONB, nullable=False, default=list)
    subject_id = Column(String(100), nullable=True)

    # 任务状态
    status = Column(String(20), nullable=False, default="pending")  # pending / running / completed / failed
    progress = Column(Float, nullable=False, default=0.0)
    current_agent = Column(String(50), nullable=True)
    error_message = Column(Text, nullable=True)

    # 产出物摘要
    generated_types = Column(JSONB, nullable=False, default=list)
    resource_ids = Column(JSONB, nullable=False, default=list)  # 生成的资源 ID 列表
    path_id = Column(Uuid, nullable=True)
    result_summary = Column(Text, nullable=True)

    # 完整状态快照（JSON，用于前端展示详情）
    state_snapshot = Column(JSONB, nullable=True)

    # 时间
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
