"""SchedulerAgent — 调度节点

职责：
1. 接收任务请求，校验参数完整性
2. 初始化任务状态（student_id, query, knowledge_points）
3. 调用 LLM 从用户查询中提取知识点
4. 判断存储策略（持久化 / 临时）
5. 将状态传递给下一个 Agent
"""

import logging
from typing import Optional
from app.services.multi_agent.state import AgentState, AGENT_SCHEDULER, AGENT_PROFILE, ALL_RESOURCE_TYPES
from app.services.multi_agent.llm import get_llm

logger = logging.getLogger(__name__)

# 系统提示词：从用户查询中提取知识点
EXTRACT_KP_SYSTEM_PROMPT = """你是一个学习分析助手，负责从用户的提问中提取涉及的知识点。

请严格按照以下 JSON 格式输出：
{
  "knowledge_points": [
    {"name": "知识点名称", "relevance": "high/medium/low", "reason": "为什么提取这个知识点"}
  ],
  "resource_types_needed": ["mind_map", "document", "exercise", "code_case", "video"],
  "subject_hint": "可能的学科名称（如：计算机组成原理、数据结构等）"
}

提取规则：
1. 识别用户明确提到的知识点名称
2. 识别隐晦涉及但明确相关的知识点
3. 根据问题难度推荐需要生成的资源类型
4. subject_hint 字段推测用户可能在学的学科
"""


async def scheduler_agent(state: AgentState) -> AgentState:
    """SchedulerAgent 执行逻辑"""
    logger.info(f"[SchedulerAgent] 开始处理任务 {state.get('task_id', 'unknown')}")
    logger.info(f"[SchedulerAgent] 用户请求: {state.get('query', '')[:100]}")

    query = state.get("query", "").strip()
    if not query:
        state["error"] = "查询内容不能为空"
        state["task_status"] = "failed"
        state["current_agent"] = AGENT_SCHEDULER
        return state

    # 如果前端已提供知识点，跳过 LLM 提取
    kps = state.get("knowledge_points", [])
    if not kps:
        # 调用 LLM 提取知识点（使用用户配置的 API Key）
        llm = get_llm()
        result = await llm.chat_json(
            system_prompt=EXTRACT_KP_SYSTEM_PROMPT,
            user_prompt=f"请分析用户的学习请求，提取涉及的知识点和推荐资源类型：\n\n{query}",
            api_key=state.get("api_key"),
            base_url=state.get("api_base_url"),
            model=state.get("api_model"),
        )
        if result and "knowledge_points" in result:
            kps = [kp["name"] for kp in result["knowledge_points"]]
            state["knowledge_points"] = kps

            # 提取学科提示
            subject_hint = result.get("subject_hint")
            if subject_hint and not state.get("subject_id"):
                state["subject_id"] = subject_hint

            # 如果没有指定资源类型，使用 LLM 推荐的
            if not state.get("resource_types"):
                recommended = result.get("resource_types_needed", [])
                state["resource_types"] = recommended if recommended else ALL_RESOURCE_TYPES[:4]
            logger.info(f"[SchedulerAgent] LLM 提取知识点: {kps}")
        else:
            # LLM 调用失败时使用默认值
            logger.warning("[SchedulerAgent] LLM 提取失败，使用默认值")
            state["knowledge_points"] = ["未识别知识点"]
            state["resource_types"] = ALL_RESOURCE_TYPES[:3]

    # 确保 resource_types 有值
    if not state.get("resource_types"):
        state["resource_types"] = ALL_RESOURCE_TYPES[:4]

    # 初始化其他状态字段
    state["task_status"] = "running"
    state["progress"] = 0.1
    state["current_agent"] = AGENT_SCHEDULER
    state["resources"] = []
    state["generated_types"] = []
    state["profile_data"] = None
    state["weak_points"] = []
    state["path_data"] = None

    logger.info(f"[SchedulerAgent] 完成，提取到 {len(kps)} 个知识点")
    return state
