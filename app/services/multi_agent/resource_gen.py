"""ResourceGenAgent — 按知识点生成5类独立资源

为每个知识点独立生成5类固定资源，知识点之间完全隔离。
每组固定包含：视频脚本、代码案例、题库练习、知识文档、思维导图
"""

import asyncio
import logging
from typing import List, Optional, Dict, Any
from app.services.multi_agent.state import AgentState, ResourceItem, AGENT_RESOURCE_GEN
from app.services.multi_agent.llm import get_llm
from app.models.resource import KnowledgeResource
from app.db.database import SessionLocal

logger = logging.getLogger(__name__)

# 5类固定资源的系统提示词
PROMPTS = {
    "video_script": """你是一个教学视频脚本创作专家。请根据指定的知识点，创作一份短视频教学脚本。

要求：
- 标题格式：【{kp}】教学视频脚本
- 时长约3-5分钟
- 口语化、节奏感强，适合口播
- 在[画面:]处说明应展示的视觉效果
- 包含：开场引入、核心讲解、总结回顾三个部分

输出纯 Markdown 内容，不要额外解释。""",

    "code_case": """你是一个编程教育专家。请根据指定的知识点，设计一份代码实操案例。

要求：
- 标题格式：【{kp}】代码实操案例
- 包含：案例描述、学习目标、核心知识点、完整可运行代码、关键代码说明
- 代码带中文注释
- 难度适中，适合学生跟着操作
- 输出纯 Markdown 内容（含代码块），不要额外解释。""",

    "exercise": """你是一个教育出题专家。请根据指定的知识点，出一份练习题，包含5道题目。

严格按照以下 JSON 格式输出，只输出 JSON：
{
  "exercises": [
    {
      "type": "single_choice | multiple_choice | true_false | fill_blank",
      "difficulty": "basic | advanced",
      "stem": "题目内容",
      "options": {"A": "选项", "B": "选项", "C": "选项", "D": "选项"},
      "answer": "正确答案",
      "explanation": "解题思路"
    }
  ]
}
要求：5道题覆盖核心概念，难度循序渐进，含答案和详细解析。""",

    "document": """你是一个专业知识讲解专家。请根据指定的知识点，撰写一份详细的知识讲解文档。

要求：
- 标题格式：【{kp}】知识讲解文档
- 覆盖：核心概念定义、关键性质/定理、典型应用场景、常见易错点
- 每个核心点配1个小例子帮助理解
- 语言直白易懂，避免晦涩术语
- 800-1200字
- 输出纯 Markdown 格式，不要额外解释。""",

    "mind_map": """你是一个知识梳理专家。根据指定的知识点，生成结构化的思维导图内容（Markdown 列表格式）。

要求：
- 标题格式：【{kp}】思维导图
- 一级标题 # 知识点名称
- 使用 ## 二级标题表示子主题
- 使用 - 列表项表示具体要点
- 缩进2空格表示层级关系
- 层次分明，覆盖核心概念、分类、原理、应用
- 只输出 Markdown 内容，不要额外解释。""",
}

RESOURCE_TYPE_MAP = {
    "video_script": {"type": "video_script", "label": "教学视频脚本"},
    "code_case": {"type": "code_case", "label": "代码实操案例"},
    "exercise": {"type": "exercise", "label": "练习题"},
    "document": {"type": "document", "label": "知识讲解文档"},
    "mind_map": {"type": "mind_map", "label": "思维导图"},
}

FIXED_TYPES = ["video_script", "code_case", "exercise", "document", "mind_map"]


async def _generate_one(kp: str, res_type: str, api_key=None, api_base=None, api_model=None) -> Optional[ResourceItem]:
    """为单个知识点生成一类资源"""
    prompt = PROMPTS.get(res_type)
    if not prompt:
        return None
    cfg = RESOURCE_TYPE_MAP[res_type]
    is_json = res_type == "exercise"

    llm = get_llm()
    system_prompt = prompt.format(kp=kp)
    user_prompt = f"请为知识点「{kp}」生成{cfg['label']}内容。"

    try:
        if is_json:
            result_data = await llm.chat_json(
                system_prompt=system_prompt, user_prompt=user_prompt,
                temperature=0.5, max_tokens=4096,
                api_key=api_key, base_url=api_base, model=api_model,
            )
            content = __import__('json').dumps(result_data, ensure_ascii=False) if result_data else None
        else:
            content = await llm.chat(
                system_prompt=system_prompt, user_prompt=user_prompt,
                temperature=0.7, max_tokens=4096,
                api_key=api_key, base_url=api_base, model=api_model,
            )
        if not content:
            return None
        return ResourceItem(
            resource_type=cfg["type"],
            title=f"{kp} — {cfg['label']}",
            content=content,
            knowledge_points=[kp],
            source="agent_generated",
            metadata={"kp": kp, "res_type": res_type},
        )
    except Exception as e:
        logger.error(f"[ResourceGen] {kp}/{res_type}: {e}")
        return None


def _save(db: SessionLocal, student_id: str, item: ResourceItem) -> Optional[str]:
    try:
        r = KnowledgeResource(
            user_id=student_id,
            title=item["title"],
            resource_type=item["resource_type"],
            content=item["content"],
            knowledge_points=item["knowledge_points"],
            source="agent_generated",
            tags=["agent_generated", f"kp_{item['knowledge_points'][0]}"],
            # 所有资源公开，不同用户都能看到
            is_public=True,
        )
        db.add(r); db.commit(); db.refresh(r)
        rid = str(r.id)
        logger.info(f"[ResourceGen] 已保存 {item['title']} ({rid[:8]})")
        return rid
    except Exception as e:
        logger.error(f"[ResourceGen] 保存失败: {e}")
        db.rollback()
        return None


async def resource_gen_agent(state: AgentState) -> AgentState:
    """为每个知识点独立生成5类固定资源"""
    kps = state.get("knowledge_points", [])
    student_id = state.get("student_id", "")
    api_key = state.get("api_key")
    api_base = state.get("api_base_url")
    api_model = state.get("api_model")

    state["current_agent"] = AGENT_RESOURCE_GEN
    state["progress"] = 0.4
    state["resources"] = []
    state["generated_types"] = []

    if not kps:
        logger.warning("[ResourceGenAgent] 无知识点")
        state["progress"] = 0.8
        return state

    logger.info(f"[ResourceGenAgent] 为 {len(kps)} 个知识点各生成5类资源: {kps}")

    all_resources = []
    gen_types = set()
    step = 0.4 / max(len(kps) * len(FIXED_TYPES), 1)

    # 为每个知识点生成5类资源
    for kp in kps:
        for rt in FIXED_TYPES:
            item = await _generate_one(kp, rt, api_key, api_base, api_model)
            if item:
                db = SessionLocal()
                rid = _save(db, student_id, item)
                db.close()
                if rid:
                    item["id"] = rid
                    all_resources.append(item)
                    gen_types.add(item["resource_type"])
            state["progress"] += step

    state["resources"] = all_resources
    state["generated_types"] = list(gen_types)

    logger.info(f"[ResourceGenAgent] 完成: 共生成 {len(all_resources)} 个资源")
    return state
