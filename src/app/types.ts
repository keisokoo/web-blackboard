
export type ActionType = 'add' | 'remove' | 'panning-after' | 'panning-before'
const paintTypes = ['pen', 'marker', 'eraser'] as const
export type PaintType = typeof paintTypes[number]
export type ModeType = PaintType | 'panning' | 'image' | 'delete'

export function isPaintType(type: string): type is PaintType {
  return paintTypes.includes(type as PaintType)
}