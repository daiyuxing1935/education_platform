"""学习路径状态 Pydantic Schema"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from uuid import UUID


# ── 节点执行顺序中的单项 ──
class NodeOrderItem(BaseModel):
    node_id: str
    name: str
    domain_name: str = ""
    status: str = "pending"  # pending / active / done / skipped / locked
    mastery_score: int = 0
    sort_order: int = 0
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


# ── 当前焦点节点 ──
class CurrentNodeInfo(BaseModel):
    node_id: str
    name: str
    domain_name: str = ""
    mastery_score: int = 0
    status: str = "active"
    reason: str = ""  # Agent 推荐理由


# ── 路径进度 ──
class PathProgress(BaseModel):
    total: int = 0
    completed: int = 0
    skipped: int = 0
    percentage: int = 0  # 0-100


# ── 路径状态完整响应 ──
class PathStateResponse(BaseModel):
    has_active_path: bool = False
    state: Optional["PathStateData"] = None

    model_config = {"from_attributes": True}


class PathStateData(BaseModel):
    id: str
    phase: str
    goal_type: str = ""
    goal_description: str = ""
    current_node: Optional[CurrentNodeInfo] = None
    node_order: List[NodeOrderItem] = []
    progress: PathProgress = Field(default_factory=PathProgress)
    version: int = 1
    subject_id: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ── 初始化路径请求 ──
class PathInitRequest(BaseModel):
    subject_id: str
    goal_type: str = ""  # 学期提升 / 升学备考 / 考级考证
    goal_description: str = ""


# ── 进度上报请求 ──
class PathProgressRequest(BaseModel):
    node_id: str
    action: str = "complete"  # complete / skip / unskip
    state_id: str = ""  # 可选，指定路径ID；不传则更新最近活跃路径


# ── 路径初始化响应 ──
class PathInitResponse(BaseModel):
    state_id: str
    message: str
    phase: str = "learning"
    total_nodes: int = 0
