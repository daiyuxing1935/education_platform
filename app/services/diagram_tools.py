"""图表工具集 — 视频生成 Agent 可调用的绘图工具

每个工具接收描述性参数，返回 draw.io XML + 渲染 HTML。
视频生成 agent 在生成章节时调用这些工具来创建图表。
"""

import json
import logging
import re

logger = logging.getLogger(__name__)


def _mx(id_str: str, parent: str = "1", **attrs) -> str:
    """生成 mxCell 元素"""
    a = " ".join(f'{k}="{v}"' for k, v in attrs.items())
    return f'<mxCell id="{id_str}" parent="{parent}" {a}/>'


def _vx(id_str: str, x: int, y: int, w: int, h: int, label: str, style: str = "") -> str:
    """生成顶点"""
    s = style or "rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;"
    return (
        f'<mxCell id="{id_str}" value="{label}" style="{s}" vertex="1" parent="1">'
        f'<mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/>'
        f'</mxCell>'
    )


def _edge(id_str: str, source: str, target: str, label: str = "") -> str:
    """生成边"""
    return (
        f'<mxCell id="{id_str}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;" edge="1" '
        f'parent="1" source="{source}" target="{target}">'
        f'<mxGeometry relative="1" as="geometry"/>'
        f'</mxCell>'
    )


def _build_xml(name: str, cells: list[str]) -> str:
    """组装 draw.io XML"""
    c = "\n      ".join(cells)
    return (
        f'<mxfile host="app.diagrams.net">\n'
        f'  <diagram name="{name}" id="d1">\n'
        f'    <mxGraphModel dx="1200" dy="800" grid="1" gridSize="10">\n'
        f'      <root>\n'
        f'        <mxCell id="0"/>\n'
        f'        <mxCell id="1" parent="0"/>\n'
        f'        {c}\n'
        f'      </root>\n'
        f'    </mxGraphModel>\n'
        f'  </diagram>\n'
        f'</mxfile>'
    )


# ── 可调用的工具函数 ──

def create_mindmap(central: str, branches: list) -> dict:
    """工具：创建思维导图

    Args:
        central: 中心主题
        branches: 分支列表，每项 {topic, sub_items}

    Returns:
        {drawio_xml, html} 绘图结果
    """
    cells = []
    colors = ["#dae8fc", "#d5e8d4", "#ffe6cc", "#f8cecc", "#e1d5e7", "#e6c3f2"]
    edge_colors = ["#6c8ebf", "#82b366", "#d79b00", "#b85450", "#9673a6", "#a55dc2"]

    # Center node
    cells.append(_vx("2", 300, 10, 160, 50, central, "rounded=1;whiteSpace=wrap;html=1;fillColor=#1a1a2e;strokeColor=#4fc3f7;fontSize=14;fontStyle=1;fontColor=#ffffff;"))

    y = 100
    for i, b in enumerate(branches):
        nid = f"b{i}"
        topic = b.get("topic", f"分支{i+1}")
        sub_items = b.get("sub_items", [])
        c = colors[i % len(colors)]
        ec = edge_colors[i % len(edge_colors)]

        cells.append(_vx(nid, 40 + i * 180, y, 140, 34, topic, f"rounded=1;whiteSpace=wrap;html=1;fillColor={c};strokeColor={ec};fontSize=12;"))
        cells.append(_edge(f"e{nid}", "2", nid))

        for j, item in enumerate(sub_items):
            sid = f"b{i}s{j}"
            cells.append(_vx(sid, 40 + i * 180, y + 44 + j * 30, 140, 26, item, "rounded=0;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=none;fontSize=11;fontColor=#333333;"))
            cells.append(_edge(f"e{sid}", nid, sid))

    drawio_xml = _build_xml(f"思维导图: {central}", cells)

    # Also return structured data for renderer
    return {
        "drawio_xml": drawio_xml,
        "html": f"<!-- drawio:思维导图:{central} -->",
    }


def create_flowchart(title: str, steps: list, connections: list) -> dict:
    """工具：创建流程图

    Args:
        title: 流程名称
        steps: 步骤列表，每项 {id, text, type(start|process|decision|end)}
        connections: 连接列表，每项 {from, to, label}

    Returns:
        {drawio_xml, html} 绘图结果
    """
    cells = []
    colors = {
        "start": "#dae8fc", "process": "#d5e8d4",
        "decision": "#ffe6cc", "end": "#f8cecc",
    }
    strokes = {
        "start": "#6c8ebf", "process": "#82b366",
        "decision": "#d79b00", "end": "#b85450",
    }
    styles = {
        "start": "rounded=1;whiteSpace=wrap;html=1;",
        "process": "rounded=1;whiteSpace=wrap;html=1;",
        "decision": "shape=diamond;whiteSpace=wrap;html=1;",
        "end": "rounded=1;whiteSpace=wrap;html=1;",
    }

    y = 20
    for s in steps:
        sid = s["id"]
        stype = s.get("type", "process")
        text = s.get("text", "")
        c = colors.get(stype, "#d5e8d4")
        ec = strokes.get(stype, "#82b366")
        sty = styles.get(stype, "rounded=1;whiteSpace=wrap;html=1;")
        full_style = f"{sty}fillColor={c};strokeColor={ec};fontSize=12;"

        w = 80 if stype == "decision" else 140
        h = 40 if stype == "decision" else 36
        x = 200 if stype == "decision" else 160

        cells.append(_vx(sid, x, y, w, h, text, full_style))
        y += h + 20

    for c in connections:
        cells.append(_edge(
            f"conn_{c['from']}_{c['to']}",
            c["from"], c["to"], c.get("label", ""),
        ))

    drawio_xml = _build_xml(f"流程图: {title}", cells)

    return {"drawio_xml": drawio_xml, "html": ""}


def create_gantt(title: str, tasks: list) -> dict:
    """工具：创建甘特图

    Args:
        title: 项目名称
        tasks: 任务列表，每项 {name, start, duration}

    Returns:
        {drawio_xml, html} 绘图结果
    """
    cells = []
    gantt_colors = ["#dae8fc", "#d5e8d4", "#ffe6cc", "#f8cecc", "#e1d5e7", "#e6c3f2"]

    # Header
    cells.append(_vx("h_task", 20, 10, 100, 30, "任务", "text;html=1;strokeColor=none;fillColor=none;align=right;fontStyle=1;fontSize=12;"))
    cells.append(_vx("h_time", 140, 10, 400, 30, "时间线", "text;html=1;strokeColor=none;fillColor=none;align=left;fontStyle=1;fontSize=12;"))

    for i, t in enumerate(tasks):
        y = 50 + i * 36
        name = t.get("name", f"任务{i+1}")
        start = t.get("start", 0) * 30 + 140
        dur = t.get("duration", 1) * 30
        c = gantt_colors[i % len(gantt_colors)]

        cells.append(_vx(f"l{i}", 20, y, 100, 24, name, "text;html=1;strokeColor=none;fillColor=none;align=right;verticalAlign=middle;fontSize=11;"))
        cells.append(_vx(f"b{i}", start, y, max(dur, 20), 24, "", f"rounded=1;whiteSpace=wrap;html=1;fillColor={c};strokeColor=#666666;fontSize=10;"))

    drawio_xml = _build_xml(f"甘特图: {title}", cells)
    return {"drawio_xml": drawio_xml, "html": ""}


# ── 工具注册表（供 video agent 按名调用） ──

TOOL_REGISTRY = {
    "mindmap": {
        "fn": create_mindmap,
        "params": ["central", "branches"],
        "description": "创建思维导图，适合展示知识结构/分类体系",
    },
    "flowchart": {
        "fn": create_flowchart,
        "params": ["title", "steps", "connections"],
        "description": "创建流程图，适合展示流程步骤/算法路径",
    },
    "gantt": {
        "fn": create_gantt,
        "params": ["title", "tasks"],
        "description": "创建甘特图，适合展示项目进度/时间线",
    },
}


def call_tool(tool_name: str, **kwargs) -> dict:
    """供 video agent 调用的统一入口

    Args:
        tool_name: mindmap / flowchart / gantt
        **kwargs: 对应工具的参数

    Returns:
        {drawio_xml, html} 或 {"error": ...}
    """
    tool = TOOL_REGISTRY.get(tool_name)
    if not tool:
        return {"error": f"未知工具: {tool_name}，可用: {list(TOOL_REGISTRY.keys())}"}

    # 参数校验
    for p in tool["params"]:
        if p not in kwargs:
            return {"error": f"缺少参数: {p}"}

    try:
        return tool["fn"](**kwargs)
    except Exception as e:
        logger.error(f"工具 {tool_name} 调用失败: {e}")
        return {"error": str(e)}
