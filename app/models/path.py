from sqlalchemy import Column, String, DateTime, Uuid, Text, ForeignKey
from app.db.database import Base
from datetime import datetime
import uuid


class LearningPath(Base):
    __tablename__ = "learning_paths"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id = Column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    path_data = Column(Text, nullable=False)  # JSON 字符串，ReactFlow 格式
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
