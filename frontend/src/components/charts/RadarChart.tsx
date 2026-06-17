import { useEffect, useRef } from 'react'
import * as d3 from 'd3'

interface RadarChartProps {
  dimensions: {
    name: string
    value: number  // 0-1
    color: string
  }[]
  size?: number
  className?: string
}

export default function RadarChart({ dimensions, size = 280, className }: RadarChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current || !dimensions.length) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const margin = 40
    const radius = (size - margin * 2) / 2
    const cx = size / 2
    const cy = size / 2
    const levels = 5

    const angleSlice = (Math.PI * 2) / dimensions.length

    const g = svg
      .attr('width', size)
      .attr('height', size)
      .append('g')
      .attr('transform', `translate(${cx}, ${cy})`)

    // Scale
    const rScale = d3
      .scaleLinear()
      .range([0, radius])
      .domain([0, 1])

    // Background grid (concentric circles)
    for (let level = 1; level <= levels; level++) {
      const r = (radius / levels) * level
      g.append('circle')
        .attr('r', r)
        .attr('fill', 'none')
        .attr('stroke', level === levels ? 'var(--app-border)' : 'var(--app-bg-page)')
        .attr('strokeWidth', level === levels ? 1.5 : 1)
        .attr('strokeDasharray', level === levels ? 'none' : '3,3')

      // Level labels
      if (level === levels) {
        g.append('text')
          .attr('x', 5)
          .attr('y', -r + 12)
          .attr('fill', 'var(--app-text-muted)')
          .attr('fontSize', '0.5625rem')
          .text('100%')
      }
    }

    // Axes
    for (let i = 0; i < dimensions.length; i++) {
      const angle = angleSlice * i - Math.PI / 2
      const x = radius * Math.cos(angle)
      const y = radius * Math.sin(angle)

      // Axis line
      g.append('line')
        .attr('x1', 0)
        .attr('y1', 0)
        .attr('x2', x)
        .attr('y2', y)
        .attr('stroke', 'var(--app-border)')
        .attr('strokeWidth', 1)

      // Axis label
      const labelX = (radius + 30) * Math.cos(angle)
      const labelY = (radius + 30) * Math.sin(angle)

      g.append('text')
        .attr('x', labelX)
        .attr('y', labelY)
        .attr('textAnchor', 'middle')
        .attr('dominantBaseline', 'middle')
        .attr('fill', 'var(--app-text-secondary)')
        .attr('fontSize', '0.75rem')
        .attr('fontWeight', 600)
        .text(dimensions[i].name)
    }

    // Data polygon
    const points = dimensions.map((d, i) => {
      const angle = angleSlice * i - Math.PI / 2
      return [rScale(d.value) * Math.cos(angle), rScale(d.value) * Math.sin(angle)]
    })

    // Filled area
    g.append('polygon')
      .attr('points', points.map(p => p.join(',')).join(' '))
      .attr('fill', 'url(#radarGradient)')
      .attr('stroke', 'var(--app-indigo)')
      .attr('strokeWidth', 2)
      .attr('fillOpacity', 0.5)

    // Gradient definition
    const defs = svg.append('defs')
    const gradient = defs
      .append('linearGradient')
      .attr('id', 'radarGradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '100%')
      .attr('y2', '100%')

    gradient.append('stop').attr('offset', '0%').attr('stop-color', 'var(--app-indigo)').attr('stop-opacity', 0.4)
    gradient.append('stop').attr('offset', '100%').attr('stop-color', 'var(--app-purple)').attr('stop-opacity', 0.15)

    // Data points
    for (let i = 0; i < dimensions.length; i++) {
      const angle = angleSlice * i - Math.PI / 2
      const x = rScale(dimensions[i].value) * Math.cos(angle)
      const y = rScale(dimensions[i].value) * Math.sin(angle)

      g.append('circle')
        .attr('cx', x)
        .attr('cy', y)
        .attr('r', 5)
        .attr('fill', 'white')
        .attr('stroke', dimensions[i].color)
        .attr('strokeWidth', 2.5)

      // Value label
      const labelOffset = 16
      const lx = (rScale(dimensions[i].value) + labelOffset) * Math.cos(angle)
      const ly = (rScale(dimensions[i].value) + labelOffset) * Math.sin(angle)

      g.append('text')
        .attr('x', lx)
        .attr('y', ly)
        .attr('textAnchor', 'middle')
        .attr('dominantBaseline', 'middle')
        .attr('fill', dimensions[i].color)
        .attr('fontSize', '0.75rem')
        .attr('fontWeight', 700)
        .text(`${Math.round(dimensions[i].value * 100)}%`)
    }
  }, [dimensions, size])

  return (
    <div className={className} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg ref={svgRef} />
    </div>
  )
}
