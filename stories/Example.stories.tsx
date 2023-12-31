import React, { useCallback, useEffect } from 'react'
import { Meta } from '@storybook/react'
import Blackboard from '../src/app/Blackboard'
import { EgressInfo, ModeType, RoleType, StackType } from '../src/app/types'
import './canvas.css'
import generateHash from '../src/helper/generateHash'
import clsx from 'clsx'
import {
  BiTrash,
  BiBrush,
  BiPaintRoll,
  BiEraser,
  BiSolidEraser,
  BiSolidHand,
  BiImageAdd,
  BiUndo,
  BiRedo,
  BiXCircle,
  BiUser,
  BiAlarm,
} from 'react-icons/bi'
import { ParticipantInfo } from 'livekit-client/src/proto/livekit_models_pb'

const randomUserId = {
  id: 'user-' + generateHash(),
  nickname: 'nick' + Date.now(),
}
interface WebBoardProps {
  user: {
    id: string
    nickname: string
  }
  roomName: string
  publisher?: boolean // publisher인지 여부, publisher가 아닌 경우에는 stacks를 받아와야 함.
  image?: string // 초기화 배경 이미지
  onClose: () => void
}
type AccessParticipantType = ParticipantInfo & {
  access: {
    mic: boolean
    draw: boolean
  }
}
const WebBoard = ({ ...props }: WebBoardProps) => {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const audioRef = React.useRef<HTMLAudioElement>(null)
  const [blackboard, set_blackboard] = React.useState<Blackboard | null>(null)
  const [currentMode, set_currentMode] = React.useState<ModeType>(
    props.publisher ? 'panning' : 'pen'
  )
  const [pending, set_pending] = React.useState<boolean>(
    props.publisher ? true : false
  )
  const [controlStacks, set_controlStacks] = React.useState<{
    undoStack: StackType[]
    redoStack: StackType[]
  }>({
    undoStack: [],
    redoStack: [],
  })
  const [userList, set_userList] = React.useState<
    AccessParticipantType[] | null
  >(null)
  const [access, set_access] = React.useState<{
    mic: boolean
    draw: boolean
  }>({
    mic: props.publisher ?? false,
    draw: props.publisher ?? false,
  })
  const deleteCurrentRoom = useCallback(async () => {
    if (!props.roomName) return
    if (!props.publisher) return
    const response = await fetch(
      `https://dev-api.obj.kr/delete/${props.roomName}`,
      {
        method: 'DELETE',
      }
    )
    return response
  }, [])

  const getUserList = useCallback(async (roomName: string) => {
    const response = await fetch(`https://dev-api.obj.kr/user-list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        roomName,
      }),
    })
    const data = await response.json()
    console.log('user-list', data)
    return data as ParticipantInfo[]
  }, [])
  const createRoom = useCallback(async (roomName: string) => {
    const response = await fetch(`https://dev-api.obj.kr/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        roomName,
      }),
    })
    const room = await response.json()
    return room
  }, [])
  const generateToken = useCallback(
    async (
      roomName: string,
      option: {
        name: string
        identity: string
        role: RoleType
      }
    ) => {
      const response = await fetch(`https://dev-api.obj.kr/generateToken`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomName,
          option,
          isPublisher: props.publisher ? true : false,
        }),
      })
      const data = await response.json()
      return data.token
    },
    []
  )
  const startRecording = useCallback(async (roomName: string) => {
    const recording = await fetch(`https://dev-api.obj.kr/start-recording`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        roomName,
      }),
    })
    const recordingData = (await recording.json()) as {
      message: string
      data?: {
        egressInfo: EgressInfo
      }
    }
    return recordingData.data?.egressInfo ?? null
  }, [])
  const stopRecording = useCallback(
    async (egressId: string, isCancel: boolean = false) => {
      const recording = await fetch(`https://dev-api.obj.kr/stop-recording`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          egressId,
          isCancel,
        }),
      })
      const recordingData = (await recording.json()) as {
        message: string
        data?: {
          egressInfo: EgressInfo
        }
      }
      const egressInfo = recordingData.data?.egressInfo ?? null
      return egressInfo
    },
    []
  )
  useEffect(() => {
    if (!containerRef.current) return
    async function getTokenAndConnect(blackboard: Blackboard) {
      if (!audioRef.current) return
      if (props.publisher) {
        const room = await createRoom(props.roomName)
        console.log('room', room)
      }
      const token = await generateToken(props.roomName, {
        name: props.user.nickname,
        identity: props.user.id,
        role: props.publisher ? 'presenter' : 'audience',
      })
      console.log(props.publisher, 'token', token)
      blackboard.liveControl.init(
        audioRef.current,
        'wss://web-blackboard-p9mq0808.livekit.cloud',
        token
      )
      blackboard.liveControl.connect()
    }
    const webBoard = new Blackboard(
      {
        ...randomUserId,
        role: props.publisher ? 'presenter' : 'audience',
      },
      containerRef.current,
      {
        image: props.image,
        isPublisher: props.publisher,
        callback: (value) => {
          console.log('callback', value)
          set_controlStacks({
            undoStack: value?.data?.undoStack ?? [],
            redoStack: value?.data?.redoStack ?? [],
          })
          value.data?.access && set_access(value.data.access)
          if (value.message === 'record start') {
            set_pending(false)
          }
        },
      }
    )
    webBoard.setOnClose(props.onClose)
    // webBoard.liveControl.setRecording({
    //   start: startRecording,
    //   stop: stopRecording,
    // })
    set_pending(false)
    webBoard.setChatCallback((data) => {
      console.log('chat', data.nickname, data.message)
    })
    if (!props.publisher) {
      webBoard.setMode('panning')
      set_currentMode('panning')
    }
    set_blackboard(webBoard)
    // getTokenAndConnect(webBoard)
    return () => {
      blackboard?.liveControl.disconnect()
    }
  }, [])
  return (
    <>
      {pending && <div className="pending">pending...</div>}
      <div className="canvas-wrap">
        {userList && (
          <div className="user-wrap">
            <button
              onClick={() => {
                set_userList(null)
              }}
            >
              Close
            </button>
            <div className="user-list">
              {userList.map((user, index) => {
                return (
                  <div key={index}>
                    <span>
                      {user.name} (
                      {user.metadata === 'presenter' ? '방장' : '참여자'})
                    </span>
                    {user.metadata !== 'presenter' && (
                      <>
                        <button
                          onClick={() => {
                            blackboard?.liveControl.toggleMic(
                              user.identity,
                              user.sid
                            )
                            set_userList((prev) => {
                              if (!prev) return null
                              return prev.map((prevUser) => {
                                if (prevUser.identity === user.identity) {
                                  return {
                                    ...prevUser,
                                    access: {
                                      ...prevUser.access,
                                      mic: !prevUser.access.mic,
                                    },
                                  }
                                }
                                return prevUser
                              }) as AccessParticipantType[]
                            })
                          }}
                        >
                          마이크 토글 {user.access.mic ? 'on' : 'off'}
                        </button>
                        <button
                          onClick={() => {
                            blackboard?.liveControl.toggleDrawAble(
                              user.identity,
                              user.sid
                            )
                            set_userList((prev) => {
                              if (!prev) return null
                              return prev.map((prevUser) => {
                                if (prevUser.identity === user.identity) {
                                  return {
                                    ...prevUser,
                                    access: {
                                      ...prevUser.access,
                                      draw: !prevUser.access.draw,
                                    },
                                  }
                                }
                                return prevUser
                              }) as AccessParticipantType[]
                            })
                          }}
                        >
                          그리기 토글 {user.access.draw ? 'on' : 'off'}
                        </button>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
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
            <button
              onClick={() => {
                blackboard?.liveControl.chat('hi' + Date.now())
              }}
            >
              chat test
            </button>
            {access.draw && (
              <>
                <button
                  onClick={async () => {
                    const response = await getUserList(props.roomName)
                    const withAccess: AccessParticipantType[] = response.map(
                      (user) => {
                        const access = blackboard?.getUserInfo(
                          user.identity
                        )?.access
                        return {
                          ...user,
                          access: {
                            mic: access?.mic ?? false,
                            draw: access?.draw ?? false,
                          },
                        } as AccessParticipantType
                      }
                    )
                    set_userList(withAccess)
                  }}
                >
                  <BiUser />
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
                  <BiPaintRoll />
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
                  })}
                  onClick={() => {
                    blackboard?.setMode('delete')
                    set_currentMode('delete')
                  }}
                >
                  <BiSolidEraser />
                </button>
                <button
                  className="btn"
                  onClick={() => {
                    blackboard?.setBackground(
                      `https://newsimg.hankookilbo.com/2019/11/14/201911141677783852_8.jpg`
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
              onClick={async () => {
                blackboard?.liveControl.disconnect()
                props.publisher && (await deleteCurrentRoom())
                props.onClose()
              }}
            >
              <BiXCircle />
            </button>
            <button
              onClick={() => {
                blackboard?.liveControl.cancelRecording()
                set_pending(true)
              }}
            >
              <BiAlarm />
            </button>
          </div>
        </div>
        <audio ref={audioRef} id={'wb-audio'} controls></audio>
        <div ref={containerRef}></div>
      </div>
    </>
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
  const deleteCurrentRoom = useCallback(async (roomName: string) => {
    if (!roomName) return
    const response = await fetch(`https://dev-api.obj.kr/delete/${roomName}`, {
      method: 'DELETE',
    })
    await getRoomList()
    return response
  }, [])

  const createRoom = useCallback(async (roomName: string) => {
    const response = await fetch(`https://dev-api.obj.kr/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        roomName,
      }),
    })
    const room = await response.json()
    return room
  }, [])
  const generateToken = useCallback(
    async (
      roomName: string,
      option: {
        name: string
        identity: string
        isPublisher?: boolean
      }
    ) => {
      const response = await fetch(`https://dev-api.obj.kr/generateToken`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomName,
          option,
          isPublisher: option.isPublisher ? true : false,
        }),
      })
      const data = await response.json()
      return data.token
    },
    []
  )
  const getRoomList = useCallback(async () => {
    const response = await fetch('https://dev-api.obj.kr/room-list', {
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
      <button
        onClick={() => {
          set_joinRoom({
            onClose: () => {
              set_joinRoom(null)
            },
            user: randomUserId,
            roomName: `${randomUserId.id}-room`,
            publisher: true,
            image: `https://cdn.veritas-a.com/news/photo/202211/436835_345350_5147.jpg`,
          })
        }}
      >
        방 개설
      </button>
      <button
        onClick={() => {
          getRoomList()
        }}
      >
        방 확인
      </button>
      <button
        onClick={async () => {
          const token = await generateToken('test', {
            name: 'test',
            identity: 'test',
          })
          console.log('token', token)
        }}
      >
        토큰 테스트
      </button>
      <button
        onClick={async () => {
          const room = await createRoom('test')
          console.log('room', room)
        }}
      >
        방 개설 테스트
      </button>
      <div className="room-list">
        {roomList.map((room, index) => {
          return (
            <div key={index}>
              name: "{room.name}", publisher: {room.numParticipants},
              participant: {room.numParticipants}
              <br />
              <button
                onClick={() => {
                  set_joinRoom({
                    onClose: () => {
                      set_joinRoom(null)
                    },
                    user: randomUserId,
                    roomName: room.name,
                    publisher: false,
                  })
                }}
              >
                입장
              </button>
              <button
                onClick={async () => {
                  await deleteCurrentRoom(room.name)
                  getRoomList()
                }}
              >
                삭제
              </button>
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
