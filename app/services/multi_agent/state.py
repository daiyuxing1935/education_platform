"""多智能体工作流状态定义

所有 Agent 共享此状态类型，通过 TypedDict 保证类型安全。
"""

from typing import TypedDict, Optional, List, Dict, Any
from langgraph.graph import MessagesState


class ResourceItem(TypedDict, total=False):
    """单个资源项"""
    resource_type: str          # mind_map / document / exercise / code_case / video / video_script
    title: str                  # 资源标题
    content: str                # 内容（Markdown / JSON / 文本）
    knowledge_points: List[str]  # 关联知识点
    source: str                 # agent_generated
    metadata: Dict[str, Any]    # 额外元数据


class AgentState(TypedDict, total=False):
    """多智能体工作流状态

    继承 MessagesState 以获得消息处理能力，
    同时包含任务控制字段和各 Agent 产出字段。
    """
    # ── 消息（继承自 MessagesState） ──
    messages: List[Any]  # LangChain 消息列表

    # ── 任务控制字段 ──
    task_id: str                    # 任务 UUID
    student_id: str                 # 学生 UUID
    task_status: str                # pending / running / completed / failed
    progress: float                 # 0.0 → 1.0
    current_agent: str              # 当前执行的 Agent 名称
    error: Optional[str]            # 错误信息

    # ── 输入 ──
    query: str                      # 用户原始请求
    knowledge_points: List[str]     # 提取的知识点列表
    subject_id: Optional[str]       # 学科 ID（可选）
    resource_types: List[str]       # 请求生成的资源类型列表

    # ── API 配置（从用户设置读取） ──
    api_key: Optional[str]          # 用户配置的 LLM API Key
    api_base_url: Optional[str]     # 用户配置的 base_url
    api_model: Optional[str]        # 用户配置的 model

    # ── 画像（ProfileAgent 产出） ──
    profile_data: Optional[Dict[str, Any]]      # 完整画像
    weak_points: Optional[List[Dict[str, Any]]] # 薄弱知识点
    cognitive_style: Optional[str]              # 认知风格
    knowledge_mastery: Optional[Dict[str, float]]  # 知识点掌握度映射

    # ── 资源（ResourceGenAgent 产出） ──
    resources: Optional[List[ResourceItem]]     # 生成的资源列表
    generated_types: Optional[List[str]]       # 已生成的资源类型

    # ── 路径（PathPushAgent 产出） ──
    path_data: Optional[Dict[str, Any]]         # 学习路径数据
    path_id: Optional[str]                      # 学习路径 ID
    pushed_resource_ids: Optional[List[str]]    # 推送到路径的资源 ID


# Agent 名称常量
AGENT_SCHEDULER = "scheduler"
AGENT_PROFILE = "profile"
AGENT_RESOURCE_GEN = "resource_gen"
AGENT_PATH_PUSH = "path_push"

# 资源类型常量
RESOURCE_TYPE_MIND_MAP = "mind_map"
RESOURCE_TYPE_DOCUMENT = "document"
RESOURCE_TYPE_EXERCISE = "exercise"
RESOURCE_TYPE_CODE_CASE = "code_case"
RESOURCE_TYPE_VIDEO = "video"
RESOURCE_TYPE_VIDEO_SCRIPT = "video_script"
RESOURCE_TYPE_EXTRA_READING = "extra_reading"

ALL_RESOURCE_TYPES = [
    RESOURCE_TYPE_MIND_MAP,
    RESOURCE_TYPE_DOCUMENT,
    RESOURCE_TYPE_EXERCISE,
    RESOURCE_TYPE_CODE_CASE,
    RESOURCE_TYPE_VIDEO,
    RESOURCE_TYPE_VIDEO_SCRIPT,
    RESOURCE_TYPE_EXTRA_READING,
]

# 资源类型中文标签
RESOURCE_TYPE_LABELS = {
    RESOURCE_TYPE_MIND_MAP: "思维导图",
    RESOURCE_TYPE_DOCUMENT: "知识讲解文档",
    RESOURCE_TYPE_EXERCISE: "练习题",
    RESOURCE_TYPE_CODE_CASE: "代码实操案例",
    RESOURCE_TYPE_VIDEO: "教学视频",
    RESOURCE_TYPE_VIDEO_SCRIPT: "视频脚本",
    RESOURCE_TYPE_EXTRA_READING: "拓展阅读",
}
