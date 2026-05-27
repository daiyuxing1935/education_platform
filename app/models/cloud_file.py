import uuid
from datetime import datetime
from sqlalchemy import Column, String, BigInteger, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.dialects.postgresql import UUID
from app.db.database import Base


class CloudFile(Base):
    __tablename__ = "cloud_files"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("cloud_files.id"), nullable=True)
    is_folder = Column(Boolean, default=False)
    file_name = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=False)  # folder, pdf, pptx, docx, image, txt, md, ...
    mime_type = Column(String(100), nullable=True)
    file_size = Column(BigInteger, default=0)
    storage_key = Column(String(500), nullable=True)  # null for folders
    content_text = Column(Text, nullable=True)  # markdown source for word docs, description for folders
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
