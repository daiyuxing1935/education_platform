"""PathPlanner - 学习路径规划服务

基于 Neo4j 知识图谱中的 PREREQUISITE 和 RELATED_TO 关系，
结合学生画像中的薄弱知识点，生成个性化学习路径（DAG）。

算法流程（参考 PRD-9 BE-04）：
1. 融合 Neo4j 和 PostgreSQL 掌握度数据
2. 从薄弱知识点出发，沿 PREREQUISITE 向上游扩展 2 层
3. 沿 RELATED_TO 扩展 1 层
4. 合并子图，Kahn 拓扑排序
5. 加权评分排序：Score = w1*(1-mastery) + w2*importance + w3*exam_freq - w4*cognitive_load
6. 分层布局节点位置
"""

import logging
import math
from typing import List, Dict, Any, Optional, Set, Tuple
from app.db.neo4j import Neo4jConnection

logger = logging.getLogger(__name__)

# 默认权重（可配置）
DEFAULT_WEIGHTS = {
    "mastery_gap": 0.40,      # w1: 掌握度差距，越薄弱越优先
    "importance": 0.25,       # w2: 知识点重要度
    "exam_frequency": 0.20,   # w3: 考察频率
    "cognitive_penalty": 0.15, # w4: 认知负荷惩罚
}

# 节点颜色方案
COLOR_MAP = {
    "completed": "#22c55e",
    "in_progress": "#eab308",
    "not_started": "#94a3b8",
}


class PathPlanner:
    """学习路径规划器"""

    def __init__(self, neo4j: Neo4jConnection):
        self.neo4j = neo4j

    async def plan(self, student_id: str) -> Dict[str, Any]:
        """执行路径规划算法，返回 ReactFlow 格式的 DAG 数据"""
        try:
            # Step 1: 获取薄弱知识点 (掌握度 < 0.5)
            weak_kps = self.neo4j.get_weak_knowledge_points(student_id, threshold=0.5)
            weak_names = [kp["name"] for kp in weak_kps if kp.get("name")]
            weak_scores = {kp["name"]: kp["score"] for kp in weak_kps if kp.get("name")}

            # 融合 PostgreSQL 掌握度数据（获取更多节点）
            all_scores = dict(weak_scores)  # Neo4j scores as base

            if not weak_names:
                logger.info(f"学生 {student_id} 无薄弱知识点，返回空路径")
                return self._empty_path()

            # Step 2: 沿 [:PREREQUISITE] 向上游扩展 2 层
            prereq_data = self.neo4j.get_prerequisite_upstream(weak_names, depth=2)

            # Step 3: 沿 [:RELATED_TO] 扩展 1 层
            related_data = self.neo4j.get_related_graph(weak_names, depth=1)

            # Step 4: 合并节点和边
            all_nodes_map: Dict[str, dict] = {}
            all_edges_set: Set[Tuple[str, str, str]] = set()

            for n in prereq_data.get("nodes", []):
                name = n.get("name")
                if name:
                    all_nodes_map[name] = {
                        "name": name,
                        "uuid": n.get("uuid", ""),
                        "source": n.get("source", "prerequisite"),
                        "domain_name": n.get("domain_name", ""),
                        "subject_name": n.get("subject_name", ""),
                    }

            for n in related_data.get("nodes", []):
                name = n.get("name")
                if name and name not in all_nodes_map:
                    all_nodes_map[name] = {
                        "name": name,
                        "uuid": n.get("uuid", ""),
                        "source": n.get("source", "related"),
                        "domain_name": n.get("domain_name", ""),
                        "subject_name": n.get("subject_name", ""),
                    }

            for e in prereq_data.get("edges", []):
                src, tgt = e.get("source"), e.get("target")
                if src and tgt:
                    all_edges_set.add((src, tgt, e.get("type", "PREREQUISITE")))

            for e in related_data.get("edges", []):
                src, tgt = e.get("source"), e.get("target")
                if src and tgt:
                    all_edges_set.add((src, tgt, e.get("type", "RELATED_TO")))

            # Step 5: 拓扑排序
            node_names = list(all_nodes_map.keys())
            sorted_names = self._topological_sort(node_names, list(all_edges_set))

            # Step 6: 计算加权评分，确定学习优先级
            node_scores = self._compute_node_scores(sorted_names, all_scores)

            # Step 7: 分层布局（按前置层级分组排列）
            depth_map = self._compute_depth(sorted_names, list(all_edges_set))

            # Step 8: 构建 ReactFlow 格式
            reactflow_nodes = []
            reactflow_edges = []

            node_progress = self._get_node_progress(sorted_names, weak_scores)

            # 按深度分组布局
            max_depth = max(depth_map.values()) if depth_map else 0
            layer_width = 240
            node_height = 120

            # 收集同深度的节点
            depth_groups: Dict[int, List[str]] = {}
            for name in sorted_names:
                d = depth_map.get(name, 0)
                depth_groups.setdefault(d, []).append(name)

            for name in sorted_names:
                info = all_nodes_map[name]
                progress = node_progress.get(name, "not_started")
                score = all_scores.get(name)
                is_weak = name in weak_scores
                depth = depth_map.get(name, 0)

                # 确定列位置（按深度），行位置（在深度组内居中）
                col_x = 60 + depth * layer_width
                group = depth_groups.get(depth, [])
                group_size = len(group)
                idx_in_group = group.index(name)
                if group_size > 1:
                    row_y = 40 + (idx_in_group - (group_size - 1) / 2) * node_height
                else:
                    row_y = 40

                reactflow_nodes.append({
                    "id": info.get("uuid") or name,
                    "type": "default",
                    "position": {"x": col_x, "y": row_y},
                    "data": {
                        "label": name,
                        "progress": progress,
                        "score": int(score * 100) if score is not None else 0,
                        "is_weak": is_weak,
                        "domain": info.get("domain_name", ""),
                        "subject": info.get("subject_name", ""),
                        "priority_score": round(node_scores.get(name, 0), 2),
                    },
                    "style": {
                        "border": f"2px solid {COLOR_MAP.get(progress, '#94a3b8')}",
                        "borderRadius": "8px",
                        "padding": "10px",
                        "backgroundColor": f"{COLOR_MAP.get(progress, '#94a3b8')}15",
                        "width": 180,
                    },
                })

            for src, tgt, etype in all_edges_set:
                src_info = all_nodes_map.get(src)
                tgt_info = all_nodes_map.get(tgt)
                src_id = src_info.get("uuid") or src if src_info else src
                tgt_id = tgt_info.get("uuid") or tgt if tgt_info else tgt

                style = {
                    "stroke": "#94a3b8",
                    "strokeWidth": 1.5,
                    "strokeDasharray": "5,5" if etype == "RELATED_TO" else "none",
                }

                reactflow_edges.append({
                    "id": f"{src_id}->{tgt_id}",
                    "source": src_id,
                    "target": tgt_id,
                    "label": "前置" if etype == "PREREQUISITE" else "关联",
                    "style": style,
                    "labelStyle": {"fontSize": 10},
                    "animated": etype == "PREREQUISITE",
                })

            return {
                "nodes": reactflow_nodes,
                "edges": reactflow_edges,
                "metadata": {
                    "total_nodes": len(reactflow_nodes),
                    "total_edges": len(reactflow_edges),
                    "weak_count": len(weak_kps),
                    "generated_at": None,
                },
            }

        except Exception as e:
            logger.error(f"路径规划失败: {e}", exc_info=True)
            # 安全的降级处理
            try:
                fallback_names = weak_names if 'weak_names' in locals() else []
            except Exception:
                fallback_names = []
            return self._fallback_path(fallback_names)

    def _topological_sort(self, nodes: List[str], edges: List[tuple]) -> List[str]:
        """Kahn 拓扑排序"""
        in_degree = {n: 0 for n in nodes}
        adj = {n: [] for n in nodes}

        for src, tgt, _ in edges:
            if src in adj and tgt in in_degree:
                adj[src].append(tgt)
                in_degree[tgt] = in_degree.get(tgt, 0) + 1

        queue = [n for n in nodes if in_degree.get(n, 0) == 0]
        result = []

        while queue:
            node = queue.pop(0)
            result.append(node)
            for neighbor in adj.get(node, []):
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)

        remaining = [n for n in nodes if n not in result]
        return result + remaining

    def _compute_node_scores(self, node_names: List[str], weak_scores: Dict[str, float]) -> Dict[str, float]:
        """计算每个节点的加权优先级分数

        Score = w1*(1-mastery) + w2*importance + w3*exam_freq - w4*cognitive_load
        分数越高 → 越应该优先学习
        """
        weights = DEFAULT_WEIGHTS
        scores = {}

        for name in node_names:
            mastery = weak_scores.get(name, 1.0)  # 默认 1.0（完全掌握）
            mastery_gap = 1.0 - mastery

            # 知识点重要度：薄弱知识点更重要
            importance = 0.3 if name in weak_scores else 0.7

            # 考察频率：简化版，可根据实际出题数扩展
            exam_freq = 0.5

            # 认知负荷：未开始的节点负荷更低
            cognitive_load = 0.3 if name in weak_scores else 0.6

            score = (
                weights["mastery_gap"] * mastery_gap
                + weights["importance"] * importance
                + weights["exam_frequency"] * exam_freq
                - weights["cognitive_penalty"] * cognitive_load
            )
            scores[name] = max(0, score)

        return scores

    def _compute_depth(self, node_names: List[str], edges: List[Tuple[str, str, str]]) -> Dict[str, int]:
        """计算每个节点在 DAG 中的深度（最长路径长度）"""
        adj: Dict[str, List[str]] = {n: [] for n in node_names}
        for src, tgt, _ in edges:
            if src in adj and tgt in node_names:
                adj[src].append(tgt)

        depth: Dict[str, int] = {}

        def dfs(name: str) -> int:
            if name in depth:
                return depth[name]
            max_d = 0
            for neighbor in adj.get(name, []):
                max_d = max(max_d, dfs(neighbor) + 1)
            depth[name] = max_d
            return max_d

        for name in node_names:
            if name not in depth:
                dfs(name)

        # 没有依赖的节点深度设为 0
        for name in node_names:
            if name not in depth:
                depth[name] = 0

        return depth

    def _get_node_progress(self, node_names: List[str], weak_scores: Dict[str, float]) -> Dict[str, str]:
        """根据掌握度计算节点进度状态"""
        progress = {}
        for name in node_names:
            score = weak_scores.get(name)
            if score is None:
                progress[name] = "completed"
            elif score < 0.3:
                progress[name] = "not_started"
            else:
                progress[name] = "in_progress"
        return progress

    def _empty_path(self) -> Dict[str, Any]:
        return {
            "nodes": [],
            "edges": [],
            "metadata": {
                "total_nodes": 0,
                "total_edges": 0,
                "weak_count": 0,
                "generated_at": None,
            },
        }

    def _fallback_path(self, weak_names: List[str]) -> Dict[str, Any]:
        """降级方案：当 Neo4j 查询失败时，生成简单线性路径"""
        if not weak_names:
            return self._empty_path()

        nodes = []
        edges = []
        for i, name in enumerate(weak_names):
            nodes.append({
                "id": f"fallback_{i}",
                "type": "default",
                "position": {"x": 250, "y": i * 120},
                "data": {
                    "label": name,
                    "progress": "not_started",
                    "score": 0,
                    "is_weak": True,
                    "domain": "",
                    "subject": "",
                },
                "style": {
                    "border": "2px solid #94a3b8",
                    "borderRadius": "8px",
                    "padding": "10px",
                    "backgroundColor": "#94a3b815",
                    "width": 180,
                },
            })
            if i > 0:
                edges.append({
                    "id": f"fallback_{i-1}->{i}",
                    "source": f"fallback_{i-1}",
                    "target": f"fallback_{i}",
                    "label": "顺序",
                    "style": {"stroke": "#94a3b8", "strokeWidth": 1.5},
                    "animated": True,
                })

        return {
            "nodes": nodes,
            "edges": edges,
            "metadata": {
                "total_nodes": len(nodes),
                "total_edges": len(edges),
                "weak_count": len(weak_names),
                "generated_at": None,
                "degraded": True,
            },
        }


_path_planner: Optional[PathPlanner] = None


def get_path_planner(neo4j: Neo4jConnection) -> PathPlanner:
    global _path_planner
    if _path_planner is None:
        _path_planner = PathPlanner(neo4j)
    return _path_planner
