import { useRef, useEffect, useState } from 'react'
import * as d3 from 'd3'

interface DataPoint {
  date: string
  accuracy: number
  total_questions: number
}

interface Props {
  data: DataPoint[]
  height?: number
}

export default function AccuracyChart({ data, height = 250 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 600, height })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setDimensions({ width: entry.contentRect.width, height })
      }
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [height])

  useEffect(() => {
    if (!data.length) return
    const { width } = dimensions
    const h = height
    const margin = { top: 20, right: 20, bottom: 40, left: 40 }
    const innerW = width - margin.left - margin.right
    const innerH = h - margin.top - margin.bottom

    // Create SVG
    const svg = d3.select(containerRef.current).select('svg')
    svg.selectAll('*').remove()

    if (innerW <= 0 || innerH <= 0) return

    const g = svg
      .attr('width', width)
      .attr('height', h)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    // Scales
    const x = d3.scalePoint()
      .domain(data.map(d => d.date))
      .range([0, innerW])
      .padding(0.1)

    const y = d3.scaleLinear()
      .domain([0, 100])
      .range([innerH, 0])
      .nice()

    // Grid lines
    g.append('g')
      .call(d3.axisLeft(y).ticks(5).tickFormat(d => `${d}%`))
      .selectAll('line')
      .attr('stroke', 'var(--app-border)')
      .attr('stroke-dasharray', '3,3')
    g.selectAll('.domain').attr('stroke', 'var(--app-border)')
    g.selectAll('.tick text').attr('fill', 'var(--app-text-muted)').attr('font-size', '11')

    // X axis
    const tickValues = data.length > 10
      ? data.filter((_, i) => i % Math.ceil(data.length / 7) === 0).map(d => d.date)
      : data.map(d => d.date)
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).tickValues(tickValues))
      .selectAll('text')
      .attr('fill', 'var(--app-text-muted)')
      .attr('font-size', '10')
      .attr('text-anchor', 'end')
      .attr('transform', 'rotate(-45)')
    g.selectAll('.domain').attr('stroke', 'var(--app-border)')

    // Area fill
    const area = d3.area<DataPoint>()
      .x(d => x(d.date)!)
      .y0(y(0))
      .y1(d => y(d.accuracy))
      .curve(d3.curveMonotoneX)

    g.append('path')
      .datum(data)
      .attr('fill', 'url(#gradient)')
      .attr('d', area)

    // Gradient
    const gradient = svg.append('defs')
      .append('linearGradient')
      .attr('id', 'accuracy-gradient')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '0%').attr('y2', '100%')

    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', 'var(--app-brand)')
      .attr('stop-opacity', 0.15)

    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', 'var(--app-brand)')
      .attr('stop-opacity', 0.01)

    // Line
    const line = d3.line<DataPoint>()
      .x(d => x(d.date)!)
      .y(d => y(d.accuracy))
      .curve(d3.curveMonotoneX)

    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', 'var(--app-brand)')
      .attr('stroke-width', 2.5)
      .attr('d', line)

    // Dots
    g.selectAll('.dot')
      .data(data)
      .enter()
      .append('circle')
      .attr('cx', d => x(d.date)!)
      .attr('cy', d => y(d.accuracy))
      .attr('r', 4)
      .attr('fill', 'var(--app-brand)')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)

    // Tooltip on hover
    const tooltip = d3.select(containerRef.current)
      .append('div')
      .attr('class', 'chart-tooltip')
      .style('position', 'absolute')
      .style('background', 'var(--app-text-heading)')
      .style('color', '#fff')
      .style('padding', '8px 12px')
      .style('border-radius', '8px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('opacity', 0)
      .style('transform', 'translateY(-100%)')
      .style('white-space', 'nowrap')
      .style('z-index', 10)

    g.selectAll('.dot-hover')
      .data(data)
      .enter()
      .append('circle')
      .attr('cx', d => x(d.date)!)
      .attr('cy', d => y(d.accuracy))
      .attr('r', 12)
      .attr('fill', 'transparent')
      .attr('cursor', 'pointer')
      .on('mouseenter', (event, d) => {
        tooltip
          .style('opacity', 1)
          .html(`${d.date}<br/>正确率: ${d.accuracy}%<br/>总题: ${d.total_questions}`)
        const [mx] = d3.pointer(event, containerRef.current)
        tooltip
          .style('left', `${mx}px`)
          .style('top', `${margin.top - 8}px`)
      })
      .on('mouseleave', () => {
        tooltip.style('opacity', 0)
      })

  }, [data, dimensions])

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', minHeight: height }}>
      {data.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height, color: 'var(--app-text-placeholder)', fontSize: '14px' }}>
          暂无统计数据
        </div>
      ) : (
        <svg />
      )}
    </div>
  )
}
