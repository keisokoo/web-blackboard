import { Meta } from '@storybook/react'
import React, { useEffect } from 'react'
import { createBlackboard } from '../src'

export const Demo = () => {
  useEffect(() => {
    console.log('createBlackboard1', createBlackboard)
  }, [])
  return (
    <div>
      <h1>Canvas</h1>
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
