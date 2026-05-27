import { useEffect, useRef } from 'react'
import * as d3 from 'd3'

interface TrendChartProps {
  data: { date: string; value: number }[]
  height?: number
  color?: string
  label?: string
  className?: string
}

export default function TrendChart({
  data,
  height = 200,
  color = 'var(--app-indigo)',
  label = '整体掌握度',
  className,
}: TrendChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current || !data.length) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const margin = { top: 20, right: 20, bottom: 35, left: 50 }
    const width = svgRef.current.clientWidth - margin.left - margin.right
    const h = height - margin.top - margin.bottom

    const x = d3
      .scaleTime()
      .domain(d3.extent(data, d => new Date(d.date)) as [Date, Date])
      .range([0, width])

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(data, d => d.value) || 100])
      .nice()
      .range([h, 0])

    const line = d3
      .line<{ date: string; value: number }>()
      .x(d => x(new Date(d.date)))
      .y(d => y(d.value))
      .curve(d3.curveCatmullRom)

    const area = d3
      .area<{ date: string; value: number }>()
      .x(d => x(new Date(d.date)))
      .y0(h)
      .y1(d => y(d.value))
      .curve(d3.curveCatmullRom)

    const g = svg
      .attr('width', '100%')
      .attr('height', height)
      .style('display', 'block')
      .append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`)

    // Gradient area
    const defs = svg.append('defs')
    const gradient = defs
      .append('linearGradient')
      .attr('id', `areaGradient-${color.replace('#', '')}`)
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%')

    gradient.append('stop').attr('offset', '0%').attr('stop-color', color).attr('stop-opacity', 0.2)
    gradient.append('stop').attr('offset', '100%').attr('stop-color', color).attr('stop-opacity', 0.02)

    // X axis
    g.append('g')
      .attr('transform', `translate(0, ${h})`)
      .call(d3.axisBottom(x).ticks(Math.min(data.length, 7)).tickFormat(d3.timeFormat('%m/%d') as any))
      .selectAll('text')
      .attr('fill', 'var(--app-text-muted)')
      .attr('fontSize', '0.625rem')

    // Y axis
    g.append('g')
      .call(d3.axisLeft(y).ticks(5).tickFormat(d => `${d}%`))
      .selectAll('text')
      .attr('fill', 'var(--app-text-muted)')
      .attr('fontSize', '0.625rem')

    // Grid lines
    g.append('g')
      .selectAll('line')
      .data(y.ticks(5))
      .enter()
      .append('line')
      .attr('x1', 0)
      .attr('x2', width)
      .attr('y1', d => y(d))
      .attr('y2', d => y(d))
      .attr('stroke', 'var(--app-bg-page)')
      .attr('strokeWidth', 1)

    // Area
    g.append('path')
      .datum(data)
      .attr('d', area)
      .attr('fill', `url(#areaGradient-${color.replace('#', '')})`)

    // Line
    g.append('path')
      .datum(data)
      .attr('d', line)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('strokeWidth', 2)

    // Dots
    g.selectAll('circle')
      .data(data)
      .enter()
      .append('circle')
      .attr('cx', d => x(new Date(d.date)))
      .attr('cy', d => y(d.value))
      .attr('r', 3)
      .attr('fill', color)
      .attr('stroke', 'white')
      .attr('strokeWidth', 1.5)

    // Label
    svg.append('text')
      .attr('x', margin.left)
      .attr('y', 12)
      .attr('fill', 'var(--app-text-secondary)')
      .attr('fontSize', '0.75rem')
      .attr('fontWeight', 600)
      .text(label)

  }, [data, height, color, label])

  if (!data.length) {
    return (
      <div className={className} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: `${height}px`, color: 'var(--app-text-placeholder)', fontSize: '0.875rem',
      }}>
        暂无学习数据
      </div>
    )
  }

  return (
    <div className={className}>
      <svg ref={svgRef} />
    </div>
  )
}
