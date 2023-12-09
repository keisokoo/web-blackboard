import Konva from "konva";
import generateHash from "./helper/generateHash";
import { LineConfig } from "konva/lib/shapes/Line";

type ModeType = 'brush' | 'eraser' | 'delete';
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
type TimelineType = {
  start: number,
  end: number
}
type StackType = {
  id: string,
  mode: ModeType,
  action: 'add' | 'remove',
  startAt: number,
  duration: number
}
type ControlStack = StackType & {
  lines: Konva.Line[]
}
export type HistoryStack = StackType & {
  options: LineConfig[]
}
const eraseLineDefault = {
  brushSize: 5,
  color: '#ffffff'
} as const;
type CallbackData = {
  message: string,
  data: {
    mode: ModeType
    brushSize: number
    color: string
    undoStack: ControlStack[]
    redoStack: ControlStack[]
    historyStack: HistoryStack[]
    isPlaying: boolean
  }
}
class KonvaBoard {
  el: HTMLDivElement;
  cursor: HTMLDivElement;
  private width: number;
  private height: number;
  private stage: Konva.Stage;
  private layer: Konva.Layer;
  private isPaint: boolean;
  private mode: ModeType = 'brush';
  private isEraseLine: boolean = false;
  private undoStack: ControlStack[] = [];
  private redoStack: ControlStack[] = [];
  private historyStack: HistoryStack[] = [];
  private lastRemovedLines: Set<Konva.Line> = new Set();
  private isPlaying: boolean = false;
  private timeline: TimelineType = {
    start: 0,
    end: 0
  };
  private playTimeout: NodeJS.Timeout = setTimeout(() => { }, 0)
  brushes: {
    brush: BrushOptions,
    eraser: BrushOptions,
    'delete': BrushOptions
  } = {
      brush: new BrushOptions(),
      eraser: new BrushOptions({
        brushSize: 10,
        color: '#ffffff'
      }),
      'delete': new BrushOptions(eraseLineDefault)
    }
  currentBrush: BrushOptions = this.brushes[this.mode];
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
    });

    this.layer = new Konva.Layer();
    this.stage.add(this.layer);

    this.isPaint = false;

    if (document.querySelector('#cursor')) {
      this.cursor = document.querySelector('#cursor')!;
    } else {
      this.cursor = document.createElement('div');
      this.el.appendChild(this.cursor);
    }
    this.cursor.id = 'cursor';
    this.cursor.style.display = 'none';
    this.init()
    this.setMode(this.mode)
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
  appendStack(lines: Konva.Line[]) {
    if (!lines || lines.length < 0) return;
    const endNow = Date.now();
    if (!this.timeline.start) this.timeline.start = endNow;
    this.timeline.end = endNow;
    const startAt = this.timeline.start;
    const duration = this.timeline.end - this.timeline.start;
    const stack: StackType = { id: `stack-${generateHash()}`, mode: this.mode, action: this.mode === 'delete' ? 'remove' : 'add', startAt, duration }
    this.undoStack.push({ ...stack, lines });
    this.historyStack.push({ ...stack, options: this.copyLineOptions(lines) });
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
    if (last.lines.length === 0) return;
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
    const forStackType = { ...last }
    forStackType.startAt = Date.now();
    forStackType.duration = 0;
    this.historyStack.push({ ...forStackType, options: this.copyLineOptions(forStackType.lines) });
    this.updated('undo');
  }
  redo() {
    if (this.redoStack.length === 0) return;
    let last = this.redoStack.pop();
    if (!last) return;
    if (last.lines.length === 0) return;
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
    let forStackType = { ...last }
    forStackType.startAt = Date.now();
    forStackType.duration = 0;
    this.historyStack.push({ ...forStackType, options: this.copyLineOptions(forStackType.lines) });
    this.updated('redo');
  }
  private cursorStyle() {
    this.cursor.style.position = 'fixed';
    this.cursor.style.zIndex = '99999';
    this.cursor.style.pointerEvents = 'none';
    this.cursor.style.transform = 'translate(-50%, -50%)';
    this.cursor.style.border = '1px solid #000000';
  }
  hideCursor() {
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
  animateLineWithDuration(duration: number, layer: Konva.Layer, lineOptions: LineConfig) {
    let startTime: number;
    const { points, ...rest } = lineOptions;
    if (!points || points.length < 2) return;
    const newLine = new Konva.Line({ ...rest, points: [] });

    this.bindHitLineEvent(newLine);
    layer.add(newLine);

    const anim = new Konva.Animation((frame) => {
      if (!frame) return;
      if (!startTime) startTime = frame.time;
      const timeElapsed = frame.time - startTime;
      const progress = timeElapsed / duration;

      const currentPointIndex = Math.min(
        Math.floor(progress * points.length / 2) * 2,
        points.length
      );

      newLine.points(points.slice(0, currentPointIndex) as number[]);

      if (timeElapsed >= duration) {
        anim.stop();
      }
    }, layer);

    anim.start();
  }
  stopHistoryReplay() {
    this.isPlaying = false;
    clearTimeout(this.playTimeout);
    this.updated('stop history replay');
  }
  playHistoryStack(historyStack: HistoryStack[]) {
    const playStack = historyStack ?? [];
    if (playStack.length === 0) return;
    this.isPlaying = true;
    this.undoStack = [];
    this.redoStack = [];
    this.updated('replay history Stack', true);
    this.layer.destroyChildren();
    let initialTime = playStack[0].startAt;
    playStack.forEach((stack, index) => {
      let timeOffset = stack.startAt - initialTime;
      this.playTimeout = setTimeout(() => {
        if (stack.action === 'remove') {
          stack.options.forEach(option => {
            this.layer.findOne(`#${option.id}`)?.remove();
          })
        } else {
          stack.options.forEach(option => {
            this.animateLineWithDuration(stack.duration, this.layer, option);
          })
        }
        if (index === playStack.length - 1) {
          setTimeout(() => {
            this.isPlaying = false;
            this.updated('replayed history Stack')
          }, stack.duration)
        }
      }, timeOffset)
    })
  }
  drawCursor(x: number, y: number) {
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
    if (!this.cursor) return;
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
  init() {
    this.cursorStyle();
    this.stage.on('pointerdown', () => {
      this.lastRemovedLines.clear();
      this.isPaint = true;
      if (this.mode === 'delete') {
        this.isEraseLine = true;
        return
      }
      this.timeline.start = Date.now();
      const pos = this.stage.getPointerPosition();
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
        points: [pos.x, pos.y, pos.x, pos.y],
      });
      this.layer.add(this.lastLine);

      this.bindHitLineEvent(this.lastLine);
      this.updated('pointerdown', true);
    });
    this.stage.on('pointerup', () => {
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
    this.el.addEventListener('pointerenter', () => {
    })
    this.stage.on('pointermove', (e) => {
      this.drawCursor(e.evt.offsetX, e.evt.offsetY);
      if (!this.isPaint) {
        return;
      }
      if (this.isEraseLine) {
        return;
      }
      e.evt.preventDefault();

      const pos = this.stage.getPointerPosition();
      if (!pos) return;
      let newPoints = this.lastLine.points().concat([pos.x, pos.y]);
      this.lastLine.points(newPoints);
    });
  }
  setMode(newMode: ModeType) {
    this.mode = newMode;
    this.currentBrush = this.brushes[this.mode];
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
export default KonvaBoard;