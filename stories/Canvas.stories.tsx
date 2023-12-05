import { Meta } from '@storybook/react'
import React, { useEffect } from 'react'
import { createBlackboard } from '../src'

export const Demo = () => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const [methods, set_Methods] = React.useState<ReturnType<
    typeof createBlackboard
  > | null>(null)
  useEffect(() => {
    if (!canvasRef.current) return
    const canvas = canvasRef.current
    const methods = createBlackboard(canvas)
    set_Methods(methods)
  }, [])
  return (
    <div>
      <h1>Canvas</h1>
      <button onClick={() => methods?.undo()}>undo</button>
      <button onClick={() => methods?.redo()}>redo</button>
      <button onClick={() => methods?.setDrawingType('eraser')}>eraser</button>
      <button onClick={() => methods?.setDrawingType('pen')}>pen</button>
      <canvas ref={canvasRef} id="canvas" width="400" height="400"></canvas>
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
