import Konva from "konva";
import generateHash from "./helper/generateHash";
import { LineConfig } from "konva/lib/shapes/Line";
import { ActionType, CallbackData, ControlStack, HistoryStack, ModeType, StackType, TimelineType } from "./types";
import { Vector2d } from "konva/lib/types";

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
  private cursor: HTMLDivElement | null = null;
  private width: number;
  private height: number;
  private isPaint: boolean = false;
  private mode: ModeType = 'brush';
  private isEraseLine: boolean = false;
  private undoStack: ControlStack[] = [];
  private redoStack: ControlStack[] = [];
  private beforePosition: Vector2d = {
    x: 0,
    y: 0
  }
  private afterPosition: Vector2d = {
    x: 0,
    y: 0
  }
  private isDragging: boolean = false;
  private lastRemovedLines: Set<Konva.Line> = new Set();
  private timeline: TimelineType = {
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
  private lastLine: Konva.Line = new Konva.Line();
  cb: (data: CallbackData) => void;

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

    this.initializeCursor();
    this.init()
    this.setMode(this.mode);
    this.addDraggingEvent();
  }
  addDraggingEvent() {
    this.stage.on('pointerdown', (e) => {
      if (this.mode !== 'dragging') return;
      console.log('pointerdown on yes dragging@')
      this.isDragging = true;
      this.beforePosition = this.getCurrentPosition();
      this.timeline.start = Date.now();
      this.el.style.cursor = 'grabbing';
      this.updated('dragstart');
    })
    this.stage.on('pointermove', (e) => {
      if (this.mode !== 'dragging') return;
      if (!this.isDragging) return;
      console.log('pointermove on yes dragging@')
      this.updated('dragging');
    })
    this.stage.on('pointerup', (e) => {
      if (this.mode !== 'dragging') return;
      console.log('pointerup on yes dragging@')
      if (!this.isDragging) return;
      this.el.style.cursor = 'grab';
      this.afterPosition = this.getCurrentPosition();
      this.appendStack([], { actionType: 'panning-after' });
      this.isDragging = false;
      this.beforePosition = {
        x: 0,
        y: 0
      }
      this.afterPosition = {
        x: 0,
        y: 0
      }
      this.updated('dragend');
    })
  }
  initializeCursor() {
    if (document.querySelector('#cursor')) {
      this.cursor = document.querySelector('#cursor')!;
    } else {
      this.cursor = document.createElement('div');
      this.el.appendChild(this.cursor);
    }
    this.cursor.id = 'cursor';
    this.cursor.style.display = 'none';
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
  }) {
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
  private cursorStyle() {
    if (!this.cursor) return;
    this.cursor.style.position = 'fixed';
    this.cursor.style.zIndex = '99999';
    this.cursor.style.pointerEvents = 'none';
    this.cursor.style.transform = 'translate(-50%, -50%)';
    this.cursor.style.border = '1px solid #000000';
  }
  hideCursor() {
    if (!this.cursor) return;
    this.cursor.style.display = 'none';
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
  drawCursor(x: number, y: number) {
    if (!this.cursor) return;
    if (!this.el) return;
    if (!this.currentBrush) return;
    if (x < 0 || x > this.width || y < 0 || y > this.height) {
      this.hideCursor();
      return;
    }
    const brushSize = this.currentBrush.brushSize;
    this.cursor.style.width = brushSize + 'px';
    this.cursor.style.height = brushSize + 'px';
    this.cursor.style.display = 'block';
    this.cursor.style.top = `${y + this.el.offsetTop}px`;
    this.cursor.style.left = `${x - this.el.offsetLeft}px`;
    if (this.mode === 'eraser' || this.mode === 'delete') {
      this.cursor.style.borderRadius = '0px';
    } else {
      this.cursor.style.borderRadius = '50%';
    }
  }
  bindHitLineEvent(line: Konva.Line) {
    line.on('pointerdown', (e) => {
      const id = e.target.id();
      const line = e.target as Konva.Line;
      if (this.mode === 'delete' && id.startsWith('brush-') && line) {
        line.remove()
        this.updated('remove');
        this.appendStack([line]);
      }
    });
    line.on('pointerover', (e) => {
      const id = e.target.id();
      const line = e.target as Konva.Line;
      if (this.mode === 'delete' && id.startsWith('brush-') && this.isEraseLine && line) {
        line.remove()
        this.updated('remove');
        this.appendStack([line]);
      }
    });
  }
  getCurrentPosition(): { x: number, y: number } {
    const position = JSON.parse(JSON.stringify(this.stage.getPosition()));
    return { x: position.x, y: position.y }
  }
  init() {
    this.cursorStyle();
    this.stage.on('pointerdown', () => {
      this.lastRemovedLines.clear();
      this.isPaint = true;
      this.beforePosition = this.getCurrentPosition();
      this.afterPosition = this.getCurrentPosition();
      if (this.mode === 'dragging') return
      console.log('pointerdown on not dragging')
      if (this.mode === 'delete') {
        this.isEraseLine = true;
        return
      }
      this.timeline.start = Date.now();
      const pos = this.stage.getPointerPosition();
      const stagePos = this.getCurrentPosition();
      if (!pos) return;
      this.lastLine = new Konva.Line({
        id: `${this.mode}-${generateHash()}`,
        stroke: this.brushes[this.mode].color,
        strokeWidth: this.brushes[this.mode].brushSize,
        globalCompositeOperation:
          this.mode === 'brush' ? 'source-over' : 'destination-out',
        lineCap: this.mode === 'eraser' ? 'square' : 'round',
        lineJoin: this.mode === 'eraser' ? 'miter' : 'round',
        hitStrokeWidth: this.brushes[this.mode].brushSize,
        points: [pos.x - stagePos.x, pos.y - stagePos.y]
      });
      this.layer.add(this.lastLine);

      this.bindHitLineEvent(this.lastLine);
      this.updated('pointerdown', true);
    });
    this.stage.on('pointerup', () => {
      if (this.mode === 'dragging') return
      console.log('pointerup on not dragging')
      this.isPaint = false;
      this.isEraseLine = false;
      this.updated('pointerup');
      if (this.mode !== 'delete') {
        this.appendStack([this.lastLine]);
      }
    });
    this.el.addEventListener('pointerleave', () => {
      this.isPaint = false;
      this.isEraseLine = false;
      this.hideCursor()
    })
    this.stage.on('pointermove', (e) => {
      if (this.mode === 'dragging') return
      this.drawCursor(e.evt.offsetX, e.evt.offsetY);
      if (!this.isPaint) {
        return;
      }
      if (this.isEraseLine) {
        return;
      }
      e.evt.preventDefault();
      console.log('pointermove on not dragging')

      const pos = this.stage.getPointerPosition();
      const stagePos = this.getCurrentPosition();
      if (!pos) return;
      let newPoints = this.lastLine.points().concat([pos.x - stagePos.x, pos.y - stagePos.y]);
      this.lastLine.points(newPoints);
      this.layer.batchDraw();
    });
  }
  setMode(newMode: ModeType) {
    this.mode = newMode;
    if (this.mode !== 'dragging') this.currentBrush = this.brushes[this.mode];
    if (this.mode === 'dragging') {
      this.stage.draggable(true);
      this.el.style.cursor = 'grab';
    } else {
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

  // playHistoryStack(historyStack: HistoryStack[]) {
  //   const playStack = historyStack ?? [];
  //   if (playStack.length === 0) return;
  //   this.isPlaying = true;
  //   this.undoStack = [];
  //   this.redoStack = [];
  //   this.updated('replay history Stack', true);
  //   this.layer.destroyChildren();
  //   let initialTime = playStack[0].startAt;
  //   playStack.forEach((stack, index) => {
  //     let timeOffset = stack.startAt - initialTime;
  //     const playTimeout = setTimeout(() => {
  //       if (stack.action === 'remove') {
  //         stack.options.forEach(option => {
  //           const newLine = this.layer.findOne(`#${option.id}`)
  //           if (!newLine) return;
  //           newLine.remove();
  //         })
  //       } else {
  //         stack.options.forEach(option => {
  //           if (stack.duration === 0) {
  //             const newLine = new Konva.Line(option)
  //             this.layer.add(newLine);
  //             return;
  //           }
  //           this.animateLineWithDuration(stack.duration, this.layer, option);
  //         })
  //       }
  //       if (index === playStack.length - 1) {
  //         setTimeout(() => {
  //           this.isPlaying = false;
  //           this.updated('replayed history Stack')
  //         }, stack.duration)
  //       }
  //     }, timeOffset)
  //     this.playingTimeouts.add(playTimeout);
  //   })
  // }
}
export default WebBlackBoard; 