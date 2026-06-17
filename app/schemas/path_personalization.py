"""个性化路径规划 — Pydantic Schemas

定义路径规划全流程的数据结构：
- 用户画像上下文（PersonalizationContext）
- API 设置摘要（用于判断 LLM 可用性）
- 路径生成请求/响应
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


# ═══════════════════════════════════════════════════════
#  API 设置摘要
# ═══════════════════════════════════════════════════════

class ApiSettingsSummary(BaseModel):
    """用户 LLM API 配置摘要"""
    has_deepseek: bool = False
    has_qwen: bool = False
    deepseek_config: Optional[Dict[str, str]] = None
    qwen_config: Optional[Dict[str, str]] = None

    @property
    def has_any_llm(self) -> bool:
        return self.has_deepseek or self.has_qwen


# ═══════════════════════════════════════════════════════
#  用户画像上下文
# ═══════════════════════════════════════════════════════

class PersonalizationContext(BaseModel):
    """聚合所有用户画像数据，供 LLM 路径规划使用"""

    # ── 显式输入（用户在路径创建表单填的）──
    user_id: str = ""
    subject_id: str = ""
    subject_name: str = ""           # 学科名称
    goal_type: str = ""              # 学期提升 / 升学备考 / 考级考证
    goal_description: str = ""       # 用户自定义目标文字
    target_score: str = ""           # 目标分数
    deadline: str = ""               # 截止日期 (YYYY-MM-DD)

    # ── 用户画像（PostgreSQL UserProfile）──
    major: str = ""
    grade: str = ""
    university: str = ""
    learning_goal: str = ""          # 用户在注册时填的学习目标

    # ── 认知风格（Neo4j CognitiveStyle）──
    cognitive_style: str = ""        # visual / auditory / reading_writing / kinesthetic / mixed
    cognitive_style_confidence: float = 0.0

    # ── 学习行为（MongoDB student_profiles）──
    active_hours: Dict[str, float] = Field(default_factory=lambda: {
        "morning": 0.25,
        "afternoon": 0.25,
        "evening": 0.25,
        "night": 0.25,
    })
    learning_rhythm_scalar: float = 0.5      # 0-1，节奏健康度
    learning_rhythm_trend: float = 0.0       # -1 to 1，变化趋势
    metacognitive_calibration: float = 0.0   # -1 to 1
    attention_feature: float = 0.5           # 0-1

    # ── 已有学习数据（PostgreSQL KnowledgePointRecord）──
    existing_mastery: Dict[str, int] = Field(default_factory=dict)  # {point_id: mastery_score}
    total_practiced: int = 0
    total_correct: int = 0
    total_study_count: int = 0
    practice_accuracy: float = 0.0            # 0-100

    # ── 练习偏好（PostgreSQL PracticeSession）──
    preferred_practice_mode: str = "sequential"
    practice_session_count: int = 0

    # ── 易错模式（Neo4j ERROR_PRONE + PostgreSQL WrongAnswerRecord）──
    error_prone_topics: List[Dict[str, Any]] = Field(default_factory=list)
    wrong_answer_count: int = 0

    # ── 每日统计摘要（PostgreSQL DailyPracticeRecord）──
    daily_streak: int = 0                    # 连续学习天数
    avg_daily_questions: float = 0.0         # 日均做题数
    avg_daily_time_seconds: int = 0          # 日均学习时长(秒)

    # ── API 能力 ──
    has_llm_configured: bool = False
    api_settings: Dict[str, Any] = Field(default_factory=dict)

    # ── 元信息 ──
    is_cold_start: bool = True               # 是否为新用户（无学习数据）
    has_cognitive_data: bool = False         # 是否有认知风格数据
    aggregated_at: Optional[datetime] = None

    @property
    def has_any_learning_data(self) -> bool:
        """是否有任何学习数据"""
        return self.total_practiced > 0 or self.total_study_count > 0

    @property
    def primary_learning_time(self) -> str:
        """返回活跃度最高的时段"""
        if not self.active_hours:
            return "下午"
        best = max(self.active_hours, key=self.active_hours.get)  # type: ignore[arg-type]
        time_labels = {
            "morning": "早上 (6:00-12:00)",
            "afternoon": "下午 (12:00-18:00)",
            "evening": "晚上 (18:00-24:00)",
            "night": "深夜 (0:00-6:00)",
        }
        return time_labels.get(best, "下午")

    def to_llm_context(self) -> str:
        """序列化为 LLM 可读的结构化文本"""
        lines = []

        # 基本信息
        lines.append("## 学生信息")
        lines.append(f"- 专业: {self.major or '未知'}")
        lines.append(f"- 年级: {self.grade or '未知'}")
        lines.append(f"- 学校: {self.university or '未知'}")
        lines.append(f"- 学习目标: {self.learning_goal or self.goal_description or '未知'}")

        # 目标
        lines.append("\n## 学习目标")
        lines.append(f"- 学科: {self.subject_name}")
        lines.append(f"- 目标类型: {self.goal_type or '未设定'}")
        lines.append(f"- 目标分数: {self.target_score or '未设定'}")
        lines.append(f"- 截止日期: {self.deadline or '未设定'}")

        # 认知风格
        if self.has_cognitive_data:
            style_labels = {
                "visual": "视觉型（偏好图表、视频）",
                "auditory": "听觉型（偏好音频、讲解）",
                "reading_writing": "读写型（偏好文档、笔记）",
                "kinesthetic": "动手型（偏好练习、实践）",
                "mixed": "混合型",
            }
            style_label = style_labels.get(self.cognitive_style, self.cognitive_style)
            lines.append(f"\n## 认知风格\n- {style_label}（置信度: {self.cognitive_style_confidence:.0%}）")

        # 学习行为
        lines.append(f"\n## 学习行为")
        lines.append(f"- 活跃时段: {self.primary_learning_time}")
        lines.append(f"- 学习节奏: {'稳定' if self.learning_rhythm_scalar > 0.6 else '不稳定' if self.learning_rhythm_scalar < 0.4 else '正常'}")

        # 已有学习数据
        if self.has_any_learning_data:
            lines.append(f"\n## 已有学习数据")
            lines.append(f"- 总练习量: {self.total_practiced} 题")
            lines.append(f"- 正确率: {self.practice_accuracy:.0f}%")
            lines.append(f"- 连续学习天数: {self.daily_streak} 天")
            lines.append(f"- 偏好练习模式: {self.preferred_practice_mode}")

        # 薄弱点
        if self.error_prone_topics:
            lines.append(f"\n## 易错知识点")
            for t in self.error_prone_topics[:8]:
                lines.append(f"- {t.get('topic', '未知')} (错误 {t.get('error_count', 0)} 次)")

        # 掌握度概览
        if self.existing_mastery:
            mastered = sum(1 for s in self.existing_mastery.values() if s >= 80)
            weak = sum(1 for s in self.existing_mastery.values() if 0 < s < 40)
            lines.append(f"\n## 掌握度概览")
            lines.append(f"- 总知识点: {len(self.existing_mastery)}")
            lines.append(f"- 已掌握 (≥80%): {mastered}")
            lines.append(f"- 薄弱 (<40%): {weak}")

        return "\n".join(lines)


# ═══════════════════════════════════════════════════════
#  路径生成请求 / 响应
# ═══════════════════════════════════════════════════════

class PathGenerationRequest(BaseModel):
    """POST /path/generate 请求体"""
    subject_id: str
    goal_type: str = ""               # 学期提升 / 升学备考 / 考级考证
    goal_description: str = ""
    target_score: str = ""
    deadline: str = ""                # YYYY-MM-DD


class PhaseInfo(BaseModel):
    """路径阶段"""
    name: str                         # 阶段名称（如"基础巩固"）
    days: int                         # 阶段天数
    focus: str                        # 阶段重点
    node_ids: List[str] = Field(default_factory=list)  # 该阶段包含的知识点ID
    node_names: List[str] = Field(default_factory=list)


class DailySuggestion(BaseModel):
    """每日学习建议"""
    recommended_session_minutes: int = 90
    best_time: str = "下午"
    tasks_per_day: int = 3
    note: str = ""


class PathGenerationResponse(BaseModel):
    """POST /path/generate 响应体 — 个性化路径"""
    path_id: str = ""
    path_name: str = ""               # 路径名称
    description: str = ""             # 路径总体描述
    total_days: int = 0
    total_nodes: int = 0

    phases: List[PhaseInfo] = Field(default_factory=list)
    daily_suggestion: Optional[DailySuggestion] = None

    strategy_notes: List[str] = Field(default_factory=list)  # 个性化策略说明
    generation_reason: str = ""       # 生成理由

    # 完整的节点列表（供前端渲染）
    nodes: List[Dict[str, Any]] = Field(default_factory=list)
    edges: List[Dict[str, Any]] = Field(default_factory=list)


class ApiCheckResponse(BaseModel):
    """检查用户 LLM API 是否可用"""
    has_llm: bool = False
    has_cognitive_data: bool = False
    message: str = ""
    providers: List[str] = Field(default_factory=list)


class StyleAssessmentRequest(BaseModel):
    """学习风格评估提交"""
    q1: str = ""   # 学习新知识偏好: video/doc/practice/audio/unknown
    q2: str = ""   # 复习方式偏好: mindmap/exercise/notes/discuss/unknown
    q3: str = ""   # 高效时段: morning/afternoon/evening/night/unknown


class StyleAssessmentResponse(BaseModel):
    """学习风格评估结果"""
    cognitive_style: str = "mixed"
    active_hours: Dict[str, float] = Field(default_factory=dict)
    message: str = "评估完成"


class ConfirmPathRequest(BaseModel):
    """POST /path/confirm 请求体 — 确认AI生成的路径"""
    goal_type: str = ""
    goal_description: str = ""
    subject_id: str = ""
    generated_path: Dict[str, Any] = Field(default_factory=dict)  # PathGenerationResponse 的序列化结果


class ConfirmPathResponse(BaseModel):
    """POST /path/confirm 响应体"""
    state_id: str = ""
    message: str = ""
    phase: str = "learning"
    total_nodes: int = 0
