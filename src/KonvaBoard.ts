import Konva from "konva";
import generateHash from "./helper/generateHash";

type ModeType = 'brush' | 'eraser' | 'erase-line';
class BrushOptions {
  brushSize: number = 55;
  color: string = '#ffffff';
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
class KonvaBoard {
  el: HTMLDivElement;
  cursorCanvas: HTMLCanvasElement;
  private width: number;
  private height: number;
  private stage: Konva.Stage;
  private layer: Konva.Layer;
  private isPaint: boolean;
  private mode: ModeType = 'brush';
  private isEraseLine: boolean = false;
  brushes: {
    brush: BrushOptions,
    eraser: BrushOptions,
    'erase-line': BrushOptions
  } = {
      brush: new BrushOptions(),
      eraser: new BrushOptions({
        brushSize: 10,
        color: '#ffffff'
      }),
      'erase-line': new BrushOptions({
        brushSize: 5,
        color: '#ffffff'
      })
    }
  currentBrush: BrushOptions = this.brushes[this.mode];

  private lastLine: Konva.Line = new Konva.Line();
  lines: Konva.Line[] = [];

  cb: (data: string) => void;

  constructor(el: HTMLDivElement, cb: (data: string) => void) {
    this.cursorCanvas = document.querySelector('#cursor') ? document.querySelector('#cursor')! : document.createElement('canvas');
    this.cursorCanvas.id = 'cursor';
    this.cursorCanvas.style.display = 'none';
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

    this.init()
    this.modeChange(this.mode)
  }

  drawCursor(x: number, y: number) {
    if (!this.el) return;
    if (!this.currentBrush) return;
    const brushSize = this.currentBrush.brushSize;
    const canvas = this.cursorCanvas;
    canvas.width = brushSize;
    canvas.height = brushSize;
    this.cursorCanvas.style.display = 'block';
    canvas.style.position = 'fixed';
    canvas.style.zIndex = '99999';
    canvas.style.pointerEvents = 'none';
    canvas.style.top = `${y + this.el.offsetTop}px`;
    canvas.style.left = `${x - this.el.offsetLeft}px`;
    canvas.style.transform = 'translate(-50%, -50%)';
    if (!canvas) return;
    canvas.style.border = '1px solid #000000';
    if (this.mode === 'eraser' || this.mode === 'erase-line') {
      canvas.style.borderRadius = '0px';
    } else {
      canvas.style.borderRadius = '50%';
    }
  }

  init() {
    this.stage.on('pointerdown', (e) => {
      this.isPaint = true;
      if (this.mode === 'erase-line') this.isEraseLine = true;
      const pos = this.stage.getPointerPosition();
      if (!pos) return;
      this.lastLine = new Konva.Line({
        id: `${this.mode}-${generateHash()}`,
        stroke: '#df4b26',
        strokeWidth: this.brushes[this.mode].brushSize,
        globalCompositeOperation:
          this.mode === 'brush' ? 'source-over' : 'destination-out',
        // round cap for smoother lines
        lineCap: 'round',
        lineJoin: 'round',
        hitStrokeWidth: this.brushes[this.mode].brushSize,
        // add point twice, so we have some drawings even on a simple click
        points: [pos.x, pos.y, pos.x, pos.y],
      });
      this.layer.add(this.lastLine);

      this.lastLine.on('mouseover', (e) => { // debug
        const id = e.target.id();
        console.log('Lines', id, id.startsWith('brush-'), this.isEraseLine, this.isPaint)
        if (this.mode === 'erase-line' && id.startsWith('brush-')) {
          e.target.remove()
        } else {
          this.cb('Mouseover line, ' + id);
        }
      });
      this.lastLine.on('mouseout', () => { // debug
        console.log('Lines', this.lines)
        this.cb('Mouseout line');
      });
      this.lines.push(this.lastLine);
    });
    this.stage.on('pointerup', (e) => {
      this.isPaint = false;
      this.isEraseLine = false;
    });

    // and core function - drawing
    this.stage.on('pointermove', (e) => {
      this.drawCursor(e.evt.offsetX, e.evt.offsetY);
      if (!this.isPaint) {
        return;
      }
      if (this.isEraseLine) {
        return;
      }
      // prevent scrolling on touch devices
      e.evt.preventDefault();

      const pos = this.stage.getPointerPosition();
      if (!pos) return;
      let newPoints = this.lastLine.points().concat([pos.x, pos.y]);
      this.lastLine.points(newPoints);
    });
  }
  modeChange(newMode: ModeType) {
    this.mode = newMode;
    this.currentBrush = this.brushes[this.mode];
    // this.createBrushCursor(this.currentBrush.brushSize);
    return this.currentBrush.getBrushOptions();
  }
}
export default KonvaBoard;