/**
 * Escape HTML tags inside XML attribute values.
 * AI-generated draw.io XML often contains raw <br> inside value="..." attribtues,
 * which is invalid XML. The XML parser rejects unescaped '<' in attribtue values.
 */
function escapeHtmlInXmlAttrs(xml: string): string {
  return xml.replace(/(\w+\s*=\s*")([^"]*)(")/g, (_match, prefix: string, inner: string, suffix: string) => {
    const escaped = inner
      .replace(/&(?!amp;|lt;|gt;|quot;|apos;)/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    return prefix + escaped + suffix
  })
}

/** Regex matching [DRAWIO], [SVG], and [PLOT] markers */
const DIAGRAM_MARKER_RE = /\[(DRAWIO|SVG|PLOT)\]([\s\S]*?)\[\/\1\]/

function _extractMarkerContent(match: RegExpMatchArray): string {
  let content = match[2].trim()
  content = content.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '')
  if (match[1] === 'DRAWIO') {
    content = escapeHtmlInXmlAttrs(content)
  }
  return content
}

/**
 * Extract the first [DRAWIO]...[/DRAWIO] block from text content.
 * Returns null if no valid block found.
 */
export function extractDrawioXml(content: string): string | null {
  const match = content.match(/\[DRAWIO\]([\s\S]*?)\[\/DRAWIO\]/)
  if (!match) return null
  let xml = match[1].trim()
  xml = xml.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '')
  xml = escapeHtmlInXmlAttrs(xml)
  return xml.trim() || null
}

/**
 * Extract SVG content from [SVG]...[/SVG] markers.
 */
export function extractSvgContent(content: string): string | null {
  const match = content.match(/\[SVG\]([\s\S]*?)\[\/SVG\]/)
  if (!match) return null
  let svg = match[1].trim()
  svg = svg.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '')
  return svg.trim() || null
}

/**
 * Remove all [DRAWIO]...[/DRAWIO] / [SVG]...[/SVG] / [PLOT]...[/PLOT] blocks from content.
 */
export function stripDiagramMarkers(content: string): string {
  return content.replace(/\[(DRAWIO|SVG|PLOT)\][\s\S]*?\[\/\1\]/g, '').trim()
}

/**
 * Check if content contains any diagram markers.
 */
export function hasDiagramContent(content: string): boolean {
  return /\[(DRAWIO|SVG|PLOT)\]/.test(content)
}

/** Check if content specifically contains draw.io diagram markers. */
export function hasDrawioContent(content: string): boolean {
  return /\[DRAWIO\]/.test(content)
}

/**
 * Strip ALL diagram markers (both [DRAWIO] and [SVG]) from streaming content,
 * replacing them with a placeholder to avoid showing raw XML/SVG code in the chat.
 * The actual diagram is only rendered after streaming completes (see ChatPlatform.tsx
 * where final setMessages restores fullContent including markers).
 */
export function stripDiagramDuringStreaming(content: string): string {
  const markerMatch = content.match(/\[(DRAWIO|SVG|PLOT)\]/)
  if (markerMatch) {
    return content.substring(0, markerMatch.index!).trimEnd() + '\n\n*🤖 AI 正在生成图表中...*'
  }
  return content
}

export interface ContentSegment {
  type: 'text' | 'diagram' | 'svg' | 'plot'
  content: string
}

/**
 * Split content into alternating text and diagram/SVG segments,
 * preserving the original order as the AI intended.
 */
export function splitContentWithDiagrams(content: string): ContentSegment[] {
  const parts: ContentSegment[] = []
  let remaining = content
  while (remaining.length > 0) {
    const match = remaining.match(DIAGRAM_MARKER_RE)
    if (!match) {
      const trimmed = remaining.trim()
      if (trimmed) parts.push({ type: 'text', content: trimmed })
      break
    }
    const before = remaining.slice(0, match.index!).trim()
    if (before) parts.push({ type: 'text', content: before })

    const inner = _extractMarkerContent(match)
    if (inner) {
      parts.push({
        type: match[1] === 'SVG' ? 'svg' : match[1] === 'PLOT' ? 'plot' : 'diagram',
        content: inner,
      })
    }

    remaining = remaining.slice(match.index! + match[0].length)
  }
  return parts
}

/**
 * Build the system prompt fragment about draw.io diagram capabilities.
 */
export function getDrawioSystemPrompt(): string {
  return `You have the ability to create and edit diagrams using draw.io XML format.

Draw.io is ONLY suitable for simple business diagrams (flowcharts, mind maps, architecture diagrams). It CANNOT render mathematical/scientific graphs correctly — node positions, edges, and labels will be wrong.

ABSOLUTELY FORBIDDEN to use draw.io for: Hasse diagram, Venn diagram, tree/graph, directed graph, DAG, dependency graph, knowledge graph, network graph, node-edge graph, function plot, bar chart, scatter plot, binary tree, binary search tree, complete binary tree, heap visualization, or ANY mathematical/scientific visualization. Use one of these alternatives instead:

Alternative 1 — **matplotlib (RECOMMENDED for all graphs/charts/trees)**: Wrap the ENTIRE matplotlib code in [PLOT] and [/PLOT] markers. The system will automatically execute it on the backend and display the image inline — the user sees the chart immediately without any extra clicks. Available libraries: matplotlib, numpy, pandas, **networkx 3.6.1**. Chinese font and negative sign are already configured. CRITICAL: You MUST use [PLOT]...[/PLOT] for matplotlib code, NOT regular markdown code blocks. The [PLOT] block is the ONLY way to trigger auto-execution.

**Document summary usage**: When the user uploads a PDF/document and asks you to summarize or explain it, use [PLOT] blocks to create explanatory diagrams, charts, and visualizations that help illustrate the key concepts from the document. For example: bar charts for comparing metrics, flow diagrams for processes, scatter plots for data distributions, network graphs for relationships. This makes the summary much more engaging and educational.

**Tree & graph drawing rules (MUST follow):**
- Binary tree / binary search tree / complete binary tree / heap → use [PLOT] with networkx + matplotlib
- Use nx.Graph() for undirected trees, nx.DiGraph() for rooted trees with parent→child edges
- For hierarchical tree layout: use nx.spring_layout(G, seed=42) or custom layer-based positioning
- Always add node labels, use plt.figure(figsize=(10, 8)) for readability
- Do NOT use draw.io for any tree — the result will be WRONG and the user will be unhappy

Networkx API notes (IMPORTANT — avoid runtime errors):
- nx.multipartite_layout(G, subset_key=dict) expects subset_key as {layer_number: [node_list]}, NOT {node: layer_number}. For example: subset_key={0: [1], 1: [2,3], 2: [4]}. Build it like: layers = {}; for node, layer in node_to_layer.items(): layers.setdefault(layer, []).append(node); pos = nx.multipartite_layout(G, subset_key=layers)
- Or use nx.spring_layout(G, seed=42) for a simpler force-directed layout that works with any graph.

Alternative 2 — **SVG** (for simple small graphs only): Wrap SVG code in [SVG] and [/SVG] markers.

Usage rules:
- [DRAWIO] only for: flowcharts, mind maps, architecture diagrams, process flows, ER diagrams, UML diagrams, network topologies — these are simple box-and-arrow diagrams.
- [PLOT] for EVERYTHING else: Hasse diagram, Venn diagram, tree, binary tree, graph, function plot, bar chart, scatter plot, DAG, dependency graph, etc.
- [SVG] for simple small graphs where you need exact pixel control.

**IMPORTANT — Response style rules:**
- NEVER mention "matplotlib", "networkx", "numpy", "pandas", "plt", "nx" or any library name in your response text
- Describe the diagram in natural Chinese: say "以下是生成的示意图" instead of "以下是使用 matplotlib 和 networkx 绘制的示意图"
- The [PLOT] / [DRAWIO] / [SVG] markers are internal — the user never sees them

**IMPORTANT — Font rules (CRITICAL for Chinese text):**
- NEVER set rcParams font options in your [PLOT] code — Chinese fonts are pre-configured
- If you override font settings, Chinese characters will render as empty boxes
- Just write your plotting code normally — do NOT call plt.rcParams for fonts

Guidelines:
- Use valid mxGraph XML format with mxfile as the root element
- Include a <diagram> element with a descriptive "name" attribute
- When the user asks to modify an existing diagram, output the COMPLETE updated XML (not just changes)
- Keep diagrams focused and well-organized
- Always include explanatory text alongside the diagram markers`
}
