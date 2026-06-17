"""PathPushAgent — 路径推送节点

职责：
1. 基于生成的资源和学生画像，规划个性化学习路径
2. 将资源绑定到路径中的知识点
3. 生成学习建议（学习顺序、重点、时间安排）
4. 将路径数据持久化到数据库
"""

import json
import logging
from typing import Optional, Dict, Any, List
from app.services.multi_agent.state import (
    AgentState, AGENT_PATH_PUSH, RESOURCE_TYPE_LABELS,
)
from app.services.multi_agent.llm import get_llm
from app.services.path_planner import PathPlanner
from app.db.neo4j import get_neo4j
from app.db.database import SessionLocal
from app.models.path import LearningPath

logger = logging.getLogger(__name__)

# 学习路径规划系统提示词
PATH_PLAN_PROMPT = """你是一个个性化学习路径规划助手。根据学生的画像、薄弱点和生成的资源，规划学习路径。

请严格按照以下 JSON 格式输出：
{
  "path_name": "学习路径名称",
  "description": "路径总体描述",
  "estimated_total_hours": 总预估小时数,
  "steps": [
    {
      "step_order": 1,
      "knowledge_point": "知识点名称",
      "focus": "学习重点",
      "estimated_minutes": 预估分钟数,
      "resources_to_use": ["资源标题1", "资源标题2"],
      "learning_objective": "学习目标",
      "difficulty": "beginner | intermediate | advanced"
    }
  ],
  "study_tips": ["建议1", "建议2", "建议3"],
  "priority_focus": "最需要优先学习的内容"
}

要求：
1. 按前置依赖关系排列步骤
2. 优先处理薄弱知识点
3. 每个步骤绑定适用的资源
4. 总时长合理（3-10小时）
5. 学习建议个性化（基于画像中的认知风格和薄弱点）"""


async def path_push_agent(state: AgentState) -> AgentState:
    """PathPushAgent 执行逻辑：规划路径 + 绑定资源 + 推送入库"""
    student_id = state.get("student_id", "")
    resources = state.get("resources", [])
    weak_points = state.get("weak_points", [])
    kps = state.get("knowledge_points", [])
    cognitive_style = state.get("cognitive_style")

    logger.info(f"[PathPushAgent] 开始规划学习路径，已有 {len(resources)} 个资源")

    state["current_agent"] = AGENT_PATH_PUSH
    state["progress"] = 0.85

    try:
        # 1. 尝试用 Neo4j PathPlanner 生成路径
        path_data = await _plan_with_neo4j(state)

        if path_data:
            logger.info(f"[PathPushAgent] Neo4j 路径规划成功，{len(path_data.get('nodes', []))} 个节点")
            state["path_data"] = path_data
        else:
            # 2. 降级：用 LLM 生成路径
            logger.info("[PathPushAgent] Neo4j 不可用，使用 LLM 规划路径")
            path_data = await _plan_with_llm(state)
            state["path_data"] = path_data

        # 3. 将路径保存到 PostgreSQL
        saved_path = _save_path_to_db(student_id, state)
        if saved_path:
            state["path_id"] = saved_path

        # 4. 收集已推送的资源 ID
        pushed_ids = [r.get("id") for r in resources if r.get("id")]
        state["pushed_resource_ids"] = pushed_ids

        state["progress"] = 1.0
        state["task_status"] = "completed"

        logger.info(
            f"[PathPushAgent] 完成: 路径已保存, "
            f"{len(pushed_ids)} 个资源已推送到路径"
        )

    except Exception as e:
        logger.error(f"[PathPushAgent] 失败: {e}", exc_info=True)
        state["error"] = f"路径规划失败: {str(e)}"
        state["task_status"] = "failed"

    return state


async def _plan_with_neo4j(state: AgentState) -> Optional[Dict[str, Any]]:
    """使用 Neo4j PathPlanner 生成路径"""
    try:
        neo4j = get_neo4j()
        if not neo4j.verify_connectivity():
            return None

        planner = PathPlanner(neo4j)
        result = await planner.plan(state.get("student_id", ""))

        # 如果 path_planner 返回了有效数据，增强它
        if result and result.get("nodes"):
            # 注入生成的资源信息
            resources = state.get("resources", [])
            for node in result.get("nodes", []):
                node_name = node.get("name", "")
                node_resources = [
                    {"title": r.get("title"), "type": r.get("resource_type"), "id": r.get("id")}
                    for r in resources
                    if node_name in (r.get("knowledge_points", []))
                ]
                if node_resources:
                    node["bound_resources"] = node_resources

            return result
        return None
    except Exception as e:
        logger.warning(f"[PathPushAgent] Neo4j 规划异常: {e}")
        return None


async def _plan_with_llm(state: AgentState) -> Dict[str, Any]:
    """使用 LLM 生成学习路径（降级方案）"""
    llm = get_llm()
    api_key = state.get("api_key")
    api_base_url = state.get("api_base_url")
    api_model = state.get("api_model")
    resources = state.get("resources", [])
    weak_points = state.get("weak_points", [])
    kps = state.get("knowledge_points", [])
    cognitive_style = state.get("cognitive_style")

    # 构建资源摘要
    resource_summary = []
    for r in resources:
        resource_summary.append(f"- {r.get('title')} ({RESOURCE_TYPE_LABELS.get(r.get('resource_type', ''), r.get('resource_type', ''))})")

    weak_summary = []
    for wp in weak_points[:5]:
        score = wp.get("score", 0)
        weak_summary.append(f"- {wp.get('name')} (掌握度: {score:.0%})")

    user_prompt = f"""学生信息：
- 知识点：{', '.join(kps)}
- 认知风格：{cognitive_style or '未确定'}
- 薄弱点：{chr(10).join(weak_summary) if weak_summary else '无明确薄弱点'}

已生成的资源：
{chr(10).join(resource_summary) if resource_summary else '暂无资源'}

请为该学生规划个性化学习路径。"""

    result = await llm.chat_json(
        system_prompt=PATH_PLAN_PROMPT,
        user_prompt=user_prompt,
        temperature=0.5,
        max_tokens=4096,
        api_key=api_key,
        base_url=api_base_url,
        model=api_model,
    )

    return result or {
        "path_name": f"{'、'.join(kps)} 学习路径",
        "description": "基于 LLM 自动生成的学习路径",
        "steps": [{"step_order": 1, "knowledge_point": kps[0] if kps else "知识点", "focus": "基础知识学习", "estimated_minutes": 60}],
        "study_tips": ["按顺序完成每个步骤"],
        "priority_focus": "重点攻克薄弱环节",
    }


def _save_path_to_db(student_id: str, state: AgentState) -> Optional[str]:
    """将路径保存到 PostgreSQL"""
    db = SessionLocal()
    try:
        path_data = state.get("path_data", {})

        # 匹配现有的 LearningPath 模型（仅有 path_data Text 字段）
        # 将结构化数据序列化为 JSON 字符串
        import json as _json
        path_json = _json.dumps(path_data, ensure_ascii=False, default=str)

        learning_path = LearningPath(
            user_id=student_id,
            path_data=path_json,
        )
        db.add(learning_path)
        db.commit()
        db.refresh(learning_path)
        return str(learning_path.id)
    except Exception as e:
        logger.error(f"[PathPushAgent] 保存路径失败: {e}")
        db.rollback()
        return None
    finally:
        db.close()
