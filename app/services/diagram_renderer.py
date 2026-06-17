"""图表渲染服务

将结构化图表数据（思维导图、流程图、甘特图）渲染为自包含的 HTML 代码，
用于嵌入视频演示页面。纯 CSS/SVG 实现，无外部依赖。
"""

import logging
import html as html_mod

logger = logging.getLogger(__name__)


# ── Mind Map ──

def render_mindmap(data: dict) -> str:
    """渲染思维导图为 HTML tree

    data 格式:
    {
      "central": "主题",
      "branches": [
        {"topic": "分支1", "sub_items": ["子项1", "子项2", "子项3"]},
        {"topic": "分支2", "sub_items": ["子项A"]},
      ]
    }
    """
    central = html_mod.escape(data.get("central", "主题"))
    branches = data.get("branches", [])

    if not branches:
        return f'<div style="text-align:center;padding:20px;color:white;font-size:24px;">{central}</div>'

    # Build branch HTML
    branches_html = ""
    for i, b in enumerate(branches):
        topic = html_mod.escape(b.get("topic", ""))
        items = b.get("sub_items", [])
        items_html = "".join(
            f'<div style="padding:4px 10px;margin:2px 0;background:rgba(255,255,255,0.08);border-radius:6px;font-size:13px;line-height:1.4;">{html_mod.escape(item)}</div>'
            for item in items
        )

        # Alternate colors per branch
        colors = ["#4fc3f7", "#81c784", "#ffb74d", "#e57373", "#ba68c8", "#4db6ac"]
        color = colors[i % len(colors)]

        branches_html += f"""
        <div style="flex:1;min-width:120px;max-width:200px;display:flex;flex-direction:column;align-items:center;gap:6px;position:relative;">
          <div style="width:2px;height:20px;background:{color};opacity:0.5;"></div>
          <div style="padding:8px 14px;border-radius:8px;background:{color};color:#fff;font-size:14px;font-weight:600;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.2);width:100%;">
            {topic}
          </div>
          {('<div style="width:2px;height:12px;background:rgba(255,255,255,0.2);"></div>' + items_html) if items else ''}
        </div>"""

    return f"""
    <div style="width:100%;max-width:700px;margin:0 auto;display:flex;flex-direction:column;align-items:center;gap:8px;">
      <div style="padding:10px 24px;border-radius:12px;background:rgba(255,255,255,0.15);color:#fff;font-size:20px;font-weight:700;text-align:center;box-shadow:0 3px 12px rgba(0,0,0,0.3);backdrop-filter:blur(4px);">
        {central}
      </div>
      <div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-top:8px;">
        {branches_html}
      </div>
    </div>"""


# ── Flowchart ──

def render_flowchart(data: dict) -> str:
    """渲染流程图

    data 格式:
    {
      "title": "流程名称",
      "steps": [
        {"id": "1", "text": "开始", "type": "start"},
        {"id": "2", "text": "处理步骤", "type": "process"},
        {"id": "3", "text": "判断条件", "type": "decision"},
        {"id": "4", "text": "结束", "type": "end"},
      ],
      "connections": [
        {"from": "1", "to": "2", "label": ""},
        {"from": "2", "to": "3", "label": ""},
        {"from": "3", "to": "4", "label": "是"},
        {"from": "3", "to": "2", "label": "否"},
      ]
    }
    """
    steps = data.get("steps", [])
    connections = data.get("connections", [])

    if not steps:
        return ""

    title = html_mod.escape(data.get("title", ""))
    title_html = f'<div style="color:rgba(255,255,255,0.7);font-size:14px;margin-bottom:8px;font-weight:500;">{title}</div>' if title else ""

    # Build step map
    step_map = {s["id"]: s for s in steps}

    # Determine layout: left-to-right flowchart
    steps_html = ""
    for s in steps:
        sid = s["id"]
        text = html_mod.escape(s.get("text", ""))
        stype = s.get("type", "process")

        if stype == "start" or stype == "end":
            style = "border-radius:20px;background:rgba(255,255,255,0.12);border:2px solid rgba(255,255,255,0.3);"
            color = "#4fc3f7" if stype == "start" else "#e57373"
        elif stype == "decision":
            style = "border-radius:4px;background:rgba(255,255,255,0.08);border:2px solid #ffb74d;transform:rotate(0deg);"
            color = "#ffb74d"
        else:
            style = "border-radius:6px;background:rgba(255,255,255,0.08);border:2px solid rgba(255,255,255,0.2);"
            color = "rgba(255,255,255,0.5)"

        # Outgoing connections
        outgoing = [c for c in connections if c.get("from") == sid]
        arrows_html = ""
        for oc in outgoing:
            target = step_map.get(oc["to"])
            if target:
                label = oc.get("label", "")
                label_html = f'<span style="font-size:10px;color:{color};margin:0 4px;">{html_mod.escape(label)}</span>' if label else ""
                arrows_html += f'<div style="display:flex;align-items:center;gap:4px;"><span style="color:rgba(255,255,255,0.3);font-size:16px;">↓</span>{label_html}</div>'

        steps_html += f"""
        <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
          <div style="padding:8px 18px;{style}color:#fff;font-size:14px;font-weight:500;text-align:center;min-width:80px;box-shadow:0 2px 6px rgba(0,0,0,0.15);">
            {text}
          </div>
          {arrows_html}
        </div>"""

    return f"""
    <div style="width:100%;max-width:600px;margin:0 auto;display:flex;flex-direction:column;align-items:center;">
      {title_html}
      <div style="display:flex;flex-direction:column;align-items:center;gap:0;">
        {steps_html}
      </div>
    </div>"""


# ── Gantt Chart ──

def render_gantt(data: dict) -> str:
    """渲染甘特图

    data 格式:
    {
      "title": "项目进度",
      "tasks": [
        {"name": "需求分析", "start": 0, "duration": 3},
        {"name": "系统设计", "start": 3, "duration": 4},
        {"name": "开发实现", "start": 7, "duration": 6},
        {"name": "测试部署", "start": 13, "duration": 3},
      ]
    }
    """
    tasks = data.get("tasks", [])
    if not tasks:
        return ""

    title = html_mod.escape(data.get("title", ""))
    title_html = f'<div style="color:rgba(255,255,255,0.7);font-size:14px;margin-bottom:10px;font-weight:500;">{title}</div>' if title else ""

    # Calculate total width
    max_end = max((t.get("start", 0) + t.get("duration", 1)) for t in tasks)
    total_cols = max(max_end, 10)

    # Header with time columns
    header_cols = ""
    for i in range(0, total_cols + 1, max(1, total_cols // 8)):
        header_cols += f'<div style="flex:1;text-align:center;font-size:10px;color:rgba(255,255,255,0.3);min-width:24px;">{i}</div>'

    colors = ["#4fc3f7", "#81c784", "#ffb74d", "#e57373", "#ba68c8", "#4db6ac", "#fff176", "#a1887f"]

    task_rows = ""
    for i, t in enumerate(tasks):
        name = html_mod.escape(t.get("name", ""))
        start = t.get("start", 0)
        dur = t.get("duration", 1)
        pct_left = (start / max(1, total_cols)) * 100
        pct_width = (dur / max(1, total_cols)) * 100
        color = colors[i % len(colors)]

        task_rows += f"""
        <div style="display:flex;align-items:center;gap:8px;margin:4px 0;">
          <div style="width:80px;font-size:12px;color:rgba(255,255,255,0.7);text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:0;">{name}</div>
          <div style="flex:1;height:24px;position:relative;border-radius:4px;overflow:hidden;">
            <div style="position:absolute;left:{pct_left:.1f}%;width:{pct_width:.1f}%;height:100%;border-radius:4px;background:{color};opacity:0.85;min-width:4px;box-shadow:0 1px 4px rgba(0,0,0,0.2);"></div>
          </div>
        </div>"""

    return f"""
    <div style="width:100%;max-width:650px;margin:0 auto;">
      {title_html}
      <div style="display:flex;gap:0;margin-bottom:4px;padding-left:88px;">
        {header_cols}
      </div>
      {task_rows}
    </div>"""


# ── Dispatcher ──

def render_diagram(visual_type: str, data: dict) -> str:
    """根据 visual_type 分发到对应的渲染函数

    Returns:
        渲染后的 HTML 字符串，空数据时返回空字符串
    """
    if not data:
        return ""

    renderers = {
        "mindmap": render_mindmap,
        "flowchart": render_flowchart,
        "gantt": render_gantt,
    }
    renderer = renderers.get(visual_type)
    if renderer:
        try:
            return renderer(data)
        except Exception as e:
            logger.warning(f"图表渲染失败 ({visual_type}): {e}")
            return ""
    return ""
