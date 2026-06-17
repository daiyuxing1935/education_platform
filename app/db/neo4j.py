from neo4j import GraphDatabase
from app.core.config import settings
from typing import Optional, Dict, List, Any
from datetime import datetime
import uuid


class Neo4jConnection:
    def __init__(self):
        self.driver = None

    def connect(self):
        if self.driver is None:
            self.driver = GraphDatabase.driver(
                settings.NEO4J_URI,
                auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD)
            )
        return self.driver

    def close(self):
        if self.driver:
            self.driver.close()
            self.driver = None

    def verify_connectivity(self) -> bool:
        try:
            driver = self.connect()
            driver.verify_connectivity()
            return True
        except Exception:
            return False

    def create_student_node(self, student_id: str) -> bool:
        with self.connect().session() as session:
            result = session.run(
                """
                MERGE (s:Student {student_id: $student_id})
                RETURN s
                """,
                student_id=student_id
            )
            return result.single() is not None

    def add_knowledge_mastery(
        self,
        student_id: str,
        knowledge_point: str,
        score: float = 0.0,
        confidence: float = 0.3,
        knowledge_point_uuid: Optional[str] = None,
    ) -> bool:
        with self.connect().session() as session:
            if knowledge_point_uuid:
                result = session.run(
                    """
                    MATCH (s:Student {student_id: $student_id})
                    MERGE (k:KnowledgePoint {uuid: $uuid})
                    SET k.name = $knowledge_point
                    MERGE (s)-[r:MASTERS]->(k)
                    SET r.score = $score,
                        r.confidence = $confidence,
                        r.last_updated = datetime()
                    RETURN r
                    """,
                    student_id=student_id,
                    knowledge_point=knowledge_point,
                    score=score,
                    confidence=confidence,
                    uuid=knowledge_point_uuid,
                )
            else:
                result = session.run(
                    """
                    MATCH (s:Student {student_id: $student_id})
                    MERGE (s)-[r:MASTERS]->(k:KnowledgePoint {name: $knowledge_point})
                    SET r.score = $score,
                        r.confidence = $confidence,
                        r.last_updated = datetime()
                    RETURN r
                    """,
                    student_id=student_id,
                    knowledge_point=knowledge_point,
                    score=score,
                    confidence=confidence,
                )
            return result.single() is not None

    def get_knowledge_mastery(self, student_id: str) -> List[Dict[str, Any]]:
        with self.connect().session() as session:
            result = session.run(
                """
                MATCH (s:Student {student_id: $student_id})-[r:MASTERS]->(k:KnowledgePoint)
                OPTIONAL MATCH (k)<-[:HAS_SUB]-(d:KnowledgeDomain)
                OPTIONAL MATCH (d)-[:BELONGS_TO]->(sub:Subject)
                RETURN k.name as knowledge_point,
                       k.uuid as knowledge_point_uuid,
                       r.score as score,
                       r.confidence as confidence,
                       r.last_updated as last_updated,
                       d.name as domain_name,
                       d.uuid as domain_uuid,
                       sub.name as subject_name,
                       sub.uuid as subject_uuid
                """,
                student_id=student_id
            )
            records = result.data()
            return records if records else []

    def update_knowledge_mastery(
        self,
        student_id: str,
        knowledge_point: str,
        score: Optional[float] = None,
        confidence: Optional[float] = None
    ) -> bool:
        with self.connect().session() as session:
            result = session.run(
                """
                MATCH (s:Student {student_id: $student_id})-[r:MASTERS]->(k:KnowledgePoint {name: $knowledge_point})
                SET
                    r.score = COALESCE($score, r.score),
                    r.confidence = COALESCE($confidence, r.confidence),
                    r.last_updated = datetime()
                RETURN r
                """,
                student_id=student_id,
                knowledge_point=knowledge_point,
                score=score,
                confidence=confidence
            )
            return result.single() is not None

    def delete_knowledge_mastery(self, student_id: str, knowledge_point: str) -> bool:
        with self.connect().session() as session:
            result = session.run(
                """
                MATCH (s:Student {student_id: $student_id})-[r:MASTERS]->(k:KnowledgePoint {name: $knowledge_point})
                DELETE r
                RETURN count(*) as deleted
                """,
                student_id=student_id,
                knowledge_point=knowledge_point
            )
            record = result.single()
            return record and record["deleted"] > 0

    def set_cognitive_style(
        self,
        student_id: str,
        style_type: str,
        confidence: float = 0.5
    ) -> bool:
        with self.connect().session() as session:
            result = session.run(
                """
                MATCH (s:Student {student_id: $student_id})
                MERGE (s)-[r:HAS_STYLE]->(c:CognitiveStyle {type: $style_type})
                SET r.confidence = $confidence,
                    r.last_updated = datetime()
                RETURN r
                """,
                student_id=student_id,
                style_type=style_type,
                confidence=confidence
            )
            return result.single() is not None

    def get_cognitive_style(self, student_id: str) -> Optional[Dict[str, Any]]:
        with self.connect().session() as session:
            result = session.run(
                """
                MATCH (s:Student {student_id: $student_id})-[r:HAS_STYLE]->(c:CognitiveStyle)
                RETURN c.type as style_type, r.confidence as confidence,
                       r.last_updated as last_updated
                """,
                student_id=student_id
            )
            record = result.single()
            return dict(record) if record else None

    def add_error_prone_topic(
        self,
        student_id: str,
        topic: str,
        error_count: int = 1
    ) -> bool:
        with self.connect().session() as session:
            result = session.run(
                """
                MATCH (s:Student {student_id: $student_id})
                MERGE (s)-[r:ERROR_PRONE]->(t:Topic {name: $topic})
                SET r.error_count = COALESCE(r.error_count, 0) + $error_count,
                    r.last_updated = datetime()
                RETURN r
                """,
                student_id=student_id,
                topic=topic,
                error_count=error_count
            )
            return result.single() is not None

    def get_error_prone_topics(self, student_id: str) -> List[Dict[str, Any]]:
        with self.connect().session() as session:
            result = session.run(
                """
                MATCH (s:Student {student_id: $student_id})-[r:ERROR_PRONE]->(t:Topic)
                OPTIONAL MATCH (kp:KnowledgePoint {name: t.name})
                OPTIONAL MATCH (kp)<-[:HAS_SUB]-(d:KnowledgeDomain)
                OPTIONAL MATCH (d)-[:BELONGS_TO]->(sub:Subject)
                RETURN t.name as topic, r.error_count as error_count,
                       r.last_updated as last_updated,
                       d.name as domain_name, d.uuid as domain_uuid,
                       sub.name as subject_name, sub.uuid as subject_uuid
                ORDER BY r.error_count DESC
                """,
                student_id=student_id
            )
            records = result.data()
            return records if records else []

    def get_student_profile_data(self, student_id: str) -> Dict[str, Any]:
        return {
            "knowledge_mastery": self.get_knowledge_mastery(student_id),
            "cognitive_style": self.get_cognitive_style(student_id),
            "error_prone_topics": self.get_error_prone_topics(student_id)
        }

    # ═══════════════════════════════════════════════════════════
    #  Dynamic Error-Prone Tags (F5)
    # ═══════════════════════════════════════════════════════════

    def tag_question_error_prone(self, question_id: str) -> bool:
        """Tag a question as error-prone in Neo4j (create :Tag + [:TAGGED] relationship)."""
        with self.connect().session() as session:
            result = session.run(
                """
                MATCH (q:Question {uuid: $question_id})
                MERGE (t:Tag {name: 'error_prone', type: 'error_prone'})
                MERGE (q)-[:TAGGED]->(t)
                RETURN t
                """,
                question_id=question_id,
            )
            return result.single() is not None

    def untag_question_error_prone(self, question_id: str) -> bool:
        """Remove error-prone tag from a question in Neo4j."""
        with self.connect().session() as session:
            result = session.run(
                """
                MATCH (q:Question {uuid: $question_id})-[r:TAGGED]->(t:Tag {type: 'error_prone'})
                DELETE r
                RETURN count(*) as deleted
                """,
                question_id=question_id,
            )
            record = result.single()
            return record and record["deleted"] > 0

    def get_error_prone_question_ids(self, student_id: str) -> List[str]:
        """Get question UUIDs that are both answered-wrong by the student and tagged as error-prone."""
        with self.connect().session() as session:
            result = session.run(
                """
                MATCH (s:Student {student_id: $student_id})-[:ANSWERED_WRONG]->(q:Question)-[:TAGGED]->(t:Tag {type: 'error_prone'})
                RETURN DISTINCT q.uuid as question_id
                """,
                student_id=student_id,
            )
            return [record["question_id"] for record in result.data()]

    def delete_student_data(self, student_id: str) -> bool:
        with self.connect().session() as session:
            result = session.run(
                """
                MATCH (s:Student {student_id: $student_id})
                DETACH DELETE s
                RETURN count(*) as deleted
                """,
                student_id=student_id
            )
            record = result.single()
            return record and record["deleted"] > 0

    # ═══════════════════════════════════════════════════════════
    #  Learning Path Planning (BE-04)
    # ═══════════════════════════════════════════════════════════

    def get_weak_knowledge_points(self, student_id: str, threshold: float = 0.5) -> List[Dict[str, Any]]:
        """获取学生掌握度低于阈值的薄弱知识点"""
        with self.connect().session() as session:
            result = session.run(
                """
                MATCH (s:Student {student_id: $student_id})-[r:MASTERS]->(k:KnowledgePoint)
                WHERE r.score < $threshold
                OPTIONAL MATCH (k)<-[:HAS_SUB]-(d:KnowledgeDomain)
                OPTIONAL MATCH (d)-[:BELONGS_TO]->(sub:Subject)
                RETURN k.name as name, k.uuid as uuid,
                       r.score as score, r.confidence as confidence,
                       d.name as domain_name, sub.name as subject_name
                ORDER BY r.score ASC
                """,
                student_id=student_id,
                threshold=threshold
            )
            return result.data() if result else []

    def get_prerequisite_upstream(self, kp_names: List[str], depth: int = 2) -> Dict[str, Any]:
        """沿 [:PREREQUISITE] 向上游扩展 depth 层，返回所有节点和关系"""
        if not kp_names:
            return {"nodes": [], "edges": []}
        with self.connect().session() as session:
            # Step 1: 获取所有上游节点（包含目标节点本身）
            result = session.run(
                f"""
                MATCH (k:KnowledgePoint)<-[:PREREQUISITE*0..{depth}]-(prereq:KnowledgePoint)
                WHERE k.name IN $kp_names
                RETURN DISTINCT prereq.name as name, prereq.uuid as uuid
                """,
                kp_names=kp_names
            )
            all_nodes = result.data()
            all_names = [n["name"] for n in all_nodes if n.get("name")]

            # Step 2: 获取所有节点间的 PREREQUISITE 边
            if all_names:
                edges_result = session.run(
                    """
                    MATCH (a:KnowledgePoint)-[r:PREREQUISITE]->(b:KnowledgePoint)
                    WHERE a.name IN $all_names AND b.name IN $all_names
                    RETURN DISTINCT a.name as source, b.name as target, 'PREREQUISITE' as type
                    """,
                    all_names=all_names
                )
                edges = edges_result.data()
            else:
                edges = []

            # 标记上游节点来源
            for n in all_nodes:
                if n.get("name") in kp_names:
                    n["source"] = "target"
                else:
                    n["source"] = "prerequisite"

            return {"nodes": all_nodes, "edges": edges}

    def get_related_graph(self, kp_names: List[str], depth: int = 1) -> List[Dict[str, Any]]:
        """沿 [:RELATED_TO] 向上下游各扩展 depth 层"""
        if not kp_names:
            return []
        with self.connect().session() as session:
            nodes_result = session.run(
                f"""
                MATCH (k:KnowledgePoint)-[:RELATED_TO*1..{depth}]-(related:KnowledgePoint)
                WHERE k.name IN $kp_names
                RETURN DISTINCT related.name as name, related.uuid as uuid,
                        'related' as source
                """,
                kp_names=kp_names,
                depth=depth
            )
            nodes = nodes_result.data()

            edges_result = session.run(
                """
                MATCH (a:KnowledgePoint)-[r:RELATED_TO]->(b:KnowledgePoint)
                WHERE a.name IN $kp_names OR b.name IN $kp_names
                RETURN DISTINCT a.name as source, b.name as target, 'RELATED_TO' as type
                """,
                kp_names=kp_names
            )
            edges = edges_result.data()

            return {"nodes": nodes, "edges": edges}

    def check_knowledge_point_exists(self, name: str) -> bool:
        """检查知识点是否在 Neo4j 中存在"""
        with self.connect().session() as session:
            result = session.run(
                """
                MATCH (k:KnowledgePoint {name: $name})
                RETURN k
                """,
                name=name
            )
            return result.single() is not None

    def get_all_prerequisite_edges(self) -> List[Dict[str, Any]]:
        """获取所有 PREREQUISITE 关系"""
        with self.connect().session() as session:
            result = session.run(
                """
                MATCH (a:KnowledgePoint)-[r:PREREQUISITE]->(b:KnowledgePoint)
                RETURN a.name as source, b.name as target
                """
            )
            return result.data() if result else []


neo4j_conn = Neo4jConnection()


def get_neo4j() -> Neo4jConnection:
    return neo4j_conn
