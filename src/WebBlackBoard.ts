import Konva from "konva";
import generateHash from "./helper/generateHash";
import { LineConfig } from "konva/lib/shapes/Line";
import { ActionType, CallbackData, ControlStack, HistoryStack, ModeType, StackType, TimelineType } from "./types";
import { Vector2d } from "konva/lib/types";
import CanvasEventHandlers from "./handlers/CanvasEventHandlers";
import BrushCursor from "./ui/BrushCursor";
import { DataPacket_Kind, Room } from "livekit-client";

const encoder = new TextEncoder();

class BrushOptions {
  brushSize: number = 2;
  color: string = '#000000';
  constructor(options?: Partial<BrushOptions>) {
    if (options) {
      this.brushSize = options.brushSize || this.brushSize;
      this.color = options.color || this.color;
    }
  }
  setBrushSize(brushSize: number) {
    this.brushSize = brushSize;
  }
  setColor(color: string) {
    this.color = color;
  }
  getBrushOptions() {
    return {
      brushSize: this.brushSize,
      color: this.color
    }
  }
}
const eraseLineDefault = {
  brushSize: 5,
  color: '#ffffff'
} as const;
class WebBlackBoard {
  el: HTMLDivElement;
  stage: Konva.Stage;
  layer: Konva.Layer;
  historyStack: HistoryStack[] = [];
  isPlaying: boolean = false;
  width: number;
  height: number;
  isPaint: boolean = false;
  mode: ModeType = 'brush';
  undoStack: ControlStack[] = [];
  redoStack: ControlStack[] = [];
  beforePosition: Vector2d = {
    x: 0,
    y: 0
  }
  afterPosition: Vector2d = {
    x: 0,
    y: 0
  }
  isDragging: boolean = false;
  timeline: TimelineType = {
    start: 0,
    end: 0
  };
  brushes: {
    brush: BrushOptions,
    eraser: BrushOptions,
    delete: BrushOptions
  } = {
      brush: new BrushOptions(),
      eraser: new BrushOptions({
        brushSize: 10,
        color: '#ffffff'
      }),
      delete: new BrushOptions(eraseLineDefault)
    }
  currentBrush: BrushOptions = this.mode !== 'dragging' ? this.brushes[this.mode] : this.brushes['brush'];
  lastLine: Konva.Line = new Konva.Line();
  cb: (data: CallbackData) => void;
  eventHandlers: CanvasEventHandlers
  brushCursor: BrushCursor;
  brushEventCallback: (data: string) => void = () => { };

  constructor(el: HTMLDivElement, cb: (data: CallbackData) => void) {
    this.cb = cb;
    this.el = el;
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.stage = new Konva.Stage({
      container: el,
      width: this.width,
      height: this.height,
      draggable: false,
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1
    });
    this.layer = new Konva.Layer();
    this.stage.add(this.layer);
    this.brushCursor = new BrushCursor(this);
    this.setMode(this.mode);
    this.eventHandlers = new CanvasEventHandlers(this);
    this.init(this.eventHandlers)
  }
  init(handlers: CanvasEventHandlers) {
    this.stage.on('pointerdown', handlers.stageDown);
    this.stage.on('pointerup', handlers.stageUp);
    this.stage.on('pointermove', handlers.stageMove);
    this.el.addEventListener('pointerleave', handlers.containerLeave)
  }
  setBrushEventCallback(room: Room) {
    this.brushEventCallback = (data: string) => {
      const strData = encoder.encode(data);
      room.localParticipant?.publishData(strData, DataPacket_Kind.LOSSY);
    }
  }
  getCurrentData(message?: string): CallbackData {
    return {
      message: message ? message : 'done',
      data: {
        mode: this.mode,
        brushSize: this.currentBrush.brushSize,
        color: this.currentBrush.color,
        undoStack: this.undoStack,
        redoStack: this.redoStack,
        historyStack: this.historyStack,
        isPlaying: this.isPlaying
      }
    }
  }
  updated(message?: string, removeRedoStack: boolean = false) {
    if (removeRedoStack) {
      this.redoStack = [];
    }
    this.cb(this.getCurrentData(message));
  }
  appendStack(lines: Konva.Line[], manuallyControl?: {
    actionType?: ActionType,
    withoutHistory?: boolean
  }) { // TODO: 인자로 timeline, mode, actionType, beforePosition, afterPosition, lines 받아서 처리하기. (StackType을 미리 받아서 처리)
    if (!lines) return;
    const endNow = Date.now();
    if (!this.timeline.start) this.timeline.start = endNow;
    this.timeline.end = endNow;
    const startAt = this.timeline.start;
    const duration = this.timeline.end - this.timeline.start;
    const currentAction = manuallyControl?.actionType ? manuallyControl?.actionType : this.mode === 'delete' ? 'remove' : 'add';
    const stack: StackType = { id: `stack-${generateHash()}`, mode: this.mode, action: currentAction, startAt, duration, beforePosition: { ...this.beforePosition }, afterPosition: { ...this.afterPosition } };
    console.log('appended afterPosition', stack.afterPosition)
    this.undoStack.push({ ...stack, lines });
    if (!manuallyControl?.withoutHistory) this.historyStack.push({ ...stack, options: this.copyLineOptions(lines) });
    console.log('this.historyStack first afterPosition', this.historyStack[0].afterPosition)
    this.updated('appendStack');
    this.timeline = {
      start: 0,
      end: 0
    };
  }
  undo() {
    if (this.undoStack.length === 0) return;
    let last = this.undoStack.pop();
    if (!last) return;
    if (last.lines.length) {
      if (last.action === 'remove') {
        last.lines.forEach(line => {
          this.layer.add(line);
        })
        last.action = 'add';
        this.redoStack.push(last);
      } else {
        last.lines.forEach(line => {
          line.remove();
        })
        last.action = 'remove';
        this.redoStack.push(last);
      }
    } else {
      last.action = 'panning-before';
      const lastBeforePosition = last.beforePosition;
      this.stage.position({ x: lastBeforePosition.x, y: lastBeforePosition.y });
      this.redoStack.push(last);
    }
    const { lines, ...rest } = { ...last }
    const forStackType = { ...rest }
    forStackType.startAt = Date.now();
    forStackType.duration = 0;
    this.historyStack.push({ ...forStackType, options: this.copyLineOptions(lines) });
    this.updated('undo');
  }
  redo() {
    if (this.redoStack.length === 0) return;
    let last = this.redoStack.pop();
    if (!last) return;
    if (last.lines.length) {
      if (last.action === 'remove') {
        last.lines.forEach(line => {
          this.layer.add(line);
        })
        last.action = 'add';
        this.undoStack.push(last);
      } else {
        last.lines.forEach(line => {
          line.remove();
        })
        last.action = 'remove';
        this.undoStack.push(last);
      }
    } else {
      last.action = 'panning-after';
      const lastAfterPosition = last.afterPosition;
      this.stage.position({ x: lastAfterPosition.x, y: lastAfterPosition.y });
      this.undoStack.push(last);
    }
    const { lines, ...rest } = { ...last }
    const forStackType = { ...rest }
    forStackType.startAt = Date.now();
    forStackType.duration = 0;
    this.historyStack.push({ ...forStackType, options: this.copyLineOptions(lines) });
    this.updated('redo');
  }
  getHistoryStack() {
    return this.historyStack;
  }
  copyLineOptions(lines: Konva.Line[]): LineConfig[] {
    const lineOptions = lines.map(line => {
      return line.getAttrs() as LineConfig;
    })
    return lineOptions
  }
  restoreControlStack() {
    this.undoStack = [];
    this.redoStack = [];
  }
  getCurrentPosition(): { x: number, y: number } {
    const position = JSON.parse(JSON.stringify(this.stage.getPosition()));
    return { x: position.x, y: position.y }
  }
  setMode(newMode: ModeType) {
    this.mode = newMode;
    if (this.mode === 'dragging') {
      this.stage.draggable(true);
      this.el.style.cursor = 'grab';
    } else {
      this.currentBrush = this.brushes[this.mode];
      this.stage.draggable(false);
      this.el.style.cursor = 'none';
    }
    this.updated('setMode');
    return this.currentBrush.getBrushOptions();
  }
  setBrushSize(brushSize: number) {
    if (this.mode === 'delete') return eraseLineDefault;
    this.currentBrush.setBrushSize(brushSize);
    this.updated('setBrushSize');
    return this.currentBrush.getBrushOptions();
  }
  setColor(color: string) {
    if (this.mode === 'delete') return eraseLineDefault;
    this.currentBrush.setColor(color);
    this.updated('setColor');
    return this.currentBrush.getBrushOptions();
  }
}
export default WebBlackBoard; 