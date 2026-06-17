"""ProfileAgent — 画像节点

职责：
1. 从 Neo4j 读取学生画像（知识掌握度、认知风格、易错点）
2. 从 PostgreSQL 读取薄弱知识点记录
3. 整合为统一的 profile_data 供下游 Agent 使用
4. 不调用 LLM（纯数据读取）
"""

import logging
from typing import Optional, Dict, Any, List
from app.services.multi_agent.state import AgentState, AGENT_PROFILE, AGENT_RESOURCE_GEN
from app.db.neo4j import get_neo4j
from app.db.database import SessionLocal
from app.models.question_bank import KnowledgePointRecord, KnowledgePoint

logger = logging.getLogger(__name__)


async def profile_agent(state: AgentState) -> AgentState:
    """ProfileAgent 执行逻辑：读取学生画像"""
    student_id = state.get("student_id", "")
    logger.info(f"[ProfileAgent] 开始读取学生画像: {student_id[:8]}...")

    state["current_agent"] = AGENT_PROFILE
    state["progress"] = 0.3

    # 在函数内部创建独立的数据库会话
    db = SessionLocal()
    try:
        # 1. 从 Neo4j 获取画像数据
        neo4j = get_neo4j()
        neo4j_profile = {}
        try:
            if neo4j.verify_connectivity():
                neo4j_profile = neo4j.get_student_profile_data(student_id)
        except Exception as e:
            logger.warning(f"[ProfileAgent] Neo4j 连接失败: {e}")

        # 2. 从 PostgreSQL 获取知识点掌握度记录
        kp_records = (
            db.query(KnowledgePointRecord)
            .filter(KnowledgePointRecord.user_id == student_id)
            .all()
        )

        # 3. 整合画像数据
        knowledge_mastery = {}
        weak_points = []

        for kp in neo4j_profile.get("knowledge_mastery", []):
            name = kp.get("knowledge_point", "")
            score = kp.get("score", 0)
            if name:
                knowledge_mastery[name] = score
                if isinstance(score, (int, float)) and score < 0.6:
                    weak_points.append({"name": name, "score": score, "source": "neo4j"})

        for rec in kp_records:
            name = rec.point_name
            score = rec.mastery_score / 100.0 if rec.mastery_score else 0
            knowledge_mastery[name] = score
            if score < 0.6:
                weak_points.append({
                    "name": name, "score": score,
                    "consecutive_errors": rec.consecutive_errors or 0,
                    "source": "postgresql",
                })

        seen = set()
        unique_weak = []
        for wp in weak_points:
            if wp["name"] not in seen:
                seen.add(wp["name"])
                unique_weak.append(wp)
        unique_weak.sort(key=lambda x: x.get("score", 1))

        state["profile_data"] = {
            "knowledge_mastery": knowledge_mastery,
            "cognitive_style": neo4j_profile.get("cognitive_style"),
            "error_prone_topics": neo4j_profile.get("error_prone_topics", []),
            "total_knowledge_points": len(knowledge_mastery),
            "total_weak_points": len(unique_weak),
        }
        state["weak_points"] = unique_weak[:10]
        state["knowledge_mastery"] = knowledge_mastery
        state["cognitive_style"] = (
            neo4j_profile.get("cognitive_style", {}).get("style_type")
            if neo4j_profile.get("cognitive_style") else None
        )
        state["progress"] = 0.4

        logger.info(f"[ProfileAgent] 完成: 掌握度 {len(knowledge_mastery)} 个知识点, 薄弱 {len(unique_weak)} 个")

    except Exception as e:
        logger.error(f"[ProfileAgent] 读取画像失败: {e}", exc_info=True)
        state["profile_data"] = {"knowledge_mastery": {}, "cognitive_style": None}
        state["weak_points"] = []
        state["knowledge_mastery"] = {}
    finally:
        db.close()

    return state
