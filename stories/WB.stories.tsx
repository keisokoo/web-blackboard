import React, { useEffect } from 'react'
import Blackboard from '../src/app/Blackboard'
import { Meta } from '@storybook/react'
import clsx from 'clsx'
import {
  BiBrush,
  BiEraser,
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

const randomUserId = 'local-' + generateHash()
export const Demo = () => {
  const containerRef = React.useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!containerRef.current) return
    const webBoard = new Blackboard(randomUserId, containerRef.current, {
      callback: (data) => {
        console.log('callback', data)
      },
    })
    console.log('webBoard', webBoard)
  }, [])
  return (
    <div className="canvas-wrap">
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
