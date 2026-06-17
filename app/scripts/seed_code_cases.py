"""
数据结构代码案例种子数据脚本

为「数据结构」学科的各知识点生成可运行的代码案例资源（resource_type='code_case'），
插入到指定用户的个性化学习资源中。

代码案例文件位于 app/scripts/code_examples/ 目录下，每个文件对应一个知识点。

使用方式：
    docker exec -i ea-backend python /app/app/scripts/seed_code_cases.py

效果：
    为 test_user（guoketg）的知识点生成 17 个可运行的数据结构代码案例，
    每个代码案例包含完整的中文注释和测试样例。
"""

import sys
import os
import logging

logging.basicConfig(level=logging.INFO, format="%(message)s")
log = logging.getLogger(__name__)

# ── 代码案例文件 → (知识点名称列表, 显示标题) ──

CODE_FILES = [
    ("01_seqlist.py",            ["顺序表实现", "顺序表操作"],
     "【顺序表】实现与基本操作"),
    ("02_linkedlist.py",         ["单链表"],
     "【单链表】定义与基本操作"),
    ("03_doubly_linkedlist.py",  ["双链表"],
     "【双向链表】实现与基本操作"),
    ("04_stack.py",              ["顺序栈"],
     "【顺序栈】实现与基本操作"),
    ("05_circular_queue.py",     ["循环队列"],
     "【循环队列】实现与基本操作"),
    ("06_bracket_matching.py",   ["栈的应用"],
     "【栈的应用】括号匹配与表达式求值"),
    ("07_binary_tree.py",        ["二叉树定义", "二叉树遍历"],
     "【二叉树】链式存储与遍历"),
    ("08_huffman.py",            ["哈夫曼树"],
     "【哈夫曼树】构建与编码"),
    ("09_adjacency_matrix.py",   ["邻接矩阵"],
     "【邻接矩阵】图的存储结构"),
    ("10_dfs.py",                ["DFS"],
     "【DFS】深度优先搜索"),
    ("11_bfs.py",                ["BFS"],
     "【BFS】广度优先搜索"),
    ("12_dijkstra.py",           ["Dijkstra"],
     "【Dijkstra】最短路径算法"),
    ("13_bubble_sort.py",        ["冒泡排序"],
     "【冒泡排序】排序算法"),
    ("14_quick_sort.py",         ["快速排序"],
     "【快速排序】排序算法"),
    ("15_merge_sort.py",         ["归并排序"],
     "【归并排序】分治排序"),
    ("16_heap_sort.py",          ["堆排序"],
     "【堆排序】排序算法"),
    ("17_binary_search.py",      ["折半查找"],
     "【折半查找】查找算法"),
    ("18_bst.py",                ["BST"],
     "【BST】二叉排序树"),
    ("19_avl.py",                ["AVL"],
     "【AVL】平衡二叉树"),
]


def main():
    sys.path.insert(0, "/app")

    from app.db.database import SessionLocal
    from app.models.resource import KnowledgeResource
    from app.models.user import User
    from app.models.question_bank import KnowledgePoint
    from app.db.database import Base, engine
    from sqlalchemy import text

    # 检查表是否存在
    try:
        Base.metadata.reflect(bind=engine)
    except Exception:
        pass

    # 代码文件目录（相对于本脚本）
    script_dir = os.path.dirname(os.path.abspath(__file__))
    examples_dir = os.path.join(script_dir, "code_examples")

    if not os.path.isdir(examples_dir):
        log.error(f"❌ 代码案例目录不存在: {examples_dir}")
        sys.exit(1)

    db = SessionLocal()
    try:
        # 1. 查找测试用户
        user = db.query(User).filter(User.username == "guoketg").first()
        if not user:
            log.error("❌ 测试用户 guoketg 不存在，请先注册")
            sys.exit(1)
        log.info(f"👤 用户: {user.username}")

        # 2. 查找「数据结构」学科下的所有知识点（仅按名称查找，无学科限制也可）
        all_kps = db.query(KnowledgePoint).all()
        kp_by_name: dict[str, str] = {}
        for kp in all_kps:
            kp_by_name[kp.name] = str(kp.id)

        log.info(f"📚 数据库中共 {len(all_kps)} 个知识点")

        # 3. 遍历每个代码案例文件
        created = 0
        skipped = 0
        not_found_kps = []

        for filename, kp_names, title in CODE_FILES:
            # 查找知识点（取第一个匹配的）
            kp_uuid = None
            matched_kp_name = None
            for kn in kp_names:
                if kn in kp_by_name:
                    kp_uuid = kp_by_name[kn]
                    matched_kp_name = kn
                    break

            if not kp_uuid:
                not_found_kps.append(kp_names[0])
                continue

            # 读取代码文件
            filepath = os.path.join(examples_dir, filename)
            if not os.path.exists(filepath):
                log.warning(f"  ⚠️ 文件不存在: {filename}")
                continue

            with open(filepath, "r", encoding="utf-8") as f:
                code_content = f.read()

            # 检查是否已存在
            existing = (
                db.query(KnowledgeResource)
                .filter(
                    KnowledgeResource.user_id == user.id,
                    KnowledgeResource.title == title,
                    KnowledgeResource.resource_type == "code_case",
                )
                .first()
            )
            if existing:
                log.info(f"  • {title} — 已存在")
                skipped += 1
                continue

            resource = KnowledgeResource(
                user_id=user.id,
                title=title,
                resource_type="code_case",
                content=code_content,
                knowledge_points=[matched_kp_name],
                source="manual",
            )
            db.add(resource)
            db.flush()
            created += 1
            log.info(f"  ✅ {title}")

        db.commit()

        # 总结
        log.info(f"\n🎉 代码案例种子数据注入完成！")
        log.info(f"   ✔ 新增: {created}")
        log.info(f"   ✔ 已有跳过: {skipped}")
        if not_found_kps:
            log.info(f"   ⚠ 未找到知识点: {', '.join(not_found_kps[:5])}")
            if len(not_found_kps) > 5:
                log.info(f"     ...等 {len(not_found_kps)} 个")
        log.info(f"\n👉 请以 guoketg 身份登录，在「个性化学习资源」页面查看")

    except Exception as e:
        db.rollback()
        log.error(f"❌ 失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
