import { Meta } from '@storybook/react'
import React, { useEffect } from 'react'
import { createBlackboard } from '../src'
import './canvas.css'
export const Demo = () => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const [methods, set_Methods] = React.useState<ReturnType<
    typeof createBlackboard
  > | null>(null)
  const [canvasData, set_CanvasData] = React.useState<{
    brushSize: number
    color: string
  }>({ brushSize: 1, color: '#000000' })
  useEffect(() => {
    if (!canvasRef.current) return
    const canvas = canvasRef.current
    const methods = createBlackboard(canvas)
    set_Methods(methods)
    set_CanvasData(methods.data)
  }, [])
  return (
    <div className="canvas-wrap">
      <h1>Canvas</h1>
      <div className="buttons">
        <button onClick={() => methods?.undo()}>undo</button>
        <button onClick={() => methods?.redo()}>redo</button>
        <button onClick={() => methods?.setDrawingType('eraser')}>
          eraser
        </button>
        <button onClick={() => methods?.setDrawingType('pen')}>pen</button>
      </div>
      <canvas ref={canvasRef} id="canvas" width="400" height="400"></canvas>
      <div className="controls-wrap">
        <div className="controls">
          <label htmlFor="color">color</label>
          <input
            type="color"
            id="color"
            name="color"
            value={canvasData.color}
            onChange={(e) => {
              methods?.setColor(e.target.value)
              set_CanvasData((prev) => ({
                ...prev,
                color: e.target.value,
              }))
            }}
          />
        </div>
        <div className="controls">
          <label htmlFor="brushSize">brushSize</label>
          <input
            type="number"
            id="brushSize"
            name="brushSize"
            value={canvasData.brushSize}
            onChange={(e) => {
              methods?.setBrushSize(Number(e.target.value))
              set_CanvasData((prev) => ({
                ...prev,
                brushSize: Number(e.target.value),
              }))
            }}
          />
        </div>
      </div>
    </div>
  )
}

export default {
  title: 'Canvas',
  component: Demo,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof Demo>
