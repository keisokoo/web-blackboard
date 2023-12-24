import Konva from "konva";
import { ActionType, ClearStackType, ImageStackType, PaintStackType, PaintType, PanningStackType, StackType, StackTypeString } from "./types";
import Blackboard from "./Blackboard";
import WBLine from "./WBLine";
import generateHash from "../helper/generateHash";

class StackManager {
  stacks: Map<string, StackType> = new Map();
  undoStack: StackType[] = [];
  redoStack: StackType[] = [];
  blackboard: Blackboard;
  constructor(blackboard: Blackboard, stacks: StackType[] = []) {
    this.blackboard = blackboard;
    this.initStacks(stacks)
  }
  initStacks(stacks: StackType[]) {
    stacks.forEach((stack) => {
      this.runStack(stack);
      this.stacks.set(stack.id, stack);
    });
  }
  redrawStacksByClearIndex(index: number) {
    const stacks = this.getStacks();
    const beforeStacks = stacks.slice(0, index);
    beforeStacks.forEach((stack) => {
      this.runStack(stack);
    })
  }
  addStack(stack: StackType) {
    this.stacks.set(stack.id, stack);
    this.undoStack.push(stack);
  }
  reverseStackActionType(stack?: StackType): StackType | undefined {
    if (!stack) return;
    if (stack.action === 'add' || stack.action === 'remove') {
      if (stack.action === 'add') {
        stack.action = 'remove';
      } else if (stack.action === 'remove') {
        stack.action = 'add';
      }
      return stack;
    } else if (stack.action === 'before' || stack.action === 'after') {
      if (stack.action === 'before') {
        stack.action = 'after';
      } else if (stack.action === 'after') {
        stack.action = 'before';
      }
      return stack;
    }
    return;
  }
  runStack(stack: StackType) {
    if (this.isPaintStackType(stack)) {
      if (stack.action === 'add') {
        const wb = new WBLine({
          userType: 'local',
          userId: this.blackboard.userId,
          lineConfig: {
            ...stack.paint.lineConfig,
            id: stack.paint.id,
            points: stack.paint.points,
          },
          deleteAble: !stack.paint.id.includes('eraser')
        })
        this.blackboard.layer.add(wb.line);
        if(wb.line.id().includes('eraser')) {
          wb.line.moveToTop()
        }else{
          wb.line.moveToBottom();
        }
        this.blackboard.handlers.bindHitLineEvent(wb);
      } else if (stack.action === 'remove') {
        const line = this.blackboard.layer.findOne(`#${stack.paint.id}`) as Konva.Line;
        if (line) {
          line.remove();
        }
        this.blackboard.layer.draw()
      }
    } else if (this.isPanningStackType(stack)) {
      if (stack.action === 'before') {
        this.blackboard.stage.position(stack.panning.before);
      } else if (stack.action === 'after') {
        this.blackboard.stage.position(stack.panning.after);
      }
    } else if (this.isImageStackType(stack)) {
      if (stack.action === 'before') {
        this.blackboard.setBackground(stack.image.before, true)
      } else if (stack.action === 'after') {
        this.blackboard.setBackground(stack.image.after, true)
      }
    } else if (this.isClearStackType(stack)) {
      if(stack.action === 'before') {
        this.redrawStacksByClearIndex(stack.clearIndex);
      } else if(stack.action === 'after') {
        this.blackboard.clear()
      }
    }
    this.blackboard.layer.draw();
  }
  undo() {
    if (this.undoStack.length === 0) return;
    let last = this.undoStack.pop();
    last = this.reverseStackActionType(last);
    if (!last) return;
    this.runStack(last);
    this.redoStack.push(last);
    this.blackboard.updated('undo');
  }
  redo() {
    if (this.redoStack.length === 0) return;
    let last = this.redoStack.pop();
    last = this.reverseStackActionType(last);
    if (!last) return;
    this.runStack(last);
    this.undoStack.push(last);
    this.blackboard.updated('redo');
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
  isClearStackType(stack: StackType): stack is ClearStackType {
    return (stack as ClearStackType).clearIndex !== undefined;
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