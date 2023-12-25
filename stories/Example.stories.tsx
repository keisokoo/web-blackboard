import React, { useCallback, useEffect } from 'react'
import { Meta } from '@storybook/react'
import Blackboard from '../src/app/Blackboard'
import { ModeType, StackType } from '../src/app/types'
import './canvas.css'
import generateHash from '../src/helper/generateHash'
import clsx from 'clsx'
import { BiRadioCircle, BiRadioCircleMarked, BiTrash, BiBrush, BiPaintRoll, BiEraser, BiSolidEraser, BiSolidHand, BiImageAdd, BiUndo, BiRedo, BiXCircle } from 'react-icons/bi'

const randomUserId = 'local-' + generateHash()

interface WebBoardProps {
  userId: string
  roomName: string
  publisher?: boolean // publisher인지 여부, publisher가 아닌 경우에는 stacks를 받아와야 함.
  image?: string // 초기화 배경 이미지
  onClose: () => void
}
const WebBoard = ({ ...props }: WebBoardProps) => {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const audioRef = React.useRef<HTMLAudioElement>(null)
  const [blackboard, set_blackboard] = React.useState<Blackboard | null>(null)
  const [currentMode, set_currentMode] = React.useState<ModeType>(props.publisher ? 'panning' :'pen')
  const [controlStacks, set_controlStacks] = React.useState<{
    undoStack: StackType[],
    redoStack: StackType[],
  }>({
    undoStack: [],
    redoStack: [],
  })
  const [access, set_access] = React.useState<{
    mic: boolean,
    draw: boolean,
  }>({
    mic: props.publisher ?? false,
    draw: props.publisher ?? false,
  })

  const getToken = useCallback(async (userId:string, roomName: string) => {
    const response = await fetch(
      `https://dev.fearnot.kr/getToken/${userId}/${roomName}`
    )
    const data = await response.json()
    return data.token
  }, [])

  useEffect(() => {
    if (!containerRef.current) return
    async function getTokenAndConnect(blackboard: Blackboard) {
      if (!audioRef.current) return
      const token = await getToken(randomUserId, props.roomName)
      console.log('token', token)
      blackboard.liveControl.init(audioRef.current, 'wss://web-blackboard-p9mq0808.livekit.cloud', token)
      blackboard.liveControl.connect()
    }
    const webBoard = new Blackboard(randomUserId, containerRef.current, {
      image: props.image,
      isPublisher: props.publisher,
      callback: (value) => {
        console.log('callback', value)
        set_controlStacks({
          undoStack: value?.data?.undoStack ?? [],
          redoStack: value?.data?.redoStack ?? [],
        })
      },
    })
    if(!props.publisher) {
      webBoard.setMode('panning')
      set_currentMode('panning')
    }
    set_blackboard(webBoard)
    getTokenAndConnect(webBoard)
    return () => {
      blackboard?.liveControl.disconnect()
    }
  }, [])
  return (
    <div className="canvas-wrap">
      <div className="control-box">
        <div className="buttons">
          {/* <button
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
            </button> */}
            {access.draw && (
              <>
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
                className="btn"
                onClick={() => {
                  blackboard?.setBackground(
                    `https://cdn.topstarnews.net/news/photo/202001/723094_437242_2842.jpg`
                  )
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
              </>
            )}
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
              onClick={() => {
                blackboard?.liveControl.disconnect()
                props.onClose()
              }}
            >
              <BiXCircle />
            </button>
        </div>
      </div>
      <audio ref={audioRef} id={'wb-audio'} controls></audio>
      <div ref={containerRef}></div>
    </div>
  )
}

export const Demo = () => {
  const [roomList, set_roomList] = React.useState<
    {
      sid: string
      name: string
      numParticipants: number
      numPublishers: number
    }[]
  >([])
  const [joinRoom, set_joinRoom] = React.useState<WebBoardProps | null>(null)
  const getRoomList = useCallback(async () => {
    const response = await fetch('https://dev.fearnot.kr/room-list', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    const data = await response.json()
    console.log(data)
    set_roomList(data)
  }, [])
  useEffect(() => {
    getRoomList()
  }, [getRoomList])
  if (joinRoom) {
    return (
      <div className="wrap">
        <WebBoard {...joinRoom} />
      </div>
    )
  }
  return (
    <div className="wrap">
      <button onClick={() => {
        set_joinRoom({
          onClose: () => {
            set_joinRoom(null)
          },
          userId: randomUserId,
          roomName: `${randomUserId}-room`,
          publisher: true,
          image: `https://i.namu.wiki/i/3_l4kqqEPO_6VJL22_PoUvX_CXM_rM3kIDMND3daznwD7BCQqLEEww0HUPQnB9DPB9yt6A6TQI175slj4Ixwfw.webp`
        })
      }}>방 개설</button>
      <button
        onClick={() => {
          getRoomList()
        }}
      >
        방 확인
      </button>
      <div className="room-list">
        {roomList.map((room, index) => {
          return (
            <div key={index}>
              name: "{room.name}", publisher: {room.numParticipants},
              participant: {room.numParticipants}<br/>
              <button onClick={() => {
                set_joinRoom({
                  onClose: () => {
                    set_joinRoom(null)
                  },
                  userId: randomUserId,
                  roomName: room.name,
                  publisher: false,
                })
              }}>입장</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default {
  title: 'Example',
  component: Demo,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof Demo>
