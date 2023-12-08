import React, { useEffect } from 'react'
import { KonvaBoard } from '../src'
import { Meta } from '@storybook/react'
import './canvas.css'

export const Demo = () => {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [methods, set_Methods] = React.useState<KonvaBoard | null>(null)
  const [canvasData, set_canvasData] = React.useState<string>('')
  useEffect(() => {
    if (!containerRef.current) return
    const konvaBoard = new KonvaBoard(containerRef.current, (data) => {
      set_canvasData(data)
    })
    set_Methods(konvaBoard)
  }, [])
  return (
    <div className="canvas-wrap">
      <canvas id="cursor" width="50" height="50"></canvas>
      <div className="msg">{canvasData}</div>
      {methods && (
        <div className="buttons">
          <button
            onClick={() => {
              methods.modeChange('brush')
            }}
          >
            brush
          </button>
          <button
            onClick={() => {
              methods.modeChange('eraser')
            }}
          >
            eraser
          </button>
          <button
            onClick={() => {
              methods.modeChange('erase-line')
            }}
          >
            erase-line
          </button>
        </div>
      )}
      <div ref={containerRef}></div>
    </div>
  )
}

export default {
  title: 'Konva',
  component: Demo,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof Demo>
