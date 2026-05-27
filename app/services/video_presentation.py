"""视频演示生成服务

基于 web-video-presentation Skill 的工作流，自动化生成：
1. 口播稿（script）
2. 开发大纲（outline）
3. 分章内容 + narrations
4. 自包含 HTML 演示页面（可选 Auto 模式播放）
5. TTS 音频合成（可选，依赖 QWEN TTS API）
"""
import json
import os
import re
import logging
import httpx
from typing import Optional, List
from datetime import datetime
import requests

from app.core.config import settings
from app.services.diagram_renderer import render_diagram

logger = logging.getLogger(__name__)

VIDEO_DIR = os.path.join(settings.DATA_DIR, "videos")
os.makedirs(VIDEO_DIR, exist_ok=True)

# ── Prompt 模板 ──

SCRIPT_PROMPT = """你是一位顶级纪录片导演兼知识区UP主。根据用户指定的知识点，创作一段**电影级口播稿**（script.md）。

风格要求：
- 以「想象一下……」或「你有没有想过……」等沉浸式开场，3秒内构建画面感
- 全程口语化、有节奏感，像在讲一个引人入胜的故事
- 每句控制在15-20字，长短句交替制造节奏变化
- 运用「比喻」「对比」「设问」等修辞手法，让抽象概念变得生动
- 关键数据/事实用「具体数字+对比参照」的方式呈现（如「比头发丝还细1000倍」）
- 段落之间用「---」分隔，每个段落是一个情绪递进的节拍
- 杜绝「首先/其次/最后」「综上所述」等枯燥结构词
- 每个节拍结尾埋一个「钩子」，引导观众想看下一段
- 总字数不超过2000字，信息密度高，每句话都有信息增量

场景化描写要求：
- 描述关键概念时，加入「屏幕上的视觉元素提示」（如：[画面：代码逐行动态高亮]）
- 重要知识点出现时，插入强调提示（如：[重点] 或 [记住这个]）
- 对比数据展示时，提示表格/图表呈现（如：[表格：展示三种方案的性能差异]）

示例风格：
```
# <标题>

想象一下，你第一次打开编程工具，面对黑乎乎的终端窗口……
是不是有点懵？别急，今天三分钟，让你彻底搞懂它！

---
[画面：一个空盒子逐渐装入不同物品]
其实变量就是个盒子。装数字，它是int；装文字，它是str。
你给它什么，它就装什么——但一次只能装一种！

---
[重点] 记住：不同类型的变量，不能直接混用。
比如 5 + "5" 会报错。为什么？因为一个是数字，一个是文字。
[画面：弹出红色报错提示，TypeError]
这就像问「三斤苹果加两杯水等于多少？」——单位都不一样啊！

---
[表格：展示 int / float / str / bool 四种类型]
Python 内置了四种基础类型。整数、浮点数、字符串、布尔值。
每种都有专属的用法和操作，搞混了就会出 bug。

---
所以下次写代码前，先问问自己：我这个变量，到底是什么类型？
答对了，bug 就少了一半！
```
"""

OUTLINE_PROMPT = """根据口播稿，生成**开发大纲**（outline.md）。

将口播稿按 `---` 分割的节拍，划分成 3-8 个章节。每章有独立主题，包含若干 step。

输出格式：
```
## 1. <chapter-id> — <标题>（<N> steps · ~<T>s）

**信息池**：
- 概念：<知识点说明>

**开发计划**：
- step 1（~<T>s）— <屏幕内容描述>
- step 2（~<T>s）— <屏幕内容描述>

---
## 2. <chapter-id> — <标题>（<N> steps · ~<T>s）
...
```
"""

CHAPTERS_PROMPT = """根据口播稿和开发大纲，为每个章节生成详细的 step 数据。

每步必须包含以下字段：
1. narration: 口播文本（该步说的内容，来自口播稿的节拍）
2. visual_desc: 视觉描述（屏幕上应该展示什么内容、动画效果）
3. visual_type: 视觉类型，可选：
	   - "icon_text"（图标+文字，解释抽象概念）
	   - "image"（配图讲解具体示例）
	   - "table"（表格数据对比）
	   - "bar_chart"（柱状图，数值对比/排名）
	   - "line_chart"（折线图，趋势变化）
	   - "pie_chart"（饼图，占比分布）
	   - "donut_chart"（环形图，占比分布）
	   - "timeline"（时间线/里程碑，历史发展/项目节点）
	   - "mindmap"（思维导图，知识结构/分类体系）
	   - "flowchart"（流程图，流程步骤/算法路径）
	   - "gantt"（甘特图，项目进度/时间线）
4. image_query: 如果 visual_type 为 "image"，提供搜索关键词用于获取配图（如 "Python变量赋值 示意图"），要求具体准确
5. icon_type: 如果 visual_type 为 "icon_text"，提供图标类型，可选 "code"、"brain"、"database"、"book"、"lightbulb"、"chart"、"api"、"shield"、"clock"、"terminal"、"layers"、"star"、"target"、"network"、"puzzle"
6. table_data: 如果 visual_type 为 "table"，提供表格数据（headers: 列标题数组, rows: 行数据二维数组）
7. chart_data: 如果 visual_type 为 bar_chart/line_chart/pie_chart/donut_chart，提供图表数据（title: "图表标题", labels: ["标签1", "标签2"], values: [数值1, 数值2]）。注意：不需要 type 字段，系统根据 visual_type 自动判断
8. mindmap_data: 如果 visual_type 为 "mindmap"，提供思维导图数据（central: "中心主题", branches: [{topic: "分支名", sub_items: ["子项"]}]）
9. flowchart_data: 如果 visual_type 为 "flowchart"，提供流程图数据（title: "流程名", steps: [{id, text, type}], connections: [{from, to, label}]）
10. timeline_data: 如果 visual_type 为 "timeline"，提供时间线数据（title: "标题", milestones: [{date: "时间", title: "事件", description: "描述"}]）
	11. gantt_data: 如果 visual_type 为 "gantt"，提供甘特图数据（title: "项目名", tasks: [{name, start, duration}]）
12. animation_effect: 动画效果，可选 "fade_up"（淡入上滑）、"scale_in"（缩放进入）、"typewriter"（打字机）、"highlight"（高亮强调）
13. duration_seconds: 预计时长（秒，根据口播字数估算，每秒4字）

核心要求：
- 【强制】不得使用 "text" 作为 visual_type
- 【强制】数据对比场景使用 "table" 或 "bar_chart"
- 【强制】趋势变化场景使用 "line_chart"，占比分布使用 "pie_chart" 或 "donut_chart"
- 【强制】历史发展/时间线场景使用 "timeline"
- 【强制】知识结构场景使用 "mindmap"，流程步骤使用 "flowchart"，进度时间线使用 "gantt"
- 【强制】抽象概念优先使用 "icon_text"，具体示例配图使用 "image"
- 【强制】每个 step 必须提供 animation_effect
- image_query 用中文关键词，具体且准确
- 【重要】输出的 JSON 必须严格合法，字段名用双引号，字符串用双引号，不能有尾随逗号
- 【重要】内容不要太长，总共 5-10 步即可，每步 narration 控制在 1-3 句话

输出 JSON 格式（严格输出，不要 markdown 代码块）：
{
  "chapters": [
    {
      "id": "chapter-1",
      "title": "章节标题",
      "steps": [
        {
          "narration": "口播文本",
          "visual_desc": "展示概念图标",
          "visual_type": "icon_text",
          "icon_type": "lightbulb",
          "animation_effect": "fade_up",
          "duration_seconds": 6
        },
        {
          "narration": "数据对比展示",
          "visual_desc": "柱状图展示数据",
          "visual_type": "bar_chart",
          "chart_data": {
            "title": "性能对比",
            "labels": ["方案A", "方案B", "方案C"],
            "values": [95, 72, 88]
          },
          "animation_effect": "fade_up",
          "duration_seconds": 8
        },
        {
          "narration": "发展历程",
          "visual_desc": "时间线展示关键节点",
          "visual_type": "timeline",
          "timeline_data": {
            "title": "发展历程",
            "milestones": [
              {"date": "2016", "title": "诞生", "description": "首个版本"},
              {"date": "2018", "title": "成熟", "description": "生态完善"}
            ]
          },
          "animation_effect": "fade_up",
          "duration_seconds": 10
        }
      ]
    }
  ]
}
"""

THEME_GRADIENTS = [
    "linear-gradient(135deg, #0f0c29, #302b63, #24243e)",
    "linear-gradient(135deg, #0d4f3c, #1a6e5c, #2a8c75)",
    "linear-gradient(135deg, #2d1b69, #4a2d8e, #6b3fa0)",
    "linear-gradient(135deg, #0c2340, #1a4a7a, #2d6fa0)",
    "linear-gradient(135deg, #1a3a2a, #2d5c45, #3d7c60)",
    "linear-gradient(135deg, #3d1f0a, #5c3a1a, #7a5530)",
]


PRESENTATION_TEMPLATE = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
<script src="https://cdn.jsdelivr.net/npm/echarts@5.6.0/dist/echarts.min.js"></script>
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{ background: #000; display: flex; justify-content: center; align-items: center; height: 100vh; font-family: system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif; overflow: hidden; }}
  .stage {{ width: 1920px; height: 1080px; transform-origin: center center; position: relative; overflow: hidden; transition: background 1s ease; }}
  .slide {{ position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 80px; opacity: 0; visibility: hidden; transition: none; pointer-events: none; }}
  .slide.active {{ opacity: 1; visibility: visible; pointer-events: auto; }}
  .slide .narration {{ font-size: 36px; line-height: 1.8; color: #fff; text-align: center; max-width: 1600px; text-shadow: 0 2px 12px rgba(0,0,0,0.3); }}
  .slide .step-indicator {{ position: absolute; bottom: 40px; left: 50%; transform: translateX(-50%); font-size: 14px; color: rgba(255,255,255,0.35); }}
  .chapter-title {{ font-size: 56px; font-weight: 700; color: #fff; text-shadow: 0 2px 12px rgba(0,0,0,0.3); }}
  .chapter-subtitle {{ font-size: 24px; color: rgba(255,255,255,0.5); margin-top: 12px; }}
  .chapter-divider {{ width: 60px; height: 3px; border-radius: 2px; margin: 16px auto; opacity: 0.5; }}

  /* ── 转场特效 ── */
  .slide {{ animation-duration: 0.7s; animation-fill-mode: both; }}
  .slide.fade-in {{ animation-name: vpFadeIn; }}
  .slide.slide-up {{ animation-name: vpSlideUp; }}
  .slide.zoom-in {{ animation-name: vpZoomIn; }}

  @keyframes vpFadeIn {{ from {{ opacity: 0; }} to {{ opacity: 1; }} }}
  @keyframes vpSlideUp {{ from {{ opacity: 0; transform: translateY(60px); }} to {{ opacity: 1; transform: translateY(0); }} }}
  @keyframes vpZoomIn {{ from {{ opacity: 0; transform: scale(0.8); }} to {{ opacity: 1; transform: scale(1); }} }}

  /* ── 配图样式 ── */
  .content-image {{ max-width: 70%; max-height: 45%; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); object-fit: cover; }}

  /* ── 图标样式 ── */
  .content-icon {{ margin: 0 auto 16px; animation: vpIconPop 0.5s ease-out; }}

  /* ── 动画特效 ── */
  .anim-fade-up .narration {{ animation: vpFadeUp 0.8s ease-out both; }}
  .anim-scale-in .narration {{ animation: vpScaleIn 0.7s ease-out both; }}
  .anim-highlight .narration {{ animation: vpHightlight 1s ease-out both; }}
  .anim-fade-up .content-image {{ animation: vpFadeUp 0.6s ease-out both; }}
  .anim-scale-in .content-image {{ animation: vpScaleIn 0.6s ease-out both; }}
  .anim-fade-up .content-table {{ animation: vpFadeUp 0.7s ease-out both; }}
  .anim-fade-up .content-icon {{ animation: vpIconPop 0.5s ease-out both; }}

  /* ── 表格样式 ── */
  .content-table {{ border-collapse: collapse; width: 80%; margin: 16px auto; font-size: 22px; color: #fff; }}
  .content-table th {{ background: rgba(255,255,255,0.15); padding: 12px 16px; font-weight: 600; border: 1px solid rgba(255,255,255,0.15); }}
  .content-table td {{ padding: 10px 16px; border: 1px solid rgba(255,255,255,0.1); text-align: center; }}

  /* ── 背景图片遮罩 ── */
  .stage-bg {{ position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-size: cover; background-position: center; opacity: 0; transition: opacity 1.2s ease; pointer-events: none; }}
  .stage-bg.active {{ opacity: 0.25; }}
  .stage-bg.overlay {{ position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: linear-gradient(135deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.4) 100%); pointer-events: none; }}

  /* ── 控制栏 ── */
  .controls {{ position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); display: flex; gap: 12px; align-items: center; z-index: 100; background: rgba(0,0,0,0.4); padding: 8px 20px; border-radius: 24px; backdrop-filter: blur(8px); }}
  .controls button {{ background: rgba(255,255,255,0.15); border: none; color: #fff; padding: 6px 16px; border-radius: 16px; cursor: pointer; font-size: 13px; }}
  .controls button:hover {{ background: rgba(255,255,255,0.25); }}
  .controls .progress-text {{ color: rgba(255,255,255,0.5); font-size: 12px; }}
  .controls .progress-bar {{ width: 160px; height: 3px; background: rgba(255,255,255,0.15); border-radius: 2px; overflow: hidden; }}
  .controls .progress-bar .fill {{ height: 100%; background: #fff; transition: width 0.3s; }}

  /* ── 全屏 ── */
  .stage.fullscreen {{ width: 100vw !important; height: 100vh !important; transform: none !important; }}

  /* ── 装饰粒子 ── */
  .particles {{ position: absolute; top: 0; left: 0; width: 100%; height: 100%; overflow: hidden; pointer-events: none; }}
  .particles span {{ position: absolute; border-radius: 50%; background: rgba(255,255,255,0.06); }}

  /* ── 进度显示 ── */
  .slide .subtitle {{ font-size: 20px; color: rgba(255,255,255,0.5); margin-top: 8px; }}
</style>
</head>
<body>
<div id="app">
  <div class="stage" id="stage">
    <!-- 背景图片层 -->
    <div class="stage-bg" id="stageBg"></div>
    <div class="stage-bg overlay"></div>
    {slides}
    <div class="particles" id="particles"></div>
  </div>
  <div class="controls" id="controls">
    <button id="playBtn">⏸</button>
    <button id="prevBtn">◀</button>
    <button id="nextBtn">▶</button>
    <div class="progress-bar"><div class="fill" id="progressFill" style="width:0%"></div></div>
    <span class="progress-text" id="progressText">0 / {total_steps}</span>
    <button id="fsBtn" style="font-size:16px;padding:2px 10px;">⛶</button>
  </div>
</div>
<script>
(function(){{
  const slides = document.querySelectorAll('.slide');
  const stage = document.getElementById('stage');
  const bgEl = document.getElementById('stageBg');
  const total = slides.length;
  let current = 0;
  let playing = true;
  let timer = null;
  let isAudioPlaying = false;
  let bgmGain = null;
  let bgmOsc = null;
  let bgmCtx = null;

  const playBtn = document.getElementById('playBtn');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const fsBtn = document.getElementById('fsBtn');
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');

  const durations = [{durations}];
  const audioFiles = [{audio_files}];
  const bgImages = [{bg_images}];
  const transitionTypes = ['slide-up', 'fade-in', 'zoom-in'];
  let currentAudio = null;

  const gradients = [{gradients}];

  /* ── 背景音乐（Web Audio API 生成柔和环境音） ── */
  function startBGM() {{
    try {{
      bgmCtx = new (window.AudioContext || window.webkitAudioContext)();
      bgmGain = bgmCtx.createGain();
      bgmGain.gain.value = 0.035;
      bgmGain.connect(bgmCtx.destination);

      // 柔和 Pad 音色：两个正弦波叠加
      bgmOsc = bgmCtx.createOscillator();
      bgmOsc.type = 'sine';
      bgmOsc.frequency.value = 130.81;
      bgmOsc.connect(bgmGain);

      var bgmOsc2 = bgmCtx.createOscillator();
      bgmOsc2.type = 'sine';
      bgmOsc2.frequency.value = 196.00;
      bgmOsc2.connect(bgmGain);

      bgmOsc.start();
      bgmOsc2.start();
    }} catch(e) {{ /* 浏览器不支持则静默 */ }}
  }}

  function stopBGM() {{
    try {{
      if (bgmOsc) {{ bgmOsc.stop(); bgmOsc.disconnect(); bgmOsc = null; }}
      if (bgmCtx) {{ bgmCtx.close().catch(function(){{}}); bgmCtx = null; }}
    }} catch(e) {{}}
  }}

  /* ── 转场音效（短促上升音） ── */
  function playTransitionSound() {{
    try {{
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    }} catch(e) {{}}
  }}

  function setTheme(idx) {{
    var gi = Math.floor(idx / 3) % gradients.length;
    stage.style.background = gradients[gi];
  }}

  function setBgImage(idx) {{
    if (bgImages[idx]) {{
      bgEl.style.backgroundImage = 'url(' + bgImages[idx] + ')';
      bgEl.classList.add('active');
    }} else {{
      bgEl.classList.remove('active');
    }}
  }}

  function stopAudio() {{
    if (currentAudio) {{
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio.onended = null;
    }}
  }}

  function playAudio(idx, callback) {{
    stopAudio();
    isAudioPlaying = false;
    if (audioFiles[idx]) {{
      try {{
        currentAudio = new Audio(audioFiles[idx]);
        currentAudio.onended = function() {{
          isAudioPlaying = false;
          if (callback) callback();
        }};
        currentAudio.onplay = function() {{ isAudioPlaying = true; }};
        currentAudio.play().catch(function(){{}});
      }} catch(e) {{}}
    }} else if (callback) {{
      // 无音频文件时延迟后回调，留给字幕阅读时间
      timer = setTimeout(callback, Math.max(1500, durations[idx] * 800));
    }}
  }}

  function applyTransition(idx) {{
    var t = transitionTypes[idx % transitionTypes.length];
    slides.forEach(function(s) {{ s.className = 'slide'; }});
    if (slides[idx]) {{
      slides[idx].classList.add('active');
      slides[idx].classList.add(t);
    }}
  }}

  function goTo(idx) {{
    applyTransition(idx);
    current = idx;
    setTheme(idx);
    setBgImage(idx);
    setTimeout(function(){{
      document.querySelectorAll('[data-echart]').forEach(function(el){{
        var inst=echarts.getInstanceByDom(el);
        if(inst)inst.resize();
      }});
    }},200);
    progressFill.style.width = ((idx + 1) / total * 100) + '%';
    progressText.textContent = (idx + 1) + ' / ' + total;

    playTransitionSound();

    if (playing) {{
      playAudio(idx, function() {{
        if (playing && current < total - 1) scheduleNext();
      }});
    }}
  }}

  function next() {{
    if (current >= total - 1) {{ stop(); return; }}
    goTo(current + 1);
  }}

  function prev() {{
    if (current > 0) goTo(current - 1);
  }}

  function scheduleNext() {{
    if (timer) clearTimeout(timer);
    // 如果音频正在播放，等音频结束后再前进
    if (isAudioPlaying) return;
    var d = durations[current] || 5;
    timer = setTimeout(function() {{
      if (playing && current < total - 1) next();
    }}, Math.max(500, d * 200));
  }}

  function stop() {{
    playing = false;
    playBtn.textContent = '▶';
    if (timer) clearTimeout(timer);
    stopAudio();
  }}

  function toggle() {{
    if (!playing) {{
      playing = true;
      playBtn.textContent = '⏸';
      playAudio(current, function() {{
        if (playing && current < total - 1) scheduleNext();
      }});
    }} else {{
      stop();
    }}
  }}

  function toggleFullscreen() {{
    var el = document.querySelector('.stage');
    if (!document.fullscreenElement) {{
      document.documentElement.requestFullscreen().then(function() {{
        el.classList.add('fullscreen');
      }}).catch(function(){{}});
    }} else {{
      document.exitFullscreen();
      el.classList.remove('fullscreen');
    }}
  }}

  document.addEventListener('fullscreenchange', function() {{
    var el = document.querySelector('.stage');
    if (!document.fullscreenElement) {{
      el.classList.remove('fullscreen');
    }}
  }});

  document.addEventListener('keydown', function(e) {{
    if (e.key === ' ' || e.key === 'Space') {{ e.preventDefault(); toggle(); }}
    if (e.key === 'ArrowRight') {{ stop(); stopAudio(); next(); }}
    if (e.key === 'ArrowLeft') {{ stop(); stopAudio(); prev(); }}
    if (e.key === 'f' || e.key === 'F') {{ e.preventDefault(); toggleFullscreen(); }}
  }});

  playBtn.addEventListener('click', toggle);
  prevBtn.addEventListener('click', function() {{ stop(); stopAudio(); prev(); }});
  nextBtn.addEventListener('click', function() {{ stop(); stopAudio(); next(); }});
  fsBtn.addEventListener('click', toggleFullscreen);

  // 初始显示
  goTo(0);
  startBGM();

  // 装饰粒子
  var p = document.getElementById('particles');
  for (var i = 0; i < 24; i++) {{
    var s = document.createElement('span');
    s.style.left = ((i * 37 + 5) % 100) + '%';
    s.style.top = ((i * 53 + 13) % 100) + '%';
    var sz = 4 + (i % 3) * 2;
    s.style.width = sz + 'px'; s.style.height = sz + 'px';
    s.style.animation = 'vpulse ' + (2 + (i % 3)) + 's ease-in-out infinite';
    s.style.animationDelay = (i * 0.3) + 's';
    p.appendChild(s);
  }}
}})();
</script>
<style>
  @keyframes vpulse {{
    0%, 100% {{ opacity: 0.06; transform: scale(1); }}
    50% {{ opacity: 0.2; transform: scale(1.5); }}
  }}
  @keyframes vpFadeIn {{ from {{ opacity: 0; }} to {{ opacity: 1; }} }}
  @keyframes vpSlideUp {{ from {{ opacity: 0; transform: translateY(60px); }} to {{ opacity: 1; transform: translateY(0); }} }}
  @keyframes vpZoomIn {{ from {{ opacity: 0; transform: scale(0.8); }} to {{ opacity: 1; transform: scale(1); }} }}
  @keyframes vpFadeUp {{ from {{ opacity: 0; transform: translateY(30px); }} to {{ opacity: 1; transform: translateY(0); }} }}
  @keyframes vpScaleIn {{ from {{ opacity: 0; transform: scale(0.85); }} to {{ opacity: 1; transform: scale(1); }} }}
  @keyframes vpHightlight {{ 0% {{ opacity: 0.3; transform: scale(0.95); }} 50% {{ opacity: 1; transform: scale(1.03); }} 100% {{ opacity: 1; transform: scale(1); }} }}
  @keyframes vpIconPop {{ 0% {{ opacity: 0; transform: scale(0.3) rotate(-15deg); }} 60% {{ transform: scale(1.2) rotate(5deg); }} 100% {{ opacity: 1; transform: scale(1) rotate(0deg); }} }}
</style>
</body>
</html>"""


class VideoPresentationGenerator:
    """视频演示生成器：生成口播稿 → 大纲 → 章节内容 → HTML 演示页面"""

    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None, model: Optional[str] = None, tts_api_key: Optional[str] = None, unsplash_access_key: Optional[str] = None):
        self.api_key = api_key
        self.base_url = base_url
        self.model = model
        self.tts_api_key = tts_api_key
        self.unsplash_access_key = unsplash_access_key or ""
        self.timeout = 60.0
        self._resolve_config()

    def _resolve_config(self):
        if not self.api_key:
            self.api_key = settings.QWEN_API_KEY or settings.DEEPSEEK_API_KEY
        if not self.base_url:
            if self.api_key == settings.DEEPSEEK_API_KEY:
                self.base_url = settings.DEEPSEEK_BASE_URL
            else:
                self.base_url = settings.QWEN_BASE_URL
        if not self.model:
            if self.base_url and "deepseek" in self.base_url.lower():
                self.model = "deepseek-chat"
            else:
                self.model = "qwen-turbo-latest"

    def _get_image_url(self, query: str, w: int = 1920, h: int = 1080) -> str:
        """通过 Unsplash 官方 API 获取真实图片 URL

        使用同步方式搜索，返回合适尺寸的图片链接。
        """
        if not self.unsplash_access_key or not query:
            return f"https://placehold.co/{w}x{h}/1a1a2e/ffffff?text={query.replace(' ', '+')}"

        try:
            from app.services.unsplash_service import UnsplashService
            service = UnsplashService(access_key=self.unsplash_access_key)
            results = service.search_photos_sync(query, per_page=1, orientation="landscape")
            if results:
                return f"{results[0]['url_raw']}&w={w}&h={h}&fit=crop"
        except Exception as e:
            logger.warning(f"Unsplash 图片获取失败 ({query}): {e}")

        return f"https://placehold.co/{w}x{h}/1a1a2e/ffffff?text={query.replace(' ', '+')}"

    async def _call_llm(self, system_prompt: str, user_prompt: str) -> Optional[str]:
        """调用 LLM"""
        if not self.api_key:
            logger.warning("未配置 API Key")
            return None

        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            }
            payload = {
                "model": self.model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": 0.7,
                "max_tokens": 8192,
            }
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=headers, json=payload,
                )
            if response.status_code != 200:
                logger.error(f"LLM 调用失败: {response.status_code}")
                return None
            result = response.json()
            content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
            return content.strip() if content else None
        except httpx.TimeoutException:
            logger.error(f"LLM 请求超时")
            return None
        except Exception as e:
            logger.error(f"LLM 请求异常: {e}")
            return None

    async def generate_script(self, knowledge_points: List[str]) -> Optional[str]:
        """生成口播稿"""
        topic = "、".join(knowledge_points)
        return await self._call_llm(SCRIPT_PROMPT, f"请为知识点「{topic}」生成口播稿。")

    async def generate_outline(self, script: str) -> Optional[str]:
        """根据口播稿生成开发大纲"""
        return await self._call_llm(OUTLINE_PROMPT, f"口播稿：\n\n{script}")

    def _clean_json_output(self, text: str) -> str:
        """清理 LLM 输出的 JSON 文本，处理常见问题"""
        # 去掉 markdown 代码块包装
        cleaned = re.sub(r'^```(?:json)?\s*', '', text.strip())
        cleaned = re.sub(r'\s*```$', '', cleaned)

        # 提取第一个 { 到最后一个 } 之间的内容
        brace_start = cleaned.find('{')
        brace_end = cleaned.rfind('}')
        if brace_start != -1 and brace_end != -1 and brace_end > brace_start:
            cleaned = cleaned[brace_start:brace_end + 1]

        # 去掉尾随逗号（最后一个 , 在 } 或 ] 之前）
        cleaned = re.sub(r',\s*}', '}', cleaned)
        cleaned = re.sub(r',\s*]', ']', cleaned)

        # 替换单引号为双引号（只在字段名和字符串值中）
        # 简单处理：将没有被双引号包裹的字段名用双引号包裹
        # 替换类似 {key: 为 {"key":
        cleaned = re.sub(r'(?<!")(\b[a-zA-Z_][a-zA-Z0-9_]*\b)(?=\s*:)', r'"\1"', cleaned)

        return cleaned

    async def generate_chapters(self, script: str, outline: str, knowledge_points: List[str]) -> Optional[dict]:
        """生成完整章节数据（含 narrations + visual_desc），带重试"""
        topic = "、".join(knowledge_points)
        prompt = (
            f"知识点：{topic}\n\n"
            f"口播稿：\n{script}\n\n"
            f"开发大纲：\n{outline}\n\n"
            "请严格按照合法 JSON 格式输出每个章节的 step 数据，不要用 markdown 代码块包装。"
            "确保所有字段名用双引号，字符串值用双引号，不能有尾随逗号。"
        )

        # 最多重试 2 次
        for attempt in range(2):
            result = await self._call_llm(CHAPTERS_PROMPT, prompt)
            if not result:
                continue

            # 清理 JSON 文本
            cleaned = self._clean_json_output(result)

            try:
                data = json.loads(cleaned)
                logger.info(f"章节 JSON 解析成功（第 {attempt + 1} 次尝试）")
                break
            except json.JSONDecodeError as e:
                logger.error(f"JSON 解析失败（第 {attempt + 1} 次）: {e}")
                if attempt == 0:
                    # 第一次失败，带错误信息重试
                    prompt += f"\n\n【错误】上次输出的 JSON 格式不合法: {e}\n请重新输出，确保 JSON 严格合法。"
                else:
                    # 第二次失败，返回 None
                    logger.error(f"章节 JSON 最终解析失败，原始输出前500字符: {result[:500]}")
                    return None
        else:
            # 循环正常结束（没有 break），说明两次都失败
            return None

        # ── 调用图表工具丰富图表步骤 ──
        # 对于 visual_type 为 mindmap/flowchart/gantt 的步骤，
        # 自动调用对应的绘图工具生成 draw.io XML
        from app.services.diagram_tools import call_tool

        type_to_tool = {
            "mindmap": ("mindmap", lambda s: {"central": s.get("mindmap_data", {}).get("central", ""),
                                               "branches": s.get("mindmap_data", {}).get("branches", [])}),
            "flowchart": ("flowchart", lambda s: {"title": s.get("flowchart_data", {}).get("title", ""),
                                                   "steps": s.get("flowchart_data", {}).get("steps", []),
                                                   "connections": s.get("flowchart_data", {}).get("connections", [])}),
            "gantt": ("gantt", lambda s: {"title": s.get("gantt_data", {}).get("title", ""),
                                           "tasks": s.get("gantt_data", {}).get("tasks", [])}),
        }

        for ch in data.get("chapters", []):
            for step in ch.get("steps", []):
                vt = step.get("visual_type", "")
                if vt in type_to_tool:
                    tool_name, arg_fn = type_to_tool[vt]
                    args = arg_fn(step)
                    if args.get("central") or args.get("title") or args.get("steps"):
                        result = call_tool(tool_name, **args)
                        if "drawio_xml" in result:
                            step["drawio_xml"] = result["drawio_xml"]
                            step["diagram_html"] = result.get("html", "")

        return data


    def _build_echarts_html(self, chart_data: dict, step_idx: int) -> str:
        """ECharts 图表 HTML（bar/line/pie/donut），渲染到 Canvas"""
        import json as _json
        ctype = chart_data.get("type", "bar")
        title = chart_data.get("title", "")
        labels = chart_data.get("labels", [])
        values = chart_data.get("values", [])
        if not values or not labels:
            return ""
        eid = "echart-" + str(step_idx)
        tc = "#fff"
        if ctype in ("pie", "donut"):
            series_data = [{"name": labels[i], "value": v} for i, v in enumerate(values)]
            option = {
                "title": {"text": title, "left": "center", "textStyle": {"color": tc, "fontSize": 16}},
                "tooltip": {"trigger": "item", "backgroundColor": "rgba(255,255,255,0.08)", "borderColor": "transparent"},
                "legend": {"bottom": 10, "textStyle": {"color": tc, "fontSize": 12}},
                "series": [{
                    "type": "pie",
                    "radius": ["40%", "65%"] if ctype == "donut" else ["0%", "70%"],
                    "center": ["50%", "55%"],
                    "data": series_data,
                    "label": {"color": tc, "fontSize": 13},
                    "itemStyle": {"borderRadius": 4},
                }],
                "backgroundColor": "transparent",
            }
        else:
            option = {
                "title": {"text": title, "left": "center", "textStyle": {"color": tc, "fontSize": 16}},
                "tooltip": {"trigger": "axis", "backgroundColor": "rgba(255,255,255,0.08)", "borderColor": "transparent"},
                "grid": {"left": 50, "right": 20, "bottom": 40, "top": 50},
                "xAxis": {"type": "category", "data": labels, "axisLabel": {"color": tc, "fontSize": 12}},
                "yAxis": {"type": "value", "axisLabel": {"color": tc, "fontSize": 11}, "splitLine": {"lineStyle": {"color": "rgba(255,255,255,0.1)"}}},
                "series": [{
                    "type": "bar" if ctype == "bar" else "line",
                    "data": values,
                    "itemStyle": {"color": "#4fc3f7", "borderRadius": [4, 4, 0, 0]},
                    "lineStyle": {"color": "#4fc3f7", "width": 3},
                    "symbol": "circle" if ctype == "line" else "none",
                    "smooth": True if ctype == "line" else False,
                }],
                "backgroundColor": "transparent",
            }
            if ctype == "bar":
                option["series"][0].pop("symbol", None)
                option["series"][0].pop("smooth", None)
            elif ctype == "line":
                option["series"][0]["areaStyle"] = {"color": "rgba(79,195,247,0.15)"}

        opt_json = _json.dumps(option, ensure_ascii=False)
        div = '<div id="' + eid + '" data-echart="1" style="width:90%;max-width:600px;height:320px;margin:0 auto 12px;"></div>'
        script = '<script>(function(){var el=document.getElementById("' + eid + '");if(el&&typeof echarts!=="undefined"){var c=echarts.init(el);c.setOption(' + opt_json + ');window.addEventListener("resize",function(){c.resize();});}})();</script>'
        return div + script

    def _build_timeline_html(self, timeline_data: dict) -> str:
        """生成时间线/里程碑 HTML"""
        milestones = timeline_data.get("milestones", [])
        title = timeline_data.get("title", "")
        if not milestones:
            return ""
        html = ""
        if title:
            html += '<div style="color:rgba(255,255,255,0.7);font-size:16px;margin-bottom:16px;font-weight:600;text-align:center;">' + title + '</div>'
        colors = ["#4fc3f7", "#81c784", "#ffb74d", "#e57373", "#ba68c8", "#4db6ac"]
        for i, m in enumerate(milestones):
            c = colors[i % len(colors)]
            date = m.get("date", "")
            mt = m.get("title", "")
            desc = m.get("description", "")
            html += '<div style="display:flex;align-items:flex-start;margin:6px 0;padding-left:50px;">'
            html += '<div style="width:14px;height:14px;border-radius:50%;background:' + c + ';margin:4px 10px 0 0;flex-shrink:0;box-shadow:0 0 8px rgba(0,0,0,0.3);"></div>'
            html += '<div style="flex:1;"><span style="color:' + c + ';font-weight:600;font-size:14px;">' + mt + '</span>'
            if date:
                html += ' <span style="color:rgba(255,255,255,0.4);font-size:12px;">' + date + '</span>'
            if desc:
                html += '<div style="color:rgba(255,255,255,0.5);font-size:12px;margin-top:2px;">' + desc + '</div>'
            html += '</div></div>'
        return '<div style="width:100%;max-width:550px;margin:0 auto;position:relative;">' + html + '</div>'
    ICON_SVGS = {
        "code": '<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="1.5"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
        "brain": '<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="1.5"><path d="M12 2a4 4 0 0 1 4 4c0 1.1-.4 2-1 2.7V10c0 1.1-.9 2-2 2s-2-.9-2-2V8.7c-.6-.7-1-1.6-1-2.7a4 4 0 0 1 4-4z"/><path d="M12 14c2.2 0 6 1.1 6 3v2H6v-2c0-1.9 3.8-3 6-3z"/></svg>',
        "database": '<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="1.5"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
        "book": '<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="1.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
        "lightbulb": '<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="1.5"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/></svg>',
        "star": '<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
        "chart": '<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="1.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
        "api": '<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="1.5"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>',
        "shield": '<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
        "clock": '<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
        "terminal": '<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="1.5"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>',
        "layers": '<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="1.5"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
        "target": '<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
        "network": '<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="1.5"><rect x="2" y="2" width="8" height="8" rx="1"/><rect x="14" y="2" width="8" height="8" rx="1"/><rect x="2" y="14" width="8" height="8" rx="1"/><rect x="14" y="14" width="8" height="8" rx="1"/></svg>',
        "puzzle": '<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="1.5"><path d="M19 5h-2V3h-2v2h-2V3H9v2H7v2h2v2H7v2h2v2H7v2h2v2h2v-2h2v2h2v-2h2v-2h-2v-2h2V9h-2V7h2V5z"/></svg>',
        "settings": '<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>',
    }

    def build_presentation_html(self, title: str, chapters: list, output_path: str):
        """生成自包含 HTML 演示页面，含背景图、图标、图表、表格、配图、转场特效、背景音乐"""
        slides_html = ""
        durations = []
        audio_files = []
        bg_images = []
        step_count = 0
        total_duration = 0

        # 主题关键词（用于背景图）
        topic_keywords = title.lower().replace(" ", ",")

        for ch in chapters:
            ch_id = ch.get("id", "")
            ch_title = ch.get("title", "")
            ch_steps = ch.get("steps", [])
            ch_keywords = ch_title.lower().replace(" ", ",")

            # 章节标题页背景图
            ch_bg = self._get_image_url(ch_keywords or topic_keywords)
            bg_images.append(ch_bg)

            # 章节标题页
            slides_html += f'''
            <div class="slide" data-chapter="{ch_id}">
              <div class="chapter-title">{ch_title}</div>
              <div class="chapter-divider" style="background: rgba(255,255,255,0.3);"></div>
              <div class="chapter-subtitle">{len(ch_steps)} 步</div>
              <div class="step-indicator">第 {step_count + 1} 步</div>
            </div>'''
            step_count += 1
            durations.append(3)
            audio_files.append("")

            for s in ch_steps:
                narration = s.get("narration", "")
                dur = s.get("duration_seconds", 5)
                audio_file = s.get("audio_file", "")
                visual_type = s.get("visual_type", "icon_text")
                anim_effect = s.get("animation_effect", "fade_up")

                # 内容步背景图
                img_query = s.get("image_query", "") or ch_keywords or topic_keywords
                bg_images.append(self._get_image_url(img_query))

                # 构建内容 HTML（支持图标/图片/图表/表格/文字多种组合）
                content_html = ""

                # 概念图标
                icon_type = s.get("icon_type", "")
                if visual_type == "icon_text" and icon_type in self.ICON_SVGS:
                    content_html += f'<div class="content-icon">{self.ICON_SVGS[icon_type]}</div>'

                # 配图
                if visual_type == "image":
                    img_url = self._get_image_url(img_query, 800, 450)
                    content_html += f'''<img class="content-image" src="{img_url}" alt="{narration[:50]}" loading="lazy" onerror="this.style.display=\'none\'"/>'''

                # ECharts 图表（bar_chart/line_chart/pie_chart/donut_chart）
                echart_types = {"bar_chart", "line_chart", "pie_chart", "donut_chart", "chart"}
                if visual_type in echart_types:
                    cd = s.get("chart_data", {})
                    type_map = {"bar_chart": "bar", "line_chart": "line", "pie_chart": "pie", "donut_chart": "donut", "chart": "bar"}
                    cd["type"] = type_map.get(visual_type, "bar")
                    ch = self._build_echarts_html(cd, step_count)
                    if ch:
                        content_html += ch

                # Timeline
                if visual_type == "timeline":
                    tl = s.get("timeline_data", {})
                    th = self._build_timeline_html(tl)
                    if th:
                        content_html += th

                # 表格
                if visual_type == "table":
                    tbl = s.get("table_data", {})
                    headers = tbl.get("headers", [])
                    rows = tbl.get("rows", [])
                    if headers and rows:
                        thead = "".join(f"<th>{h}</th>" for h in headers)
                        trows = "".join(
                            "<tr>" + "".join(f"<td>{c}</td>" for c in row) + "</tr>"
                            for row in rows
                        )
                        content_html += f'''<table class="content-table"><thead><tr>{thead}</tr></thead><tbody>{trows}</tbody></table>'''

                # 图表类型（思维导图/流程图/甘特图）
                diagram_visual_types = {"mindmap", "flowchart", "gantt"}
                if visual_type in diagram_visual_types:
                    # 优先使用预渲染的 diagram_html，否则用 renderer 现场生成
                    diagram_html = s.get("diagram_html", "")
                    if not diagram_html:
                        type_to_data = {
                            "mindmap": ("mindmap", s.get("mindmap_data", {})),
                            "flowchart": ("flowchart", s.get("flowchart_data", {})),
                            "gantt": ("gantt", s.get("gantt_data", {})),
                        }
                        _, ddata = type_to_data.get(visual_type, (visual_type, {}))
                        diagram_html = render_diagram(visual_type, ddata)
                    if diagram_html:
                        content_html += f'<div class="diagram-container" style="width:100%;max-width:650px;margin:0 auto 16px;">{diagram_html}</div>'

                # 旁白文字
                content_html += f'<div class="narration">{narration}</div>'

                # 动画特效 class
                anim_class = ""
                if anim_effect in ("fade_up",):
                    anim_class = "anim-fade-up"
                elif anim_effect == "scale_in":
                    anim_class = "anim-scale-in"
                elif anim_effect == "highlight":
                    anim_class = "anim-highlight"

                slides_html += f'''
                <div class="slide {anim_class}" data-chapter="{ch_id}">
                  {content_html}
                  <div class="step-indicator">第 {step_count + 1} 步</div>
                </div>'''
                step_count += 1
                durations.append(dur)
                audio_files.append(audio_file)
                total_duration += dur

        # JS 数组字符串
        audio_js = ", ".join(f'"{f}"' for f in audio_files)
        bg_js = ", ".join(f'"{g}"' for g in bg_images)
        grads_js = ", ".join(f'"{g}"' for g in THEME_GRADIENTS)

        html = PRESENTATION_TEMPLATE.format(
            title=title,
            slides=slides_html,
            total_steps=step_count,
            total_duration=total_duration,
            durations=", ".join(str(d) for d in durations),
            audio_files=audio_js,
            bg_images=bg_js,
            gradients=grads_js,
        )

        with open(output_path, "w", encoding="utf-8") as f:
            f.write(html)
        return html

    async def generate_audio_for_step(self, text: str, output_path: str) -> bool:
        """使用 QWEN TTS 为一段文本生成音频

        调用阿里云 DashScope qwen-tts 模型，使用 Cherry 音色。
        从 output.audio.url 下载 WAV 文件保存到本地。
        """
        if not text:
            return False
        try:
            import dashscope
            from dashscope.audio.qwen_tts import SpeechSynthesizer

            # 设置 API Key：优先使用独立 TTS Key，其次使用 LLM API Key
            tts_key = self.tts_api_key or self.api_key
            if tts_key:
                dashscope.api_key = tts_key

            result = SpeechSynthesizer.call(
                model="qwen-tts",
                text=text,
                voice="Cherry",
                format="wav",
                rate=1.0,
            )

            if hasattr(result, 'status_code') and result.status_code == 200:
                output = result.output
                if isinstance(output, str):
                    output = json.loads(output)

                audio_url = output.get('audio', {}).get('url', '') if isinstance(output, dict) else ''
                if audio_url:
                    resp = requests.get(audio_url, timeout=30)
                    if resp.status_code == 200:
                        with open(output_path, 'wb') as f:
                            f.write(resp.content)
                        logger.info(f"TTS 音频已生成: {output_path} ({len(resp.content)} bytes)")
                        return True
                    else:
                        logger.error(f"音频下载失败: {resp.status_code}")
                else:
                    logger.error(f"TTS 响应无 audio URL: {str(output)[:200]}")
            else:
                status = getattr(result, 'status_code', 'unknown')
                msg = getattr(result, 'message', str(result))[:200]
                logger.error(f"TTS 调用失败: status={status}, msg={msg}")
            return False
        except ImportError:
            logger.warning("dashscope 未安装，无法生成音频")
            return False
        except Exception as e:
            logger.error(f"TTS 生成失败: {e}")
            return False
