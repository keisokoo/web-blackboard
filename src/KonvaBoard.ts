import Konva from "konva";
import generateHash from "./helper/generateHash";

type ModeType = 'brush' | 'eraser' | 'delete';
class BrushOptions {
  brushSize: number = 5;
  color: string = '#df4b26';
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
type HistoryStack = {
  id: string,
  lines: Konva.Line[],
  mode: ModeType,
  action: 'add' | 'remove'
}
const eraseLineDefault = {
  brushSize: 5,
  color: '#ffffff'
} as const;
type CallbackData = {
  message: string,
  data: {
    mode: ModeType,
    brushSize: number,
    color: string
    undoStack: HistoryStack[],
    redoStack: HistoryStack[]
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
  private undoStack: HistoryStack[] = [];
  private redoStack: HistoryStack[] = [];
  private lastRemovedLines: Set<Konva.Line> = new Set();
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
  lines: Konva.Line[] = [];

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
        redoStack: this.redoStack
      }
    }
  }
  updated(message?: string) {
    this.cb(this.getCurrentData(message));
  }
  appendStack(lines: Konva.Line[]) {
    if (!lines || lines.length < 0) return;
    const stack: HistoryStack = { id: `stack-${generateHash()}`, lines, mode: this.mode, action: this.mode === 'delete' ? 'remove' : 'add' }

    this.undoStack.push(stack);
    this.updated('appendStack');
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

  init() {
    this.cursorStyle();
    this.stage.on('pointerdown', (e) => {
      this.lastRemovedLines.clear();
      this.isPaint = true;
      if (this.mode === 'delete') {
        this.isEraseLine = true;
        return
      }
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

      this.lastLine.on('pointerover', (e) => {
        const id = e.target.id();
        const line = this.lines.find(line => line.id() === id);
        if (this.mode === 'delete' && id.startsWith('brush-') && this.isEraseLine && line) {
          this.lastRemovedLines.add(line);
          e.target.remove()
        } else {
          this.updated('pointerover');  // debug
        }
      });
      this.lastLine.on('pointerout', () => {
        this.updated('pointerout');  // debug
      });
      this.lines.push(this.lastLine);
      this.updated('pointerdown');
    });
    this.stage.on('pointerup', () => {
      this.isPaint = false;
      this.isEraseLine = false;
      this.updated('pointerup');
      this.appendStack(this.mode === 'delete' ? Array.from(this.lastRemovedLines) : [this.lastLine]);
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