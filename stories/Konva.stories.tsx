import React, { useEffect } from 'react'
import { WebBlackBoard, HistoryStack, RecordBlackboard } from '../src'
import { Meta } from '@storybook/react'
import clsx from 'clsx'
import './canvas.css'
const SeekerBar = ({
  recorderBoard,
}: {
  recorderBoard?: RecordBlackboard | null
}) => {
  const seekerRef = React.useRef<HTMLDivElement>(null)
  const controlRef = React.useRef<HTMLDivElement>(null)
  const seekRef = React.useRef<HTMLDivElement>(null)
  const bufferRef = React.useRef<HTMLDivElement>(null)
  const [onSeek, set_onSeek] = React.useState<boolean>(false)
  const [isPlaying, set_isPlaying] = React.useState<boolean>(false)
  useEffect(() => {
    if (!recorderBoard) return
    recorderBoard.setCallback(({ data, message }) => {
      set_isPlaying(data.isPlaying)
    })
    recorderBoard.setTimeCallback((timeInfo) => {})
    if (!seekerRef.current) return
    if (!seekRef.current) return
    recorderBoard.setSeeker(seekRef.current, seekerRef.current)
  }, [recorderBoard])
  if (!recorderBoard) return null
  return (
    <div className="audio-controller-wrap">
      <div className="controller-box">
        <div className="bottom-box">
          <div className="btn-box">
            <button
              className="btn"
              onClick={async () => {
                set_isPlaying(!!recorderBoard?.toggleAudio())
              }}
            >
              {isPlaying ? 'pause' : 'play'}
            </button>
          </div>
          <div className="gap" />
          <div className="timeline">
            <div className="wrap" ref={seekerRef}>
              <div className="seeker">
                <div
                  ref={controlRef}
                  className={clsx({ hide: !onSeek }, 'control-bar')}
                >
                  <div className="control-bar-point" />
                </div>
                <div ref={seekRef} className={clsx({ hide: onSeek }, 'seek')}>
                  <div className="seek-point" />
                </div>
                <div className="buffered" ref={bufferRef} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
export const Demo = () => {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const audioRef = React.useRef<HTMLAudioElement>(null)
  const [methods, set_Methods] = React.useState<WebBlackBoard | null>(null)
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
  const [isPlaying, set_isPlaying] = React.useState<boolean>(true)

  const [recorder, set_recorder] = React.useState<RecordBlackboard | null>(null)
  useEffect(() => {
    if (!containerRef.current) return
    const webBoard = new WebBlackBoard(containerRef.current, (values) => {
      set_description(values.message)
      set_stackLength({
        undo: values.data.undoStack.length,
        redo: values.data.redoStack.length,
      })
      // set_isPlaying(values.data.isPlaying)
      set_historyStack(values.data.historyStack)
    })
    set_canvasData(webBoard.currentBrush.getBrushOptions())
    set_Methods(webBoard)
    if (audioRef.current) {
      const recorderBoard = new RecordBlackboard(webBoard, audioRef.current)
      set_recorder(recorderBoard)
    }
  }, [])
  return (
    <div className="canvas-wrap">
      <div className="msg">{description}</div>
      {methods && recorder && (
        <>
          <div className="control-box">
            <div className="buttons">
              <button
                onClick={() => {
                  recorder.startRecording()
                }}
              >
                startRecording
              </button>
              <button
                onClick={() => {
                  recorder.stopRecording()
                }}
              >
                stopRecording
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
                  set_canvasData(methods.setMode('dragging'))
                  set_currentMode('dragging')
                }}
                className={currentMode === 'dragging' ? 'active' : ''}
              >
                dragging
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
          <div className="right">
            <div className="controls">
              {/* upload .zip file */}
              <label htmlFor="file">upload .zip file</label>
              <input
                type="file"
                id="file"
                name="file"
                accept=".zip"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  recorder.handleZipFile(file)
                }}
              />
            </div>
          </div>
        </>
      )}
      <SeekerBar recorderBoard={recorder} />
      <audio ref={audioRef} id={'wb-audio'} controls></audio>
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
