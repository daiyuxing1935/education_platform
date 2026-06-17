"""路径生成服务 — 学习路径摘要统计"""

import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)


def generate_empty_path() -> str:
    """返回空路径的 Markdown 提示"""
    return """# 学习路径

## 开始你的学习之旅

- 完成知识点学习或练习后，这里将自动生成个性化学习路径
- 系统会根据你的掌握度和学习进度动态调整路径
"""


def build_summary(
    subjects: List[Dict[str, Any]],
    records_map: Dict[str, Dict[str, Any]],
    difficult_points: set = None,
) -> dict:
    """构建路径摘要统计"""
    if difficult_points is None:
        difficult_points = set()

    total = 0
    mastered = 0
    learning = 0
    not_started = 0
    reviewing = 0
    difficult = 0

    for subject in subjects:
        for domain in subject.get("domains", []):
            for point in domain.get("knowledge_points", []):
                pid = str(point.get("id", ""))
                record = records_map.get(pid, {})
                status = record.get("status", "not_started")
                total += 1

                if status == "mastered":
                    mastered += 1
                elif status == "learning":
                    learning += 1
                elif status == "reviewing":
                    reviewing += 1
                else:
                    not_started += 1

                if pid in difficult_points:
                    difficult += 1

    return {
        "total": total,
        "mastered": mastered,
        "learning": learning,
        "not_started": not_started,
        "reviewing": reviewing,
        "difficult": difficult,
    }
