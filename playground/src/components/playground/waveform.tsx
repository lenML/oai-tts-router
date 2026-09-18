import { useEffect, useRef } from 'react'

interface WaveformProps {
  values: number[]
  progress: number
  onSeek: (progress: number) => void
}

function drawWaveform(canvas: HTMLCanvasElement, values: number[], progress: number): void {
  const rect = canvas.getBoundingClientRect()
  const width = Math.max(1, rect.width)
  const height = Math.max(1, rect.height)
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(height * dpr)

  const context = canvas.getContext('2d')
  if (!context) return
  context.setTransform(dpr, 0, 0, dpr, 0, 0)
  context.clearRect(0, 0, width, height)

  const styles = getComputedStyle(canvas)
  const playedColor = styles.getPropertyValue('--primary').trim() || '#fafafa'
  const idleColor = styles.getPropertyValue('--muted-foreground').trim() || '#71717a'
  const centerY = height / 2
  const gap = 2
  const barWidth = Math.max(1.5, width / values.length - gap)
  const progressX = width * progress

  values.forEach((value, index) => {
    const x = (index / values.length) * width
    const barHeight = Math.max(3, value * height * 0.78)
    context.fillStyle = x <= progressX ? playedColor : idleColor
    context.globalAlpha = x <= progressX ? 1 : 0.42
    context.beginPath()
    context.roundRect(x, centerY - barHeight / 2, barWidth, barHeight, barWidth / 2)
    context.fill()
  })

  context.globalAlpha = 1
}

export function Waveform({ values, progress, onSeek }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const render = () => drawWaveform(canvas, values, progress)
    render()

    const observer = new ResizeObserver(render)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [values, progress])

  const seekFromPointer = (clientX: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    onSeek(Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)))
  }

  return (
    <canvas
      ref={canvasRef}
      className="h-36 w-full cursor-crosshair touch-none outline-none focus-visible:ring-2 focus-visible:ring-ring"
      role="slider"
      tabIndex={0}
      aria-label="Audio position"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      onClick={event => seekFromPointer(event.clientX)}
      onKeyDown={event => {
        if (event.key === 'ArrowLeft') onSeek(Math.max(0, progress - 0.02))
        if (event.key === 'ArrowRight') onSeek(Math.min(1, progress + 0.02))
        if (event.key === 'Home') onSeek(0)
        if (event.key === 'End') onSeek(1)
      }}
    />
  )
}
