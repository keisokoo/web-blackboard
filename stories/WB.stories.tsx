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

const getToken = async (userId:string) => {
  const response = await fetch(
    'https://dev.fearnot.kr/getToken/' + userId
  )
  const data = await response.json()
  return data.token
}

export const Demo = () => {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const audioRef = React.useRef<HTMLAudioElement>(null)
  const [blackboard, set_blackboard] = React.useState<Blackboard | null>(null)
  const [currentMode, set_currentMode] = React.useState<ModeType>('pen')
  const [controlStacks, set_controlStacks] = React.useState<{
    undoStack: StackType[],
    redoStack: StackType[],
  }>({
    undoStack: [],
    redoStack: [],
  })

  useEffect(() => {
    if (!containerRef.current) return
    async function getTokenAndConnect(blackboard: Blackboard) {
      if (!audioRef.current) return
      const token = await getToken(randomUserId)
      console.log('token', token)
      blackboard.liveControl.init(audioRef.current, 'wss://web-blackboard-p9mq0808.livekit.cloud', token)
    }
    const webBoard = new Blackboard(randomUserId, containerRef.current, {
      stacks: stackSamples, // publisher에게서 받아온 stacks를 이용해, 이 방법 외에도, stackManager.initStacks를 통해 직접 stacks를 초기화 할 수 있음.
      image: `https://i.namu.wiki/i/3_l4kqqEPO_6VJL22_PoUvX_CXM_rM3kIDMND3daznwD7BCQqLEEww0HUPQnB9DPB9yt6A6TQI175slj4Ixwfw.webp`,
      callback: (value) => {
        console.log('callback', value)
        set_controlStacks({
          undoStack: value?.data?.undoStack ?? [],
          redoStack: value?.data?.redoStack ?? [],
        })
      },
    })
    set_blackboard(webBoard)
    getTokenAndConnect(webBoard)
  }, [])
  return (
    <div className="canvas-wrap">
      <div className="control-box">
        <div className="buttons">
          <button
            onClick={() => {
              blackboard?.liveControl.connect()
            }}
            >
              <BiRadioCircle />
            </button>
            <button
            onClick={() => {
              blackboard?.liveControl.disconnect()
            }}
            >
              <BiRadioCircleMarked />
            </button>
          <button
            onClick={() => {
              blackboard?.clear()
            }}
            >
              <BiTrash />
            </button>
          <button
            className={clsx('btn', {
              active: currentMode === 'pen',
            })}
            onClick={() => {
              blackboard?.setMode('pen')
              set_currentMode('pen')
            }}
          >
            <BiBrush />
          </button>
          <button
            className={clsx('btn', {
              active: currentMode === 'marker',
            })}
            onClick={() => {
              blackboard?.setMode('marker')
              set_currentMode('marker')
            }}
          >
            <BiPaintRoll/>
          </button>
          <button
            className={clsx('btn', {
              active: currentMode === 'eraser',
            })}
            onClick={() => {
              blackboard?.setMode('eraser')
              set_currentMode('eraser')
            }}
          >
            <BiEraser />
          </button>
          <button 
            className={clsx('btn', {
              active: currentMode === 'delete',
            })} onClick={() => {
            blackboard?.setMode('delete')
            set_currentMode('delete')
          }
          }>
            <BiSolidEraser />
          </button>
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
          <button
            className="btn"
            onClick={() => {
              blackboard?.setBackground(
                `https://cdn.topstarnews.net/news/photo/202001/723094_437242_2842.jpg`
              )
              // fetch(`https://cdn.topstarnews.net/news/photo/202001/723094_437242_2842.jpg`)
              // .then(response => response.blob())
              // .then(blob => {
              //   const reader = new FileReader();
              //   reader.readAsDataURL(blob);
              //   reader.onloadend = function() {
              //     const base64data = reader.result;
              //     blackboard?.setBackground(base64data as string)
              //   }
              // });
            }}
          >
            <BiImageAdd />
          </button>
          <button
          disabled={controlStacks.undoStack.length === 0}
            onClick={() => {
              blackboard?.stackManager.undo()
            }}
          >
            <BiUndo />
          </button>
          <button
          disabled={controlStacks.redoStack.length === 0}
            onClick={() => {
              blackboard?.stackManager.redo()
            }}
          >
            <BiRedo />
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
