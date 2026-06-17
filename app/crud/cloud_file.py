import os
import uuid
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc
from app.models.cloud_file import CloudFile

CLOUD_DIR = "uploads/cloud_drive"
os.makedirs(CLOUD_DIR, exist_ok=True)


class CloudFileCRUD:
    """云盘文件 CRUD"""

    def list_files(
        self, db: Session, user_id: str,
        parent_id: Optional[str] = None,
        file_type: Optional[str] = None,
    ) -> List[CloudFile]:
        """列出文件夹下的文件，parent_id=None 表示根目录"""
        query = db.query(CloudFile).filter(CloudFile.user_id == user_id)
        if parent_id is None:
            query = query.filter(CloudFile.parent_id.is_(None))
        else:
            query = query.filter(CloudFile.parent_id == parent_id)
        if file_type:
            query = query.filter(CloudFile.file_type == file_type)
        # 文件夹排在前面，然后按更新时间降序
        from sqlalchemy import case
        order = case((CloudFile.is_folder == True, 0), else_=1)
        return query.order_by(order, desc(CloudFile.updated_at)).all()

    def get_file(self, db: Session, file_id: str, user_id: str) -> Optional[CloudFile]:
        return db.query(CloudFile).filter(
            CloudFile.id == file_id,
            CloudFile.user_id == user_id,
        ).first()

    def create_file(
        self,
        db: Session,
        user_id: str,
        file_name: str,
        file_type: str,
        mime_type: str,
        file_size: int,
        storage_key: str,
        parent_id: Optional[str] = None,
        is_folder: bool = False,
        content_text: Optional[str] = None,
    ) -> CloudFile:
        record = CloudFile(
            user_id=user_id,
            file_name=file_name,
            file_type=file_type,
            mime_type=mime_type,
            file_size=file_size,
            storage_key=storage_key,
            parent_id=parent_id,
            is_folder=is_folder,
            content_text=content_text,
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        return record

    def update_file_content(
        self, db: Session, file_id: str, user_id: str,
        content_text: Optional[str] = None,
        file_name: Optional[str] = None,
    ) -> Optional[CloudFile]:
        record = self.get_file(db, file_id, user_id)
        if not record:
            return None
        if content_text is not None:
            record.content_text = content_text
        if file_name is not None:
            record.file_name = file_name
        db.commit()
        db.refresh(record)
        return record

    def delete_file(self, db: Session, file_id: str, user_id: str) -> bool:
        record = self.get_file(db, file_id, user_id)
        if not record:
            return False
        # 如果是文件夹，递归删除子文件和子文件夹
        if record.is_folder:
            children = db.query(CloudFile).filter(
                CloudFile.parent_id == file_id,
                CloudFile.user_id == user_id,
            ).all()
            for child in children:
                self.delete_file(db, str(child.id), user_id)
        # 删除物理文件
        if record.storage_key:
            filepath = os.path.join(CLOUD_DIR, record.storage_key)
            if os.path.exists(filepath):
                os.remove(filepath)
        db.delete(record)
        db.commit()
        return True

    def get_storage_path(self, storage_key: str) -> str:
        return os.path.join(CLOUD_DIR, storage_key)

    def get_folder_path(self, db: Session, folder_id: str, user_id: str) -> List[dict]:
        """获取从根到当前文件夹的路径（面包屑导航）"""
        path = []
        current = self.get_file(db, folder_id, user_id)
        while current:
            path.append({"id": str(current.id), "name": current.file_name})
            if current.parent_id:
                current = self.get_file(db, str(current.parent_id), user_id)
            else:
                break
        path.reverse()
        return path


cloud_file_crud = CloudFileCRUD()
