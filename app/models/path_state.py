"""学习路径执行状态模型

持久化每条学习路径的执行状态，包括：
- 当前阶段 (diagnosis / learning / practice / review / completed)
- 当前焦点节点 (Agent 推荐的此刻最该学的知识点)
- 节点执行顺序 (拓扑排序后持久化，不会每次刷新变化)
- 版本号 (路径被调整的次数)
"""

from sqlalchemy import Column, String, DateTime, Uuid, Text, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import JSONB
from app.db.database import Base
from datetime import datetime
import uuid


class LearningPathState(Base):
    __tablename__ = "learning_path_states"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id = Column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    subject_id = Column(Uuid, ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True)

    # 核心状态
    goal_type = Column(String(50), nullable=True)              # 学期提升 / 升学备考 / 考级考证
    goal_description = Column(Text, nullable=True)              # 用户输入的学习目标文本
    phase = Column(String(20), nullable=False, default="diagnosis")  # diagnosis / learning / practice / review / completed

    # 当前焦点节点
    current_node_id = Column(Uuid, nullable=True)
    current_node_name = Column(String(200), nullable=True)

    # 节点执行顺序
    # JSON 数组: [{node_id, name, domain_name, status: pending|active|done|skipped|locked,
    #              mastery_score, sort_order, started_at, completed_at}]
    node_order = Column(JSONB, nullable=False, default=list)

    # 进度统计
    total_nodes = Column(Integer, default=0)
    completed_nodes = Column(Integer, default=0)

    # 路径版本与历史
    version = Column(Integer, default=1)

    # AI 个性化路径元数据（由 POST /path/confirm 写入）
    # 存储: {path_name, description, phases, strategy_notes, daily_suggestion, generation_reason}
    ai_metadata = Column("metadata", JSONB, nullable=False, default=dict)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
