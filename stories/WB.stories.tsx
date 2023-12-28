import React, { useEffect } from 'react'
import Blackboard from '../src/app/Blackboard'
import { Meta } from '@storybook/react'
import clsx from 'clsx'
import {
  BiBrush,
  BiEraser,
  BiImage,
  BiImageAdd,
  BiPaintRoll,
  BiRadioCircle,
  BiRadioCircleMarked,
  BiRedo,
  BiSolidEraser,
  BiSolidHand,
  BiTime,
  BiTrash,
  BiUndo,
} from 'react-icons/bi'
import './canvas.css'
import Konva from 'konva'
import generateHash from '../src/helper/generateHash'
import { ModeType, StackType } from '../src/app/types'
import { stackSamples } from './samples'

const randomUserId = 'local-' + generateHash()

export const Demo = () => {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const audioRef = React.useRef<HTMLAudioElement>(null)
  const [blackboard, set_blackboard] = React.useState<Blackboard | null>(null)
  const [currentMode, set_currentMode] = React.useState<ModeType>('panning')
  const [controlStacks, set_controlStacks] = React.useState<{
    undoStack: StackType[]
    redoStack: StackType[]
  }>({
    undoStack: [],
    redoStack: [],
  })

  useEffect(() => {
    if (!containerRef.current) return
    const webBoard = new Blackboard(
      {
        id: randomUserId,
        nickname: 'local',
        role: 'player',
      },
      containerRef.current,
      {
        isPublisher: false,
        callback: (value) => {
          console.log('callback', value)
          set_controlStacks({
            undoStack: value?.data?.undoStack ?? [],
            redoStack: value?.data?.redoStack ?? [],
          })
        },
      }
    )
    set_blackboard(webBoard)
  }, [])
  return (
    <div className="canvas-wrap">
      <div className="control-box">
        <div className="buttons">
          <button
            className={clsx('btn', {
              active: currentMode === 'panning',
            })}
            onClick={() => {
              blackboard?.setMode('panning')
              set_currentMode('panning')
            }}
          >
            <BiSolidHand />
          </button>
        </div>
      </div>
      <audio ref={audioRef} id={'wb-audio'} controls></audio>
      <div ref={containerRef}></div>
    </div>
  )
}

export default {
  title: 'WB',
  component: Demo,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof Demo>
