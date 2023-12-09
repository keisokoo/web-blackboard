import React, { useEffect } from 'react'
import { KonvaBoard, HistoryStack } from '../src'
import { Meta } from '@storybook/react'
import './canvas.css'

export const Demo = () => {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [methods, set_Methods] = React.useState<KonvaBoard | null>(null)
  const [description, set_description] = React.useState<string>('')
  const [canvasData, set_canvasData] = React.useState<{
    brushSize: number
    color: string
  }>({ brushSize: 1, color: '#000000' })
  const [currentMode, set_currentMode] = React.useState<string>('brush')
  const [stackLength, set_stackLength] = React.useState<{
    undo: number
    redo: number
  }>({ undo: 0, redo: 0 })
  const [historyStack, set_historyStack] = React.useState<
    HistoryStack[] | null
  >(null)
  const [isPlaying, set_isPlaying] = React.useState<boolean>(false)
  useEffect(() => {
    if (!containerRef.current) return
    const konvaBoard = new KonvaBoard(containerRef.current, (values) => {
      set_description(values.message)
      set_stackLength({
        undo: values.data.undoStack.length,
        redo: values.data.redoStack.length,
      })
      set_isPlaying(values.data.isPlaying)
      set_historyStack(values.data.historyStack)
    })
    set_canvasData(konvaBoard.currentBrush.getBrushOptions())
    set_Methods(konvaBoard)
  }, [])
  return (
    <div className="canvas-wrap">
      <div className="msg">{description}</div>
      {methods && !isPlaying && (
        <div className="control-box">
          <div className="buttons">
            <button
              disabled={!historyStack || historyStack.length === 0}
              onClick={() => {
                if (!historyStack) return
                methods.playHistoryStack(historyStack)
              }}
            >
              playHistoryStack
            </button>
            <button
              disabled={stackLength.undo === 0}
              onClick={() => {
                methods.undo()
              }}
            >
              undo ({stackLength.undo})
            </button>
            <button
              disabled={stackLength.redo === 0}
              onClick={() => {
                methods.redo()
              }}
            >
              redo ({stackLength.redo})
            </button>
            <button
              onClick={() => {
                set_canvasData(methods.setMode('brush'))
                set_currentMode('brush')
              }}
              className={currentMode === 'brush' ? 'active' : ''}
            >
              brush
            </button>
            <button
              onClick={() => {
                set_canvasData(methods.setMode('eraser'))
                set_currentMode('eraser')
              }}
              className={currentMode === 'eraser' ? 'active' : ''}
            >
              eraser
            </button>
            <button
              onClick={() => {
                set_canvasData(methods.setMode('delete'))
                set_currentMode('delete')
              }}
              className={currentMode === 'delete' ? 'active' : ''}
            >
              delete
            </button>
            <div className="controls flex-center">
              <label
                htmlFor="color"
                className="brush-style"
                style={{
                  backgroundColor: canvasData.color,
                  width: canvasData.brushSize + 'px',
                  height: canvasData.brushSize + 'px',
                  borderRadius:
                    currentMode === 'brush'
                      ? canvasData.brushSize + 'px'
                      : '0px',
                }}
              >
                <input
                  disabled={currentMode === 'delete'}
                  type="color"
                  id="color"
                  name="color"
                  value={canvasData.color}
                  onChange={(e) => {
                    const changed = methods.setColor(e.target.value)
                    set_canvasData(changed)
                  }}
                />
              </label>
            </div>
            <div className="controls flex-center" style={{ width: '180px' }}>
              <label htmlFor="brushSize">{canvasData.brushSize}px</label>
              <input
                disabled={currentMode === 'delete'}
                type="range"
                min="1"
                max="30"
                id="brushSize"
                name="brushSize"
                value={canvasData.brushSize}
                onChange={(e) => {
                  const changed = methods.setBrushSize(Number(e.target.value))
                  set_canvasData(changed)
                }}
              />
            </div>
          </div>
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
