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

/**
 * Extract the first [DRAWIO]...[/DRAWIO] block from text content.
 * Returns null if no valid block found.
 */
export function extractDrawioXml(content: string): string | null {
  const match = content.match(/\[DRAWIO\]([\s\S]*?)\[\/DRAWIO\]/)
  if (!match) return null
  let xml = match[1].trim()
  // Strip markdown code fences if the AI wraps XML in ```xml ... ```
  xml = xml.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '')
  // Sanitize: escape raw HTML tags in attribute values (AI often emits <br> etc. unescaped)
  xml = escapeHtmlInXmlAttrs(xml)
  return xml.trim() || null
}

/**
 * Remove all [DRAWIO]...[/DRAWIO] blocks from content for display rendering.
 */
export function stripDrawioMarkers(content: string): string {
  return content.replace(/\[DRAWIO\][\s\S]*?\[\/DRAWIO\]/g, '').trim()
}

/**
 * Check if content contains draw.io diagram markers.
 */
export function hasDrawioContent(content: string): boolean {
  return /\[DRAWIO\]/.test(content)
}

/**
 * Strip incomplete [DRAWIO] blocks (without closing [/DRAWIO]) from streaming content,
 * replacing them with a placeholder to avoid showing raw XML code in the chat.
 */
export function stripIncompleteDrawio(content: string): string {
  if (content.includes('[DRAWIO]') && !content.includes('[/DRAWIO]')) {
    const idx = content.indexOf('[DRAWIO]')
    return content.substring(0, idx).trimEnd() + '\n\n*🤖 AI 正在生成图表中...*'
  }
  return content
}

export interface ContentSegment {
  type: 'text' | 'diagram'
  content: string
}

/**
 * Split content into alternating text and diagram segments,
 * preserving the original order as the AI intended.
 */
export function splitContentWithDiagrams(content: string): ContentSegment[] {
  const parts: ContentSegment[] = []
  let remaining = content
  while (remaining.length > 0) {
    const match = remaining.match(/\[DRAWIO\]([\s\S]*?)\[\/DRAWIO\]/)
    if (!match) {
      const trimmed = remaining.trim()
      if (trimmed) parts.push({ type: 'text', content: trimmed })
      break
    }
    const before = remaining.slice(0, match.index!).trim()
    if (before) parts.push({ type: 'text', content: before })

    let xml = match[1].trim()
    xml = xml.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '')
    xml = escapeHtmlInXmlAttrs(xml)
    if (xml) parts.push({ type: 'diagram', content: xml })

    remaining = remaining.slice(match.index! + match[0].length)
  }
  return parts
}

/**
 * Build the system prompt fragment about draw.io diagram capabilities.
 */
export function getDrawioSystemPrompt(): string {
  return `You have the ability to create and edit diagrams using draw.io XML format.

When the user requests a diagram (flowchart, mind map, architecture diagram, process flow, entity-relation diagram, network topology, UML diagram, etc.), include the draw.io diagram XML between [DRAWIO] and [/DRAWIO] markers. Place each marker on its own line.

Example format:
[DRAWIO]
<mxfile host="app.diagrams.net">
  <diagram name="Diagram Name" id="example">
    <mxGraphModel dx="1000" dy="600" grid="1" gridSize="10">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
        <!-- shapes and connectors -->
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
[/DRAWIO]

Guidelines:
- Use valid mxGraph XML format with mxfile as the root element
- Include a <diagram> element with a descriptive "name" attribute
- When the user asks to modify an existing diagram, output the COMPLETE updated XML (not just changes)
- Support: flowcharts, ER diagrams, network topologies, architecture diagrams, mind maps, process flows, UML diagrams, and more
- Keep diagrams focused and well-organized
- Always include explanatory text alongside the diagram markers`
}
