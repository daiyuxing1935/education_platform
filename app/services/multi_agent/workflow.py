"""多智能体工作流构建

使用 LangGraph StateGraph 编排 4 个 Agent 的执行顺序：
SchedulerAgent → ProfileAgent → ResourceGenAgent → PathPushAgent

支持并行资源生成（ResourceGenAgent 内部使用 asyncio.gather）
支持状态持久化（MemorySaver）
支持错误降级（add_conditional_edges）
"""

import logging
from typing import Optional, Dict, Any, List

from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver

from app.services.multi_agent.state import (
    AgentState, AGENT_SCHEDULER, AGENT_PROFILE,
    AGENT_RESOURCE_GEN, AGENT_PATH_PUSH, ALL_RESOURCE_TYPES,
)
from app.services.multi_agent.scheduler import scheduler_agent
from app.services.multi_agent.profile import profile_agent
from app.services.multi_agent.resource_gen import resource_gen_agent
from app.services.multi_agent.path_push import path_push_agent

logger = logging.getLogger(__name__)

# 全局工作流实例
_workflow: Optional[StateGraph] = None
_app = None


def _route_after_scheduler(state: AgentState) -> str:
    """SchedulerAgent 后的路由：出错则终止，否则进入 ProfileAgent"""
    if state.get("error") or state.get("task_status") == "failed":
        return END
    return AGENT_PROFILE


def _route_after_profile(state: AgentState) -> str:
    """ProfileAgent 后的路由"""
    if state.get("error") or state.get("task_status") == "failed":
        return END
    return AGENT_RESOURCE_GEN


def _route_after_resource_gen(state: AgentState) -> str:
    """ResourceGenAgent 后的路由"""
    if state.get("error") or state.get("task_status") == "failed":
        return END
    return AGENT_PATH_PUSH


def create_multi_agent_graph() -> StateGraph:
    """构建多智能体工作流图

    流程：
    START → SchedulerAgent → ProfileAgent → ResourceGenAgent → PathPushAgent → END
                                     ↑ 出错时直接跳 END
    """
    global _workflow, _app

    if _workflow is not None:
        return _workflow

    logger.info("[Workflow] 正在构建多智能体工作流图...")

    # 创建 StateGraph
    workflow = StateGraph(AgentState)

    # 注册 4 个 Agent 节点
    # 注意：Agent 函数本身运行在异步上下文中，但 LangGraph 节点需要是可调用的
    # 我们使用 async 函数直接注册
    workflow.add_node(AGENT_SCHEDULER, scheduler_agent)
    workflow.add_node(AGENT_PROFILE, profile_agent)
    workflow.add_node(AGENT_RESOURCE_GEN, resource_gen_agent)
    workflow.add_node(AGENT_PATH_PUSH, path_push_agent)

    # 定义执行边
    workflow.add_edge(START, AGENT_SCHEDULER)
    workflow.add_conditional_edges(AGENT_SCHEDULER, _route_after_scheduler)
    workflow.add_conditional_edges(AGENT_PROFILE, _route_after_profile)
    workflow.add_conditional_edges(AGENT_RESOURCE_GEN, _route_after_resource_gen)
    workflow.add_edge(AGENT_PATH_PUSH, END)

    # 使用 MemorySaver 持久化状态
    memory = MemorySaver()
    _app = workflow.compile(checkpointer=memory)

    _workflow = workflow
    logger.info("[Workflow] 多智能体工作流图构建完成")
    return workflow


def get_compiled_app():
    """获取已编译的工作流应用"""
    if _app is None:
        create_multi_agent_graph()
    return _app


async def run_agent_workflow(
    task_id: str,
    student_id: str,
    query: str,
    knowledge_points: Optional[List[str]] = None,
    resource_types: Optional[List[str]] = None,
    subject_id: Optional[str] = None,
    user_api_key: Optional[str] = None,
    user_api_base: Optional[str] = None,
    user_api_model: Optional[str] = None,
) -> Dict[str, Any]:
    """执行完整的 Agent 工作流

    Args:
        task_id: 任务 UUID
        student_id: 学生 UUID
        query: 用户查询
        knowledge_points: 可选，预先指定的知识点
        resource_types: 可选，指定生成的资源类型
        subject_id: 可选，指定学科
        user_api_key: 用户配置的 LLM API Key
        user_api_base: 用户配置的 base_url
        user_api_model: 用户配置的 model

    Returns:
        最终状态字典
    """
    app = get_compiled_app()

    from app.services.multi_agent.state import ALL_RESOURCE_TYPES

    initial_state: AgentState = {
        "messages": [],
        "task_id": task_id,
        "student_id": str(student_id),
        "task_status": "pending",
        "progress": 0.0,
        "current_agent": "",
        "error": None,
        "query": query,
        "knowledge_points": knowledge_points or [],
        "resource_types": resource_types or ALL_RESOURCE_TYPES[:4],
        "subject_id": subject_id,
        "api_key": user_api_key,
        "api_base_url": user_api_base,
        "api_model": user_api_model,
        "profile_data": None,
        "weak_points": [],
        "cognitive_style": None,
        "knowledge_mastery": {},
        "resources": [],
        "generated_types": [],
        "path_data": None,
        "path_id": None,
        "pushed_resource_ids": [],
    }

    # 配置：使用 task_id 作为线程 ID（LangGraph 的 checkpoint key）
    config = {"configurable": {"thread_id": task_id}}

    try:
        # 执行工作流
        logger.info(f"[Workflow] 开始执行任务 {task_id}")
        final_state = await app.ainvoke(initial_state, config)
        logger.info(f"[Workflow] 任务 {task_id} 完成，状态: {final_state.get('task_status', 'unknown')}")
        return final_state
    except Exception as e:
        logger.error(f"[Workflow] 任务 {task_id} 执行异常: {e}", exc_info=True)
        return {
            **initial_state,
            "task_status": "failed",
            "error": str(e),
            "progress": 0.0,
        }


async def get_task_status(task_id: str) -> Optional[Dict[str, Any]]:
    """查询任务执行状态（通过 LangGraph 的 get_state）"""
    app = get_compiled_app()
    config = {"configurable": {"thread_id": task_id}}

    try:
        state = await app.aget_state(config)
        if state is None:
            return None
        return dict(state.values)
    except Exception as e:
        logger.warning(f"[Workflow] 查询状态失败 {task_id}: {e}")
        return None


def get_simplified_status(full_state: Dict[str, Any]) -> Dict[str, Any]:
    """从完整状态中提取前端需要的关键字段"""
    resources_summary = []
    for r in full_state.get("resources", []):
        resources_summary.append({
            "id": r.get("id"),
            "title": r.get("title"),
            "resource_type": r.get("resource_type"),
            "knowledge_points": r.get("knowledge_points", []),
        })

    return {
        "task_id": full_state.get("task_id"),
        "task_status": full_state.get("task_status", "unknown"),
        "progress": full_state.get("progress", 0),
        "current_agent": full_state.get("current_agent", ""),
        "error": full_state.get("error"),
        "query": full_state.get("query", ""),
        "knowledge_points": full_state.get("knowledge_points", []),
        "generated_types": full_state.get("generated_types", []),
        "resources": resources_summary,
        "profile_summary": {
            "total_knowledge_points": len(full_state.get("knowledge_mastery", {})),
            "total_weak_points": len(full_state.get("weak_points", [])),
            "cognitive_style": full_state.get("cognitive_style"),
        } if full_state.get("knowledge_mastery") else None,
        "path_data": full_state.get("path_data"),
        "path_id": full_state.get("path_id"),
        "pushed_resource_ids": full_state.get("pushed_resource_ids", []),
    }
