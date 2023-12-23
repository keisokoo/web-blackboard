import Konva from "konva";
import { ActionType, PaintType } from "./types";

type PaintStackType = {
  id: string,
  action: ActionType
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
type PanningStackType = {
  id: string,
  action: ActionType
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
type ImageStackType = {
  id: string,
  action: ActionType
  image: {
    x: number
    y: number
    image: string // base64 encoded image data or URL
    width: number
    height: number
  }
}

type StackType = PaintStackType | PanningStackType | ImageStackType
type StackTypeString = 'paint' | 'panning' | 'image'

class StackManager {
  stacks: Map<string, StackType> = new Map();
  undoStack: StackType[] = [];
  redoStack: StackType[] = [];
  constructor(stacks: StackType[] = []) {
    stacks.forEach((s) => {
      this.stacks.set(s.id, s);
    });
  }
  addStack(stack: StackType) {
    this.stacks.set(stack.id, stack);
  }
  removeStack(id: string) {
    this.stacks.delete(id);
  }
  removeStacksAfter(id: string) {
    const keys = Array.from(this.stacks.keys());
    const index = keys.findIndex((key) => key === id);
    if (index === -1) return;
    const removedKeys = keys.splice(index + 1);
    removedKeys.forEach((key) => {
      this.stacks.delete(key);
    });
  }
  getStack(id: string): StackType | undefined {
    return this.stacks.get(id);
  }
  getStacks(): StackType[] {
    return Array.from(this.stacks.values());
  }
  getUndoStack(): StackType[] {
    return this.undoStack;
  }
  getRedoStack(): StackType[] {
    return this.redoStack;
  }
  clearControlStacks() {
    this.undoStack = [];
    this.redoStack = [];
  }
  clearAllStacks() {
    this.stacks.clear();
    this.clearControlStacks();
  }
  isPaintStackType(stack: StackType): stack is PaintStackType {
    return (stack as PaintStackType).paint !== undefined;
  }
  isPanningStackType(stack: StackType): stack is PanningStackType {
    return (stack as PanningStackType).panning !== undefined;
  }
  isImageStackType(stack: StackType): stack is ImageStackType {
    return (stack as ImageStackType).image !== undefined;
  }
  getStackType(stack: StackType): { type: StackTypeString, stack: StackType } {
    if (this.isPaintStackType(stack)) {
      return { type: 'paint', stack };
    } else if (this.isPanningStackType(stack)) {
      return { type: 'panning', stack };
    } else if (this.isImageStackType(stack)) {
      return { type: 'image', stack };
    }
    throw new Error('Invalid StackType');
  }
}
export default StackManager;