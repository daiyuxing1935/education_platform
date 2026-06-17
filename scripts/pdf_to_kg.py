"""
PDF → 知识图谱 构建流水线

Stage 1: PDF 解析与内容预处理
Stage 2: 语义分块
Stage 3: LLM 实体与关系抽取
Stage 4: 知识融合与实体消歧
Stage 5: 输出（导入 Neo4j + PostgreSQL）

用法: python scripts/pdf_to_kg.py <pdf_path>
"""

import os, sys, re, json, time, hashlib
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple, Set
from collections import defaultdict
from dataclasses import dataclass, field

import fitz  # PyMuPDF
import tiktoken
import httpx

# ── 配置 ──
CHUNK_SIZE = 1200      # token，每个文本块大小
CHUNK_OVERLAP = 100    # token，块间重叠
LLM_MODEL = "deepseek-chat"
LLM_BASE_URL = "https://api.deepseek.com/v1"
LLM_TIMEOUT = 120.0    # 秒

# 需要过滤的无关内容模式
FILTER_PATTERNS = [
    r'^\d+\.\d+\.\d+\s',      # 编号
    r'^习题\s*\d*',            # 习题标题
    r'^思考题',                # 思考题
    r'^参考文献',              # 参考文献
    r'^图\d+[\.\s]',          # 图注
    r'^表\d+[\.\s]',          # 表注
    r'^\s*$\n',               # 纯空行
]

# 需要保留的章节标题模式
CHAPTER_PATTERNS = [
    r'^第[一二三四五六七八九十\d]+章\s',  # 第X章
    r'^\d+\.\d+\s+\S',                   # X.Y 节标题
    r'^\d+\.\d+\.\d+\s+\S',              # X.Y.Z 小节标题
]


@dataclass
class TextChunk:
    """文本块"""
    id: str
    text: str
    chapter: str = ""
    section: str = ""
    page_start: int = 0
    page_end: int = 0
    token_count: int = 0


@dataclass
class KnowledgeTriple:
    """知识三元组"""
    subject: str        # 实体A
    relation: str       # 关系类型
    object: str         # 实体B
    confidence: float = 1.0
    source_chunk: str = ""


@dataclass
class KnowledgeGraph:
    """知识图谱"""
    entities: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    triples: List[KnowledgeTriple] = field(default_factory=list)
    chapters: Dict[str, List[str]] = field(default_factory=dict)  # chapter → entities


# ═══════════════════════════════════════════════════════
#  Stage 1: PDF 解析与内容预处理
# ═══════════════════════════════════════════════════════

class PDFParser:
    """PDF 解析器 — 提取文本、识别章节层级、过滤无关内容"""

    def __init__(self, pdf_path: str):
        self.doc = fitz.open(pdf_path)
        self.toc = self._parse_toc()

    def _parse_toc(self) -> List[Dict]:
        """解析目录结构"""
        raw_toc = self.doc.get_toc()
        chapters = []
        current_chapter = None
        for level, title, page in raw_toc:
            title = title.strip()
            if not title:
                continue
            node = {"level": level, "title": title, "page": page, "children": []}
            if level == 1:
                current_chapter = node
                chapters.append(node)
            elif level >= 2 and current_chapter is not None:
                current_chapter["children"].append(node)
        return chapters

    def extract_text_by_chapter(self) -> List[Dict[str, Any]]:
        """按章节提取文本，过滤页眉页脚"""
        chapters = []
        for i, ch in enumerate(self.toc):
            start_page = ch["page"] - 1  # 0-indexed
            # 确定结束页
            if i + 1 < len(self.toc):
                end_page = self.toc[i + 1]["page"] - 1
            else:
                end_page = self.doc.page_count

            # 提取该章节的文本
            texts = []
            for p in range(start_page, min(end_page, self.doc.page_count)):
                page = self.doc[p]
                text = page.get_text()
                # 过滤页眉页脚（通常在前3行和后3行）
                lines = text.split('\n')
                if len(lines) > 10:
                    lines = lines[3:-3]  # 去掉可能的页眉页脚
                text = '\n'.join(lines)
                texts.append(text)

            full_text = '\n'.join(texts)
            chapters.append({
                "title": ch["title"],
                "level": ch["level"],
                "start_page": start_page,
                "end_page": end_page,
                "text": full_text,
                "children": self._extract_sections(ch, start_page, end_page),
            })

        return chapters

    def _extract_sections(self, chapter: Dict, start_page: int, end_page: int) -> List[Dict]:
        """提取章节下的节"""
        sections = []
        for i, sec in enumerate(chapter.get("children", [])):
            sec_start = sec["page"] - 1
            if i + 1 < len(chapter["children"]):
                sec_end = chapter["children"][i + 1]["page"] - 1
            else:
                sec_end = end_page

            texts = []
            for p in range(max(sec_start, start_page), min(sec_end, end_page)):
                page = self.doc[p]
                text = page.get_text()
                lines = text.split('\n')
                if len(lines) > 10:
                    lines = lines[3:-3]
                texts.append('\n'.join(lines))

            sections.append({
                "title": sec["title"],
                "start_page": max(sec_start, start_page),
                "end_page": min(sec_end, end_page),
                "text": '\n'.join(texts),
            })

        return sections

    def close(self):
        self.doc.close()


# ═══════════════════════════════════════════════════════
#  Stage 2: 语义分块
# ═══════════════════════════════════════════════════════

class TextChunker:
    """语义分块器 — 按章节边界优先，token 限制内切分"""

    def __init__(self, model_name: str = "gpt-4o"):
        try:
            self.enc = tiktoken.get_encoding("o200k_base")
        except Exception:
            self.enc = tiktoken.get_encoding("cl100k_base")
        self.chunk_size = CHUNK_SIZE
        self.overlap = CHUNK_OVERLAP

    def chunk_chapter(self, chapter: Dict) -> List[TextChunk]:
        """对单个章节进行分块"""
        chunks = []
        # 优先对节分块
        for sec in chapter.get("children", []) or []:
            sec_chunks = self._chunk_text(
                text=sec.get("text", ""),
                chapter=chapter["title"],
                section=sec.get("title", ""),
                page_start=sec.get("start_page", 0),
                page_end=sec.get("end_page", 0),
            )
            chunks.extend(sec_chunks)

        # 如果节的文本太少或没有节，则按整章分块
        if not chunks or sum(c.token_count for c in chunks) < 100:
            chunks = self._chunk_text(
                text=chapter.get("text", ""),
                chapter=chapter["title"],
                section="",
                page_start=chapter.get("start_page", 0),
                page_end=chapter.get("end_page", 0),
            )

        return chunks

    def _chunk_text(
        self, text: str, chapter: str, section: str,
        page_start: int, page_end: int,
    ) -> List[TextChunk]:
        """将文本按 token 限制切分为块"""
        if not text or len(text.strip()) < 50:
            return []

        tokens = self.enc.encode(text)
        chunks = []
        start = 0
        chunk_idx = 0

        while start < len(tokens):
            end = min(start + self.chunk_size, len(tokens))
            chunk_tokens = tokens[start:end]
            chunk_text = self.enc.decode(chunk_tokens)

            chunk_id = hashlib.md5(
                f"{chapter}:{section}:{chunk_idx}".encode()
            ).hexdigest()[:12]

            chunks.append(TextChunk(
                id=chunk_id,
                text=chunk_text,
                chapter=chapter,
                section=section,
                page_start=page_start,
                page_end=page_end,
                token_count=len(chunk_tokens),
            ))

            start = end - self.overlap
            chunk_idx += 1

        return chunks


# ═══════════════════════════════════════════════════════
#  Stage 3: LLM 实体与关系抽取
# ═══════════════════════════════════════════════════════

ENTITY_EXTRACTION_PROMPT = """你是一个知识图谱构建助手。请从以下文本中提取「知识点实体」和它们之间的「关系」。

## 输出格式
严格输出 JSON，不要包含其他文字：
```json
{
  "entities": [
    {"name": "知识点名称", "type": "concept|method|model|algorithm|framework|metric|technique", "difficulty": 1-5, "importance": 1-5}
  ],
  "triples": [
    {"subject": "实体A", "relation": "关系类型", "object": "实体B"}
  ]
}
```

## 关系类型
- PREREQUISITE: A 是学习 B 的前置知识
- CONTAINS: A 包含 B（章节/领域关系）
- RELATED_TO: A 和 B 紧密相关
- APPLIES: A 应用于 B
- DEPENDS_ON: A 依赖于 B

## 规则
1. 只提取有意义的学术/技术知识点（模型、算法、概念、技术、框架），不提取人名、机构名
2. 难度评分: 1=基础入门概念, 3=中级技术, 5=前沿高级内容
3. 重要度评分: 1=边缘内容, 3=常规知识, 5=核心必学内容
4. PREREQUISITE 关系识别标准: 学习 B 之前是否必须理解 A？
5. 每块最多提取 15 个实体和 10 个关系
6. 实体名称使用标准术语，不同表述统一用最通用的名称"""


class TripleExtractor:
    """三元组抽取器 — 调用 LLM 从文本块抽取实体和关系"""

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = LLM_BASE_URL
        self.model = LLM_MODEL
        self.stats = {"chunks_processed": 0, "entities_extracted": 0, "triples_extracted": 0}

    async def extract_from_chunk(self, chunk: TextChunk) -> Tuple[List[Dict], List[Dict]]:
        """从单个文本块抽取实体和关系"""
        user_prompt = f"""## 上下文
章节: {chunk.chapter}
小节: {chunk.section}

## 文本内容
{chunk.text}

请提取知识点实体和关系。"""

        try:
            async with httpx.AsyncClient(timeout=LLM_TIMEOUT) as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self.model,
                        "messages": [
                            {"role": "system", "content": ENTITY_EXTRACTION_PROMPT},
                            {"role": "user", "content": user_prompt},
                        ],
                        "temperature": 0.3,
                        "max_tokens": 2048,
                    },
                )

            if response.status_code != 200:
                print(f"  LLM 调用失败: {response.status_code} {response.text[:100]}")
                return [], []

            result = response.json()
            content = result.get("choices", [{}])[0].get("message", {}).get("content", "")

            # 解析 JSON
            data = self._parse_json(content)
            entities = data.get("entities", [])
            triples = data.get("triples", [])

            self.stats["chunks_processed"] += 1
            self.stats["entities_extracted"] += len(entities)
            self.stats["triples_extracted"] += len(triples)

            return entities, triples

        except Exception as e:
            print(f"  LLM 请求异常: {e}")
            return [], []

    def _parse_json(self, content: str) -> Dict:
        """解析 LLM 返回的 JSON"""
        try:
            if content.strip().startswith("{"):
                return json.loads(content.strip())
            # 从 markdown 代码块中提取
            m = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', content)
            if m:
                return json.loads(m.group(1))
            # 尝试找 JSON 对象
            m = re.search(r'\{[\s\S]*\}', content)
            if m:
                return json.loads(m.group(0))
        except json.JSONDecodeError:
            pass
        return {}


# ═══════════════════════════════════════════════════════
#  Stage 4: 知识融合与实体消歧
# ═══════════════════════════════════════════════════════

class KnowledgeFusion:
    """知识融合器 — 合并同义实体、去重关系、补全跨章节链路"""

    # 同义映射（可扩展）
    SYNONYM_MAP = {
        "nlp": "自然语言处理",
        "NLP": "自然语言处理",
        "llm": "大语言模型",
        "LLM": "大语言模型",
        "GPT": "GPT系列模型",
        "lstm": "LSTM",
        "rnn": "RNN",
        "cnn": "CNN",
        "mlp": "多层感知机",
        "RLHF": "基于人类反馈的强化学习",
        "SFT": "监督微调",
        "LoRA": "低秩适应",
        "PEFT": "参数高效微调",
        "CoT": "思维链提示",
        "RAG": "检索增强生成",
        "MoE": "混合专家模型",
    }

    def __init__(self):
        self.kg = KnowledgeGraph()

    def process(
        self,
        all_entities: List[List[Dict]],
        all_triples: List[List[Dict]],
        chapters: List[Dict],
    ) -> KnowledgeGraph:
        """融合所有抽取结果"""
        print(f"\n{'='*50}")
        print("Stage 4: 知识融合与实体消歧")
        print(f"输入: {sum(len(e) for e in all_entities)} 个实体, "
              f"{sum(len(t) for t in all_triples)} 个关系")

        # Step 1: 合并所有实体
        entity_map: Dict[str, Dict] = {}
        for entities in all_entities:
            for e in entities:
                name = self._normalize_name(e.get("name", ""))
                if not name or len(name) < 2:
                    continue
                if name not in entity_map:
                    entity_map[name] = {
                        "name": name,
                        "type": e.get("type", "concept"),
                        "difficulty": e.get("difficulty", 3),
                        "importance": e.get("importance", 3),
                        "occurrence_count": 1,
                        "chapters": set(),
                    }
                else:
                    existing = entity_map[name]
                    # 取平均难度和重要度
                    existing["difficulty"] = round(
                        (existing["difficulty"] * existing["occurrence_count"] + e.get("difficulty", 3))
                        / (existing["occurrence_count"] + 1)
                    )
                    existing["importance"] = round(
                        (existing["importance"] * existing["occurrence_count"] + e.get("importance", 3))
                        / (existing["occurrence_count"] + 1)
                    )
                    existing["occurrence_count"] += 1

        # Step 2: 合并关系，去重
        triple_map: Dict[str, KnowledgeTriple] = {}
        for triples in all_triples:
            for t in triples:
                subj = self._normalize_name(t.get("subject", ""))
                obj = self._normalize_name(t.get("object", ""))
                rel = t.get("relation", "RELATED_TO")
                if not subj or not obj or subj == obj:
                    continue

                key = f"{subj}|{rel}|{obj}"
                if key in triple_map:
                    triple_map[key].confidence = min(1.0, triple_map[key].confidence + 0.1)
                else:
                    triple_map[key] = KnowledgeTriple(
                        subject=subj,
                        relation=rel,
                        object=obj,
                        confidence=0.8,
                    )

        # Step 3: 关联章节
        for entities in all_entities:
            for e in entities:
                name = self._normalize_name(e.get("name", ""))
                if name in entity_map and e.get("chapter"):
                    entity_map[name]["chapters"].add(e.get("chapter", ""))

        # 转换 chapters 集合为列表
        for name in entity_map:
            entity_map[name]["chapters"] = list(entity_map[name]["chapters"])
            if not entity_map[name]["chapters"]:
                entity_map[name]["chapters"] = ["未归类"]

        # Step 4: 补全跨章节前置依赖
        triples = list(triple_map.values())
        triples = self._complete_prerequisites(triples, entity_map)

        self.kg.entities = entity_map
        self.kg.triples = triples

        print(f"输出: {len(entity_map)} 个实体, {len(triples)} 个关系")
        print(f"实体类型分布: {self._type_distribution(entity_map)}")
        print(f"关系类型分布: {self._relation_distribution(triples)}")

        return self.kg

    def _normalize_name(self, name: str) -> str:
        """规范化实体名称"""
        name = name.strip()
        # 去除多余空格和标点
        name = re.sub(r'\s+', ' ', name)
        name = name.rstrip('，,。.')
        # 同义词映射
        return self.SYNONYM_MAP.get(name, name)

    def _complete_prerequisites(
        self, triples: List[KnowledgeTriple], entities: Dict
    ) -> List[KnowledgeTriple]:
        """补全跨章节前置依赖"""
        # 如果 A → B 且 B → C，且 A 和 C 在不同章节，添加 A → C
        subj_to_obj: Dict[str, Set[str]] = defaultdict(set)
        for t in triples:
            if t.relation in ("PREREQUISITE", "DEPENDS_ON"):
                subj_to_obj[t.subject].add(t.object)

        existing_keys = {(t.subject, t.relation, t.object) for t in triples}

        new_triples = []
        for t in triples:
            if t.relation in ("PREREQUISITE", "DEPENDS_ON"):
                # 传递闭包: 如果 B 是 C 的前置，且 A 是 B 的前置
                if t.object in subj_to_obj:
                    for further in subj_to_obj[t.object]:
                        key = (t.subject, "PREREQUISITE", further)
                        if key not in existing_keys:
                            new_triples.append(KnowledgeTriple(
                                subject=t.subject,
                                relation="PREREQUISITE",
                                object=further,
                                confidence=0.5,
                            ))
                            existing_keys.add(key)

        return triples + new_triples

    def _type_distribution(self, entities: Dict) -> Dict[str, int]:
        dist = defaultdict(int)
        for e in entities.values():
            dist[e.get("type", "concept")] += 1
        return dict(dist)

    def _relation_distribution(self, triples: List[KnowledgeTriple]) -> Dict[str, int]:
        dist = defaultdict(int)
        for t in triples:
            dist[t.relation] += 1
        return dict(dist)


# ═══════════════════════════════════════════════════════
#  Stage 5: 输出（JSON → 导入 Neo4j + PostgreSQL）
# ═══════════════════════════════════════════════════════

class KGExporter:
    """知识图谱导出器"""

    @staticmethod
    def to_json(kg: KnowledgeGraph, output_path: str):
        """导出为 JSON"""
        data = {
            "meta": {
                "entity_count": len(kg.entities),
                "triple_count": len(kg.triples),
                "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            },
            "entities": [
                {
                    "name": e["name"],
                    "type": e["type"],
                    "difficulty": e["difficulty"],
                    "importance": e["importance"],
                    "occurrence_count": e["occurrence_count"],
                    "chapters": e["chapters"],
                }
                for e in kg.entities.values()
            ],
            "triples": [
                {
                    "subject": t.subject,
                    "relation": t.relation,
                    "object": t.object,
                    "confidence": t.confidence,
                }
                for t in kg.triples
            ],
        }
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"\nKG 已导出到: {output_path}")

    @staticmethod
    def to_csv(kg: KnowledgeGraph, output_dir: str):
        """导出为 CSV（方便导入 PostgreSQL）"""
        os.makedirs(output_dir, exist_ok=True)

        # 实体 CSV
        entities_path = os.path.join(output_dir, "knowledge_points.csv")
        with open(entities_path, 'w', encoding='utf-8') as f:
            f.write("name,type,difficulty,importance,chapters\n")
            for e in kg.entities.values():
                chapters = ";".join(e.get("chapters", []))
                f.write(f"{e['name']},{e['type']},{e['difficulty']},{e['importance']},"
                        f"\"{chapters}\"\n")

        # 关系 CSV
        triples_path = os.path.join(output_dir, "knowledge_relations.csv")
        with open(triples_path, 'w', encoding='utf-8') as f:
            f.write("subject,relation,object,confidence\n")
            for t in kg.triples:
                f.write(f"{t.subject},{t.relation},{t.object},{t.confidence}\n")

        print(f"CSV 已导出到: {output_dir}")

    @staticmethod
    def to_neo4j_cypher(kg: KnowledgeGraph, output_path: str):
        """生成 Neo4j Cypher 导入脚本"""
        lines = ["// 知识图谱导入脚本 - 自动生成", ""]

        # 创建实体节点
        for name, e in kg.entities.items():
            safe_name = name.replace("'", "\\'")
            lines.append(
                f"MERGE (k:KnowledgePoint {{name: '{safe_name}'}}) "
                f"SET k.type = '{e['type']}', "
                f"k.difficulty = {e['difficulty']}, "
                f"k.importance = {e['importance']};"
            )

        # 创建关系
        for t in kg.triples:
            safe_subj = t.subject.replace("'", "\\'")
            safe_obj = t.object.replace("'", "\\'")
            lines.append(
                f"MATCH (a:KnowledgePoint {{name: '{safe_subj}'}}), "
                f"(b:KnowledgePoint {{name: '{safe_obj}'}}) "
                f"MERGE (a)-[:{t.relation}]->(b);"
            )

        with open(output_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))
        print(f"Cypher 脚本已导出到: {output_path}")

    @staticmethod
    def print_summary(kg: KnowledgeGraph, chapters: List[Dict]):
        """打印知识图谱摘要"""
        print(f"\n{'='*50}")
        print("知识图谱摘要")
        print(f"{'='*50}")
        print(f"实体数: {len(kg.entities)}")
        print(f"关系数: {len(kg.triples)}")

        # 按重要度排序 Top 20
        by_importance = sorted(
            kg.entities.values(),
            key=lambda x: (x.get("importance", 3), x.get("occurrence_count", 0)),
            reverse=True,
        )[:20]
        print(f"\nTop 20 重要知识点:")
        for e in by_importance:
            diff_star = "★" * e["difficulty"]
            imp_star = "⭐" * e["importance"]
            print(f"  {e['name']:<30s} 难度{diff_star}  重要度{imp_star}  "
                  f"({e['type']}, 出现{e['occurrence_count']}次)")

        # 章节覆盖面
        print(f"\n章节覆盖 ({len(chapters)} 章):")
        chapter_entity_count = defaultdict(int)
        for e in kg.entities.values():
            for ch in e.get("chapters", []):
                chapter_entity_count[ch] += 1
        for ch in chapters:
            count = chapter_entity_count.get(ch["title"], 0)
            print(f"  {ch['title']}: {count} 个知识点")


# ═══════════════════════════════════════════════════════
#  主流程
# ═══════════════════════════════════════════════════════

async def build_knowledge_graph(pdf_path: str, api_key: str, output_dir: str = "output/kg/"):
    """完整的 PDF → KG 构建流程"""
    os.makedirs(output_dir, exist_ok=True)

    # ════ Stage 1: PDF 解析 ════
    print(f"{'='*50}")
    print("Stage 1: PDF 解析与内容预处理")
    parser = PDFParser(pdf_path)
    chapters = parser.extract_text_by_chapter()
    total_pages = parser.doc.page_count
    print(f"PDF: {total_pages} 页, {len(chapters)} 章")
    for ch in chapters:
        text_len = len(ch["text"])
        print(f"  第{chapters.index(ch)+1}章: {ch['title']} "
              f"(p{ch['start_page']+1}-p{ch['end_page']+1}, {text_len} 字符, "
              f"{len(ch.get('children', []))} 节)")

    # ════ Stage 2: 语义分块 ════
    print(f"\n{'='*50}")
    print("Stage 2: 语义分块")
    chunker = TextChunker()
    all_chunks = []
    for ch in chapters:
        chunks = chunker.chunk_chapter(ch)
        all_chunks.extend(chunks)
        total_tokens = sum(c.token_count for c in chunks)
        print(f"  第{chapters.index(ch)+1}章: {len(chunks)} 块, {total_tokens} tokens")

    print(f"总计: {len(all_chunks)} 个文本块")

    if not all_chunks:
        print("错误: 没有提取到任何文本块！")
        return None

    # 保存分块结果
    chunks_path = os.path.join(output_dir, "chunks.json")
    with open(chunks_path, 'w', encoding='utf-8') as f:
        json.dump([
            {"id": c.id, "chapter": c.chapter, "section": c.section,
             "token_count": c.token_count, "text": c.text[:200] + "..."}
            for c in all_chunks
        ], f, ensure_ascii=False, indent=2)
    print(f"分块结果已保存: {chunks_path}")

    # ════ Stage 3: LLM 实体抽取 ════
    print(f"\n{'='*50}")
    print("Stage 3: LLM 实体与关系抽取")
    print(f"共 {len(all_chunks)} 个文本块待处理")
    print("⚠ 这将消耗大量 LLM Token，确认继续？(y/n)")

    extractor = TripleExtractor(api_key)
    all_entities = []
    all_triples = []

    # 先试抽3个块，确认效果
    test_chunks = all_chunks[:3]
    for i, chunk in enumerate(test_chunks):
        print(f"\n[测试 {i+1}/{len(test_chunks)}] {chunk.chapter} / {chunk.section}")
        entities, triples = await extractor.extract_from_chunk(chunk)
        all_entities.append(entities)
        all_triples.append(triples)
        print(f"  抽取 {len(entities)} 个实体, {len(triples)} 个关系")
        for e in entities:
            print(f"    📌 {e.get('name', '?')} (难度{e.get('difficulty',3)} 重要度{e.get('importance',3)})")
        for t in triples:
            print(f"    🔗 {t.get('subject','?')} --[{t.get('relation','?')}]--> {t.get('object','?')}")

    # ════ Stage 4: 知识融合 ════
    fusion = KnowledgeFusion()
    kg = fusion.process(all_entities, all_triples, chapters)

    # ════ Stage 5: 输出 ════
    print(f"\n{'='*50}")
    print("Stage 5: 输出结果")

    exporter = KGExporter()
    exporter.to_json(kg, os.path.join(output_dir, "knowledge_graph.json"))
    exporter.to_csv(kg, os.path.join(output_dir, "csv"))
    exporter.to_neo4j_cypher(kg, os.path.join(output_dir, "import_to_neo4j.cypher"))
    exporter.print_summary(kg, chapters)

    parser.close()
    return kg


# ═══════════════════════════════════════════════════════
#  CLI 入口
# ═══════════════════════════════════════════════════════

if __name__ == "__main__":
    import asyncio

    if len(sys.argv) < 2:
        print("用法: python scripts/pdf_to_kg.py <pdf_path> [api_key]")
        print("  api_key 可选，也可通过 DEEPSEEK_API_KEY 环境变量提供")
        sys.exit(1)

    pdf_path = sys.argv[1]
    api_key = sys.argv[2] if len(sys.argv) > 2 else os.environ.get("DEEPSEEK_API_KEY", "")

    if not api_key:
        print("错误: 请提供 DEEPSEEK_API_KEY（第二个参数或环境变量）")
        sys.exit(1)

    if not os.path.exists(pdf_path):
        print(f"错误: PDF 文件不存在: {pdf_path}")
        sys.exit(1)

    asyncio.run(build_knowledge_graph(pdf_path, api_key))
