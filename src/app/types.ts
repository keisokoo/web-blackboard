import Konva from "konva"
import { RemoteParticipant, RemoteTrackPublication } from "livekit-client"

export type ClearStackType = {
  id: string,
  action: 'before' | 'after'
  timeline: {
    start: number
  }
  clearIndex: number // undo로 돌아갈 때 몇 번째 스택으로 돌아가야 하는지. 
}

export type PaintStackType = {
  id: string,
  action: 'add' | 'remove'
  timeline: {
    start: number,
    end: number,
    duration: number
  }
  paint: {
    id: string,
    type: PaintType
    lineConfig: Konva.LineConfig | null
    points?: number[]
  }
}
export type PanningStackType = {
  id: string,
  action: 'before' | 'after'
  timeline: {
    start: number,
    end: number,
    duration: number
  }
  panning: {
    before: Konva.Vector2d
    after: Konva.Vector2d
  }
}
export type ImageStackType = {
  id: string,
  action: 'before' | 'after'
  timeline: {
    start: number
  }
  image: {
    before: string
    after: string
  }
}

export type StackType = PaintStackType | PanningStackType | ImageStackType | ClearStackType
export type StackTypeString = 'paint' | 'panning' | 'image'


export type ActionType = 'add' | 'remove' | 'after' | 'before'
const paintTypes = ['pen', 'marker', 'eraser'] as const
export type PaintType = typeof paintTypes[number]
export type ModeType = PaintType | 'panning' | 'image' | 'delete'

export function isPaintType(type: ModeType | string): type is PaintType {
  return paintTypes.includes(type as PaintType)
}


export type RoleType = 'presenter' | 'audience'

export type AccessType = {
  mic: boolean
  draw: boolean
}

export type UserType = {
  userId: string
  role: RoleType
  access: AccessType
}
export type BlackboardUserType = {
  id: string
  nickname: string
  role: RoleType
}
export type LiveControlUserType = {
    access: AccessType
    userType: 'local' | 'remote'
  } & BlackboardUserType