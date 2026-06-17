"""知识图谱 API — PDF 上传 + LLM 提取 + Neo4j/PostgreSQL 导入

POST /knowledge-graph/upload    上传 PDF，启动异步 KG 提取流水线
GET  /knowledge-graph/status    获取提取任务状态
GET  /knowledge-graph/list      列出已构建的知识图谱
"""

import asyncio, json, hashlib, logging, os, re, time, uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any

import fitz  # PyMuPDF
import httpx
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.database import get_db, SessionLocal
from app.api.dependencies import CurrentUser, get_current_user
from app.db.neo4j import get_neo4j

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/knowledge-graph", tags=["知识图谱"])

# ── 内存中的任务状态（生产环境应改用 Redis）──
_task_status: Dict[str, Dict[str, Any]] = {}

# ── LLM 抽取 Prompt ──
EXTRACTION_PROMPT = """你是一个知识图谱构建助手。从以下教材文本中提取「知识点实体」和它们之间的「关系」。

只输出 JSON，不要其他文字：
{
  "entities": [
    {"name": "知识点名称", "type": "concept|method|model|algorithm|framework|metric|technique", "difficulty": 1-5, "importance": 1-5}
  ],
  "triples": [
    {"subject": "实体A", "relation": "关系类型", "object": "实体B"}
  ]
}

关系类型: PREREQUISITE(学B前必须懂A), CONTAINS(A包含B), RELATED_TO(A与B紧密相关), APPLIES(A应用于B), DEPENDS_ON(A依赖B)

规则: 1)只提取学术/技术知识点 2)difficulty: 1=基础 3=中级 5=前沿 3)importance: 1=边缘 3=常规 5=核心 4)PREREQUISITE严格判断 5)每块≤15实体≤10关系"""

# ── 请求/响应模型 ──
class KGTaskStatus(BaseModel):
    task_id: str
    status: str  # pending / parsing / extracting / fusing / importing / done / failed
    progress: float = 0.0
    message: str = ""
    result: Optional[Dict] = None

class KGListResponse(BaseModel):
    knowledge_graphs: list


async def _run_extraction_pipeline(task_id: str, file_content: bytes, filename: str, api_key: str, user_id: str = None):
    """后台运行完整的 PDF→KG 流水线"""
    try:
        # ══ Stage 1: Parse PDF ══
        _update_task(task_id, "parsing", 0.05, "正在解析 PDF 文件...")
        doc = fitz.open(stream=file_content, filetype="pdf")
        total_pages = doc.page_count

        # Extract text by chunks
        chunks = []
        for page_num in range(total_pages):
            text = doc[page_num].get_text()
            if not text or len(text.strip()) < 100:
                continue
            paragraphs = [p.strip() for p in text.split('\n\n') if len(p.strip()) > 100]
            for para in paragraphs:
                if len(para) < 80:
                    continue
                chunk_id = hashlib.md5(f'p{page_num}_{len(chunks)}'.encode()).hexdigest()[:10]
                chunks.append({'id': chunk_id, 'page': page_num + 1, 'text': para[:800], 'char_count': min(len(para), 800)})
                if len(chunks) >= 100:  # Max 100 chunks for async processing
                    break
            if len(chunks) >= 100:
                break
        doc.close()

        _update_task(task_id, "parsing", 0.15, f"PDF 解析完成：{total_pages} 页, {len(chunks)} 个文本块")

        # ══ Stage 2: LLM Extraction ══
        _update_task(task_id, "extracting", 0.20, f"开始 LLM 实体抽取（{len(chunks)} 块）...")

        all_entities, all_triples = [], []
        for i, chunk in enumerate(chunks):
            progress = 0.20 + (i / len(chunks)) * 0.50
            _update_task(task_id, "extracting", progress, f"抽取中 [{i+1}/{len(chunks)}]...")

            try:
                async with httpx.AsyncClient(timeout=120) as client:
                    r = await client.post(
                        "https://api.deepseek.com/v1/chat/completions",
                        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                        json={
                            "model": "deepseek-chat",
                            "messages": [
                                {"role": "system", "content": EXTRACTION_PROMPT},
                                {"role": "user", "content": f"文本：{chunk['text']}\n请提取知识点实体和关系。"}
                            ],
                            "temperature": 0.3, "max_tokens": 2048,
                        }
                    )
                if r.status_code == 200:
                    content = r.json()["choices"][0]["message"]["content"]
                    try:
                        if content.strip().startswith("{"):
                            data = json.loads(content.strip())
                        else:
                            m = re.search(r'\{[\s\S]*\}', content)
                            data = json.loads(m.group(0)) if m else {"entities": [], "triples": []}
                        all_entities.append(data.get("entities", []))
                        all_triples.append(data.get("triples", []))
                    except:
                        pass
            except Exception as e:
                logger.warning(f"Chunk {i} extraction failed: {e}")

            await asyncio.sleep(0.3)  # Rate limit

        total_e = sum(len(e) for e in all_entities)
        total_t = sum(len(t) for t in all_triples)
        _update_task(task_id, "extracting", 0.70, f"抽取完成：{total_e} 实体, {total_t} 关系")

        # ══ Stage 3: Knowledge Fusion ══
        _update_task(task_id, "fusing", 0.75, "正在知识融合与实体消歧...")

        entities = {}
        for chunk_entities in all_entities:
            for e in chunk_entities:
                name = e.get('name', '').strip()
                if not name or len(name) < 2: continue
                if name not in entities:
                    entities[name] = {'name': name, 'type': e.get('type', 'concept'),
                                      'difficulty': e.get('difficulty', 3), 'importance': e.get('importance', 3), 'count': 1}
                else:
                    prev = entities[name]
                    prev['difficulty'] = round((prev['difficulty'] * prev['count'] + e.get('difficulty', 3)) / (prev['count'] + 1))
                    prev['importance'] = round((prev['importance'] * prev['count'] + e.get('importance', 3)) / (prev['count'] + 1))
                    prev['count'] += 1

        triples = {}
        for chunk_triples in all_triples:
            for t in chunk_triples:
                subj, obj, rel = t.get('subject', '').strip(), t.get('object', '').strip(), t.get('relation', 'RELATED_TO')
                if not subj or not obj or subj == obj: continue
                key = f'{subj}|{rel}|{obj}'
                if key not in triples:
                    triples[key] = {'subject': subj, 'relation': rel, 'object': obj, 'confidence': 0.8}
                else:
                    triples[key]['confidence'] = min(1.0, triples[key]['confidence'] + 0.1)

        # Convert DEPENDS_ON to PREREQUISITE
        for key, t in list(triples.items()):
            if t['relation'] == 'DEPENDS_ON':
                pk = f"{t['subject']}|PREREQUISITE|{t['object']}"
                if pk not in triples:
                    triples[pk] = {'subject': t['subject'], 'relation': 'PREREQUISITE', 'object': t['object'], 'confidence': 0.85}

        _update_task(task_id, "fusing", 0.85, f"融合完成：{len(entities)} 实体, {len(triples)} 关系")

        # ══ Stage 4: Import to Neo4j + PostgreSQL ══
        _update_task(task_id, "importing", 0.90, "正在导入 Neo4j 和 PostgreSQL...")

        # Neo4j
        neo4j = get_neo4j()
        if neo4j.verify_connectivity():
            with neo4j.connect().session() as s:
                for e in list(entities.values())[:200]:
                    s.run('MERGE (k:KnowledgePoint {name: $n}) SET k.type=$t, k.difficulty=$d, k.importance=$i',
                          n=e['name'], t=e['type'], d=e['difficulty'], i=e['importance'])
                for t in list(triples.values())[:300]:
                    try:
                        s.run(f"MATCH (a:KnowledgePoint {{name: $s}}), (b:KnowledgePoint {{name: $o}}) MERGE (a)-[:{t['relation']}]->(b)",
                              s=t['subject'], o=t['object'])
                    except: pass

        # PostgreSQL
        try:
            db = SessionLocal()
            now = datetime.now(timezone.utc).isoformat()
            subj_id = str(uuid.uuid4())
            db.execute(text("INSERT INTO subjects (id, name, description, creator_id, sort_order, created_at, updated_at) VALUES (:i, :n, :d, :u, 1, :c, :u)"),
                       {'i': subj_id, 'n': f'从{filename[:20]}提取', 'd': f'自动提取自PDF: {filename[:50]}', 'u': user_id, 'c': now})
            did = str(uuid.uuid4())
            db.execute(text("INSERT INTO knowledge_domains (id, subject_id, name, sort_order, created_at, updated_at) VALUES (:i, :s, :n, 1, :c, :u)"),
                       {'i': did, 's': subj_id, 'n': '自动提取', 'c': now, 'u': now})
            for i, e in enumerate(list(entities.values())[:200]):
                if e.get('importance', 3) < 3: continue
                pid = str(uuid.uuid4())
                db.execute(text("INSERT INTO knowledge_points (id, domain_id, name, difficulty, sort_order, description, created_at, updated_at) VALUES (:i, :d, :n, :diff, :o, :desc, :c, :u)"),
                           {'i': pid, 'd': did, 'n': e['name'], 'diff': e['difficulty'], 'o': i, 'desc': f'自动提取 · 重要性{e["importance"]}/5', 'c': now, 'u': now})
            db.commit()
            db.close()
        except Exception as e:
            logger.warning(f"PostgreSQL import failed: {e}")

        prereq_count = sum(1 for t in triples.values() if t['relation'] == 'PREREQUISITE')
        _update_task(task_id, "done", 1.0,
                     f"知识图谱构建完成！{len(entities)} 实体, {len(triples)} 关系, {prereq_count} 前置依赖",
                     result={"entities": len(entities), "triples": len(triples), "prerequisites": prereq_count,
                             "source": filename, "subject_id": subj_id,
                             "imported_to": ["Neo4j", "PostgreSQL"]})

    except Exception as e:
        logger.error(f"KG extraction failed: {e}", exc_info=True)
        _update_task(task_id, "failed", 0, f"构建失败: {str(e)[:200]}")


def _update_task(task_id: str, status: str, progress: float, message: str, result: Optional[Dict] = None):
    _task_status[task_id] = {"task_id": task_id, "status": status, "progress": progress, "message": message, "result": result}


# ═══════════════════════════════════════════════════════
#  API Endpoints
# ═══════════════════════════════════════════════════════

@router.post("/upload")
async def upload_pdf_for_kg(
    file: UploadFile = File(...),
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """上传 PDF 文件，启动知识图谱提取流水线"""
    # Validate file type
    if not file.filename or not file.filename.lower().endswith('.pdf'):
        raise HTTPException(400, detail="仅支持 PDF 文件")

    # Get user's API key
    from app.models.api_settings import ApiSettings
    api_setting = db.query(ApiSettings).filter(
        ApiSettings.user_id == str(current_user.student_id),
        ApiSettings.provider.in_(["deepseek", "qwen"]),
        ApiSettings.is_enabled == True,
    ).first()

    if not api_setting or not api_setting.api_key:
        raise HTTPException(400, detail="请先配置 DeepSeek 或 Qwen API Key 后再上传 PDF")

    # Read file
    content = await file.read()
    if len(content) > 50 * 1024 * 1024:  # 50MB limit
        raise HTTPException(400, detail="PDF 文件不能超过 50MB")
    if len(content) < 1000:
        raise HTTPException(400, detail="PDF 文件内容过少，无法提取")

    # Create task
    task_id = str(uuid.uuid4())[:8]
    _update_task(task_id, "pending", 0, f"已接收文件: {file.filename}")

    # Start background processing
    asyncio.create_task(_run_extraction_pipeline(task_id, content, file.filename or "unknown.pdf", api_setting.api_key, str(current_user.student_id)))

    return {"task_id": task_id, "message": "PDF 已上传，正在后台构建知识图谱", "filename": file.filename}


@router.get("/status")
async def get_kg_task_status(task_id: str = Query(...)):
    """查询知识图谱提取任务状态"""
    status = _task_status.get(task_id)
    if not status:
        raise HTTPException(404, detail="任务不存在或已过期")
    return status


@router.get("/graph")
async def get_knowledge_graph_data(
    subject_id: str = Query(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """获取指定学科的知识图谱可视化数据（节点 + 关系，仅种子或自己的学科）"""
    from app.models.question_bank import KnowledgePoint, KnowledgeDomain, Subject

    # 验证学科权限：仅种子学科或用户自己的学科可查看
    from sqlalchemy import or_
    from uuid import UUID
    seed_subject_id = UUID("d91a4645-ab5f-4819-8379-d9e6524f0937")
    sub = db.query(Subject).filter(
        Subject.id == subject_id,
        or_(Subject.id == seed_subject_id, Subject.creator_id == current_user.student_id)
    ).first()
    if not sub:
        raise HTTPException(404, detail="学科不存在或无权访问")
    from app.models.question_bank import KnowledgePoint, KnowledgeDomain

    # 1. 从 PostgreSQL 获取该学科的所有知识点
    kps = (
        db.query(KnowledgePoint)
        .join(KnowledgeDomain, KnowledgePoint.domain_id == KnowledgeDomain.id)
        .filter(KnowledgeDomain.subject_id == subject_id)
        .order_by(KnowledgePoint.sort_order)
        .all()
    )

    # 2. 构建节点（按领域分组）
    domains_cache: dict = {}
    domain_rows = (
        db.query(KnowledgeDomain)
        .filter(KnowledgeDomain.subject_id == subject_id)
        .order_by(KnowledgeDomain.sort_order)
        .all()
    )
    for d in domain_rows:
        domains_cache[str(d.id)] = d.name

    # 按领域分组节点（保持 sort_order）
    domain_kps: dict[str, list] = {}
    for kp in kps:
        domain_name = domains_cache.get(str(kp.domain_id), "未知")
        node = {
            "id": str(kp.id),
            "name": kp.name,
            "domain_id": str(kp.domain_id),
            "domain_name": domain_name,
            "difficulty": kp.difficulty or 3,
            "sort_order": kp.sort_order or 0,
        }
        domain_kps.setdefault(str(kp.domain_id), []).append(node)

    # 展平为节点列表，同时记录各领域的节点
    nodes = []
    domain_nodes_ordered: list[list[dict]] = []  # 保持领域顺序
    for d in domain_rows:
        did = str(d.id)
        d_nodes = domain_kps.get(did, [])
        d_nodes.sort(key=lambda x: x["sort_order"])
        domain_nodes_ordered.append(d_nodes)
        nodes.extend(d_nodes)

    # 3. 从 Neo4j 获取知识点之间的关系
    edges = []
    try:
        neo4j = get_neo4j()
        if neo4j.verify_connectivity():
            kp_names = [n["name"] for n in nodes if n["name"]]
            if kp_names:
                with neo4j.connect().session() as neo4j_session:
                    result = neo4j_session.run(
                        """
                        MATCH (a:KnowledgePoint)-[r]->(b:KnowledgePoint)
                        WHERE a.name IN $names AND b.name IN $names
                        RETURN a.name as source_name, b.name as target_name,
                               type(r) as relation
                        """,
                        names=kp_names,
                    )
                    for record in result:
                        source_name = record.get("source_name", "")
                        target_name = record.get("target_name", "")
                        relation = record.get("relation", "RELATED_TO")
                        source_node_n = next(
                            (n for n in nodes if n["name"] == source_name), None
                        )
                        target_node_n = next(
                            (n for n in nodes if n["name"] == target_name), None
                        )
                        if source_node_n and target_node_n:
                            edges.append({
                                "source": source_node_n["id"],
                                "target": target_node_n["id"],
                                "relation": relation,
                            })
    except Exception as e:
        logger.warning(f"Neo4j query failed: {e}")

    # 4. 如果 Neo4j 没有返回关系，从 PostgreSQL 结构推导
    if not edges and len(domain_nodes_ordered) >= 1:
        edge_set: set[str] = set()
        for d_nodes in domain_nodes_ordered:
            # 领域内：按 sort_order 连接 PREREQUISITE 链
            for i in range(len(d_nodes) - 1):
                key = f"{d_nodes[i]['id']}|PREREQUISITE|{d_nodes[i+1]['id']}"
                if key not in edge_set:
                    edge_set.add(key)
                    edges.append({
                        "source": d_nodes[i]["id"],
                        "target": d_nodes[i+1]["id"],
                        "relation": "PREREQUISITE",
                    })
            # 领域内：相邻节点添加 RELATED_TO 关联
            for i in range(len(d_nodes) - 1):
                key = f"{d_nodes[i]['id']}|RELATED_TO|{d_nodes[i+1]['id']}"
                if key not in edge_set:
                    edge_set.add(key)
                    edges.append({
                        "source": d_nodes[i]["id"],
                        "target": d_nodes[i+1]["id"],
                        "relation": "RELATED_TO",
                    })

        # 领域间：前一个领域的最后一个 → 后一个领域的第一个
        for di in range(len(domain_nodes_ordered) - 1):
            prev_last = domain_nodes_ordered[di][-1] if domain_nodes_ordered[di] else None
            next_first = domain_nodes_ordered[di + 1][0] if domain_nodes_ordered[di + 1] else None
            if prev_last and next_first:
                key = f"{prev_last['id']}|PREREQUISITE|{next_first['id']}"
                if key not in edge_set:
                    edge_set.add(key)
                    edges.append({
                        "source": prev_last["id"],
                        "target": next_first["id"],
                        "relation": "PREREQUISITE",
                    })

    return {"nodes": nodes, "edges": edges}


@router.get("/list")
async def list_knowledge_graphs(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """列出已构建的知识图谱（仅种子学科 + 用户自己创建的学科）"""
    from app.models.question_bank import Subject, KnowledgeDomain, KnowledgePoint
    from sqlalchemy import or_
    from uuid import UUID

    seed_subject_id = UUID("d91a4645-ab5f-4819-8379-d9e6524f0937")
    subjects = db.query(Subject).filter(
        or_(Subject.id == seed_subject_id, Subject.creator_id == current_user.student_id)
    ).order_by(Subject.sort_order, Subject.name).all()

    result = []
    for s in subjects:
        domains = db.query(KnowledgeDomain).filter(KnowledgeDomain.subject_id == s.id).all()
        d_count = len(domains)
        pts = 0
        for d in domains:
            pts += db.query(KnowledgePoint).filter(KnowledgePoint.domain_id == d.id).count()
        result.append({
            "id": str(s.id), "name": s.name, "description": s.description or "",
            "domains": d_count, "knowledge_points": pts,
        })
    return {"knowledge_graphs": result}
