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
import { ModeType, RecordInfoType, StackType } from '../src/app/types'
import { audioDataSample, sampleAudioUrl } from './samples'
import StackPlayer from '../src/app/StackPlayer'

const randomUserId = 'local-' + generateHash()

const SeekerBar = ({ stackPlayer }: { stackPlayer: StackPlayer }) => {
  const seekerRef = React.useRef<HTMLDivElement>(null)
  const controlRef = React.useRef<HTMLDivElement>(null)
  const seekRef = React.useRef<HTMLDivElement>(null)
  const bufferRef = React.useRef<HTMLDivElement>(null)
  const [onSeek, set_onSeek] = React.useState<boolean>(false)
  const [isPlaying, set_isPlaying] = React.useState<boolean>(false)
  useEffect(() => {
    if (!stackPlayer) return
    // stackPlayer.setCallback(({ data, message }) => {
    //   set_isPlaying(data.isPlaying)
    // })
    stackPlayer.setAudioUpdated((timeInfo) => {})
    if (!seekerRef.current) return
    if (!seekRef.current) return

    stackPlayer.setSeeker(seekRef.current, seekerRef.current)
    return () => {
      stackPlayer.destroySeeker()
    }
  }, [stackPlayer])
  return (
    <div className="audio-controller-wrap">
      <div className="controller-box">
        <div className="bottom-box">
          <div className="btn-box">
            <button
              className="btn"
              onClick={async () => {
                set_isPlaying(!!stackPlayer?.toggleAudio())
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
    if (audioRef.current) {
      const recordData: RecordInfoType = {
        ...audioDataSample,
        audioUrl: sampleAudioUrl + audioDataSample.filename,
      }
      webBoard.stackPlayer.setRecord(audioRef.current, recordData)
    }
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
      {blackboard?.stackPlayer && (
        <SeekerBar stackPlayer={blackboard?.stackPlayer} />
      )}
      <audio ref={audioRef}></audio>
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
