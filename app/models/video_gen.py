"""视频生成任务模型

跟踪视频生成的异步任务状态与进度。
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from app.db.database import Base


class VideoGenTask(Base):
    """视频生成任务"""
    __tablename__ = "video_gen_tasks"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id = Column(Uuid, ForeignKey("users.id"), nullable=False, index=True)
    knowledge_points = Column(JSONB, nullable=False, default=list)

    # pending → preview → confirmed → generating → completed / failed
    status = Column(String(20), nullable=False, default="pending")

    # 预览阶段内容
    script_content = Column(Text, nullable=True)
    outline_content = Column(Text, nullable=True)

    # 完整章节数据（确认后生成）
    chapters_data = Column(JSONB, nullable=True)

    # 进度信息
    progress_message = Column(String(200), nullable=True)
    progress_pct = Column(String(20), nullable=True)  # "0%" ~ "100%"

    # 结果
    error_message = Column(Text, nullable=True)
    resource_id = Column(Uuid, ForeignKey("knowledge_resources.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
