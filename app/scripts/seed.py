"""
种子数据脚本 — 在 app 启动时自动执行。

检查数据库中是否已有种子数据，若无则从 seed_data/data_structures_seed.json 加载。
使用 fixed UUID 保证每次运行可重复（幂等）。
"""
import json
import logging
import os
from uuid import UUID
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.db.neo4j import get_neo4j, Neo4jConnection
from app.models.question_bank import (
    Subject, KnowledgeDomain, KnowledgePoint, QuestionBank, Question,
)

logger = logging.getLogger("uvicorn")

# 系统种子用户 UUID（无实际用户与之对应，仅用于标识系统级题库）
SYSTEM_OWNER_ID = UUID("00000000-0000-0000-0000-000000000000")
SEED_BANK_NAME = "数据结构题库"
SEED_SUBJECT_NAME = "数据结构"
SEED_FILE = os.path.join(os.path.dirname(__file__), "..", "seed_data", "data_structures_seed.json")


def _sync_subject_to_neo4j(neo4j: Neo4jConnection, subject: Subject):
    """从 question_bank.py 复制的 Neo4j 同步函数"""
    with neo4j.connect().session() as session:
        session.run(
            "MERGE (s:Subject {uuid: $uuid}) SET s.name = $name",
            uuid=str(subject.id), name=subject.name
        )


def _sync_domain_to_neo4j(neo4j: Neo4jConnection, domain: KnowledgeDomain, subject_id: UUID):
    with neo4j.connect().session() as session:
        session.run(
            """
            MERGE (d:KnowledgeDomain {uuid: $uuid}) SET d.name = $name
            WITH d MATCH (s:Subject {uuid: $sid})
            MERGE (d)-[:BELONGS_TO]->(s)
            """, uuid=str(domain.id), name=domain.name, sid=str(subject_id)
        )


def _sync_point_to_neo4j(neo4j: Neo4jConnection, point: KnowledgePoint, domain_id: UUID):
    with neo4j.connect().session() as session:
        session.run(
            """
            MERGE (p:KnowledgePoint {uuid: $uuid})
            SET p.name = $name, p.description = $desc, p.difficulty = $diff
            WITH p MATCH (d:KnowledgeDomain {uuid: $did})
            MERGE (d)-[:HAS_SUB]->(p)
            """,
            uuid=str(point.id), name=point.name, desc=point.description or "",
            diff=point.difficulty, did=str(domain_id)
        )


def _sync_question_to_neo4j(neo4j: Neo4jConnection, question: Question):
    with neo4j.connect().session() as session:
        session.run("MERGE (q:Question {uuid: $uuid})", uuid=str(question.id))
        session.run(
            "MATCH (q:Question {uuid: $uuid})-[r:TESTS]->() DELETE r",
            uuid=str(question.id)
        )
        for kp_uuid in (question.knowledge_point_uuids or []):
            session.run(
                """
                MATCH (q:Question {uuid: $quid})
                MATCH (kp:KnowledgePoint {uuid: $kpuuid})
                MERGE (q)-[:TESTS]->(kp)
                """, quid=str(question.id), kpuuid=kp_uuid
            )


def _load_seed_json() -> Optional[dict]:
    """加载种子 JSON 文件"""
    path = os.path.abspath(SEED_FILE)
    if not os.path.exists(path):
        logger.warning(f"种子数据文件不存在: {path}")
        return None
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    logger.info(f"已加载种子数据: {data.get('bank', {}).get('name')} ({len(data.get('questions', []))} 题)")
    return data


def _subj_exists(db: Session, name: str) -> bool:
    return db.query(Subject).filter(Subject.name == name).first() is not None


def _bank_exists(db: Session, name: str) -> bool:
    return db.query(QuestionBank).filter(QuestionBank.name == name).first() is not None


def seed_database():
    """主入口 — 检查并插入种子数据"""
    data = _load_seed_json()
    if not data:
        return

    db: Session = SessionLocal()
    neo4j = get_neo4j()
    try:
        # 1. 检查是否已有种子数据
        if _bank_exists(db, SEED_BANK_NAME):
            logger.info(f"种子数据「{SEED_BANK_NAME}」已存在，跳过")
            return
        if _subj_exists(db, SEED_SUBJECT_NAME):
            logger.info(f"学科「{SEED_SUBJECT_NAME}」已存在但题库不存在，将创建题库")

        # 2. 插入或获取学科
        subj_data = data["subject"]
        subject = db.query(Subject).filter(Subject.name == subj_data["name"]).first()
        if not subject:
            subject = Subject(
                id=UUID(subj_data["id"]),
                name=subj_data["name"],
                description=subj_data.get("description"),
                sort_order=subj_data.get("sort_order", 0),
                creator_id=SYSTEM_OWNER_ID,
            )
            db.add(subject)
            db.flush()
            logger.info(f"创建学科: {subj_data['name']}")
            try:
                _sync_subject_to_neo4j(neo4j, subject)
            except Exception as e:
                logger.warning(f"Neo4j 同步学科失败: {e}")

        # 3. 插入领域/章节
        domain_id_map = {}  # old uuid str -> new KnowledgeDomain object
        for dom_data in data["domains"]:
            domain = db.query(KnowledgeDomain).filter(
                KnowledgeDomain.subject_id == subject.id,
                KnowledgeDomain.name == dom_data["name"]
            ).first()
            if not domain:
                domain = KnowledgeDomain(
                    id=UUID(dom_data["id"]),
                    subject_id=subject.id,
                    name=dom_data["name"],
                    description=dom_data.get("description"),
                    sort_order=dom_data.get("sort_order", 0),
                )
                db.add(domain)
                db.flush()
                try:
                    _sync_domain_to_neo4j(neo4j, domain, subject.id)
                except Exception as e:
                    logger.warning(f"Neo4j 同步领域失败: {e}")
            domain_id_map[dom_data["id"]] = domain

        # 4. 插入知识点
        kp_id_map = {}  # old uuid str -> new KnowledgePoint object
        for kp_data in data["knowledge_points"]:
            # 找到对应的 domain（基于 domain_id）
            domain = domain_id_map.get(kp_data.get("domain_id"))
            if not domain:
                logger.warning(f"跳过知识点 {kp_data['name']}: 未找到所属领域")
                continue
            kp = db.query(KnowledgePoint).filter(
                KnowledgePoint.domain_id == domain.id,
                KnowledgePoint.name == kp_data["name"]
            ).first()
            if not kp:
                kp = KnowledgePoint(
                    id=UUID(kp_data["id"]),
                    domain_id=domain.id,
                    name=kp_data["name"],
                    description=kp_data.get("description"),
                    video_url=kp_data.get("video_url"),
                    difficulty=kp_data.get("difficulty", 1),
                    sort_order=kp_data.get("sort_order", 0),
                )
                db.add(kp)
                db.flush()
                try:
                    _sync_point_to_neo4j(neo4j, kp, domain.id)
                except Exception as e:
                    logger.warning(f"Neo4j 同步知识点失败: {e}")
            kp_id_map[kp_data["id"]] = kp

        # 5. 创建题库
        bank_data = data["bank"]
        bank = QuestionBank(
            id=UUID(bank_data["id"]),
            owner_id=SYSTEM_OWNER_ID,
            subject_id=subject.id,
            name=bank_data["name"],
            description=bank_data.get("description", ""),
            visibility="public",
            total_questions=len(data["questions"]),
            tags=bank_data.get("tags", []),
        )
        db.add(bank)
        db.flush()
        logger.info(f"创建题库: {bank.name} (public, {bank.total_questions} 题)")

        # 6. 插入题目
        for q_data in data["questions"]:
            # 内容字段可能是 dict 或 JSON 字符串
            content = q_data.get("content")
            if isinstance(content, str):
                content = json.loads(content)

            answer = q_data.get("answer")
            if isinstance(answer, str):
                answer = json.loads(answer)

            kp_uuids = q_data.get("knowledge_point_uuids", [])
            if isinstance(kp_uuids, str):
                kp_uuids = json.loads(kp_uuids)

            tags = q_data.get("tags", [])
            if isinstance(tags, str):
                tags = json.loads(tags)

            question = Question(
                id=UUID(q_data["id"]),
                bank_id=bank.id,
                type=q_data.get("type", "single_choice"),
                difficulty=str(q_data.get("difficulty", "basic")),
                status=q_data.get("status", "published"),
                priority=q_data.get("priority", 0),
                content=content,
                answer=answer,
                knowledge_point_uuids=kp_uuids,
                tags=tags,
                ai_generated=q_data.get("ai_generated", False),
                source=q_data.get("source", "manual"),
                created_by=SYSTEM_OWNER_ID,
            )
            db.add(question)
            db.flush()

            try:
                _sync_question_to_neo4j(neo4j, question)
            except Exception as e:
                logger.warning(f"Neo4j 同步题目失败: {e}")

        db.commit()
        logger.info(f"种子数据加载完成: {len(data['questions'])} 题已插入")

    except Exception as e:
        db.rollback()
        logger.error(f"种子数据加载失败: {e}")
        raise
    finally:
        db.close()
