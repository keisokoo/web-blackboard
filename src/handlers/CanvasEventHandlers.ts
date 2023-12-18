import Konva from "konva";
import WebBlackBoard from "../WebBlackBoard";
import { ActionType, FilteredType, ModeType } from "../types";
import generateHash from "../helper/generateHash";
import { Vector2d } from "konva/lib/types";

class CanvasEventHandlers {
  webBlackBoard: WebBlackBoard;
  private isEraseLine: boolean = false;
  constructor(webBlackBoard: WebBlackBoard) {
    this.webBlackBoard = webBlackBoard;
  }
  bindHitLineEvent(line: Konva.Line) {
    line.on('pointerdown', (e) => {
      const id = e.target.id();
      const line = e.target as Konva.Line;
      if (this.webBlackBoard.mode === 'delete' && id.startsWith('brush-') && line) {
        line.remove()
        this.updated('remove');
        this.appendStack([line]);
      }
    });
    line.on('pointerover', (e) => {
      const id = e.target.id();
      const line = e.target as Konva.Line;
      if (this.webBlackBoard.mode === 'delete' && id.startsWith('brush-') && this.isEraseLine && line) {
        line.remove()
        this.updated('remove');
        this.appendStack([line]);
      }
    });
  }
  private updated(message?: string, removeRedoStack: boolean = false) {
    this.webBlackBoard.updated(message, removeRedoStack);
  }
  private getCurrentPosition(): Vector2d {
    return this.webBlackBoard.getCurrentPosition();
  }
  private appendStack(lines: Konva.Line[], manuallyControl?: {
    actionType?: ActionType,
    withoutHistory?: boolean
  }) {
    this.webBlackBoard.appendStack(lines, manuallyControl);
  }
  private drawCursor(x: number, y: number) {
    this.webBlackBoard.brushCursor.drawCursor(x, y);
  }

  downEventByMode(mode: ModeType) {
    switch (mode) {
      case 'dragging':
        this.draggingDown(mode);
        break;
      case 'delete':
        this.deleteModeDown(mode);
        break;
      default:
        this.addDown(mode);
        break;
    }
  }
  deleteModeDown(mode: FilteredType<ModeType, 'delete'>) {
    if (mode !== 'delete') return
    this.isEraseLine = true;
  }
  draggingDown(mode: FilteredType<ModeType, 'dragging'>) {
    if (mode !== 'dragging') return
    this.webBlackBoard.isDragging = true;
    this.webBlackBoard.beforePosition = this.getCurrentPosition();
    this.webBlackBoard.timeline.start = Date.now();
    this.webBlackBoard.el.style.cursor = 'grabbing';
    this.updated('dragstart');
  }
  addDown(mode: FilteredType<ModeType, 'brush' | 'eraser'>) {
    this.webBlackBoard.isPaint = true;
    this.webBlackBoard.beforePosition = this.getCurrentPosition();
    this.webBlackBoard.afterPosition = this.getCurrentPosition();
    this.webBlackBoard.timeline.start = Date.now();
    const pos = this.webBlackBoard.stage.getPointerPosition();
    const stagePos = this.getCurrentPosition();
    if (!pos) return;
    this.webBlackBoard.lastLine = new Konva.Line({
      id: `${mode}-${generateHash()}`,
      stroke: this.webBlackBoard.brushes[mode].color,
      strokeWidth: this.webBlackBoard.brushes[mode].brushSize,
      globalCompositeOperation:
        mode === 'brush' ? 'source-over' : 'destination-out',
      lineCap: mode === 'eraser' ? 'square' : 'round',
      lineJoin: mode === 'eraser' ? 'miter' : 'round',
      hitStrokeWidth: this.webBlackBoard.brushes[mode].brushSize,
      points: [pos.x - stagePos.x, pos.y - stagePos.y]
    });
    this.webBlackBoard.layer.add(this.webBlackBoard.lastLine);

    this.bindHitLineEvent(this.webBlackBoard.lastLine);
    this.updated('pointerdown', true);
  }
  stageDown = (e: Konva.KonvaEventObject<PointerEvent>) => {
    if (!this.webBlackBoard) return
    this.downEventByMode(this.webBlackBoard.mode);
  }
  moveEventByMode(mode: ModeType, e: Konva.KonvaEventObject<PointerEvent>) {
    switch (mode) {
      case 'dragging':
        this.draggingMove(mode);
        break;
      case 'delete':
        this.deleteModeDown(mode);
        break;
      default:
        this.addMove(mode, e);
        break;
    }
  }
  draggingMove(mode: FilteredType<ModeType, 'dragging'>) {
    if (mode !== 'dragging') return;
    if (!this.webBlackBoard.isDragging) return;
    this.updated('dragging');
  }
  deleteMove(mode: FilteredType<ModeType, 'delete'>) {
    return
  }
  addMove(mode: FilteredType<ModeType, 'brush' | 'eraser'>, e: Konva.KonvaEventObject<PointerEvent>) {
    if (!this.webBlackBoard.isPaint) return;
    if (this.isEraseLine) return;
    e.evt.preventDefault();
    const pos = this.webBlackBoard.stage.getPointerPosition();
    const stagePos = this.getCurrentPosition();
    if (!pos) return;
    console.log('pos.x - stagePos.x, pos.y - stagePos.y', pos.x - stagePos.x, pos.y - stagePos.y)
    let newPoints = this.webBlackBoard.lastLine.points().concat([pos.x - stagePos.x, pos.y - stagePos.y]);
    this.webBlackBoard.lastLine.points(newPoints);
    this.webBlackBoard.layer.batchDraw();
  }
  stageMove = (e: Konva.KonvaEventObject<PointerEvent>) => {
    if (!this.webBlackBoard) return
    const isDragging = this.webBlackBoard.mode === 'dragging'
    if (!isDragging) this.drawCursor(e.evt.offsetX, e.evt.offsetY);
    this.moveEventByMode(this.webBlackBoard.mode, e);
  }
  upEventByMode(mode: ModeType) {
    switch (mode) {
      case 'dragging':
        this.draggingUp(mode);
        break;
      case 'delete':
        this.deleteModeUp(mode);
        break;
      default:
        this.addUp(mode);
        break;
    }
  }
  deleteModeUp(mode: FilteredType<ModeType, 'delete'>) {
    if (mode !== 'delete') return
  }
  draggingUp(mode: FilteredType<ModeType, 'dragging'>) {
    if (mode !== 'dragging') return
    this.webBlackBoard.isDragging = false;
    this.webBlackBoard.el.style.cursor = 'grab';
    this.webBlackBoard.afterPosition = this.getCurrentPosition();
    this.appendStack([], { actionType: 'panning-after' });
    this.webBlackBoard.isDragging = false;
    this.webBlackBoard.beforePosition = {
      x: 0,
      y: 0
    }
    this.webBlackBoard.afterPosition = {
      x: 0,
      y: 0
    }
    this.updated('dragend');
  }
  addUp(mode: FilteredType<ModeType, 'brush' | 'eraser'>) {
    this.updated('pointerup');
    this.webBlackBoard.appendStack([this.webBlackBoard.lastLine]);
  }
  stageUp = (e: Konva.KonvaEventObject<PointerEvent>) => {
    if (!this.webBlackBoard) return
    this.webBlackBoard.isPaint = false;
    this.isEraseLine = false;
    this.upEventByMode(this.webBlackBoard.mode);
  }
  containerLeave = () => {
    this.webBlackBoard.isPaint = false;
    this.isEraseLine = false;
    this.webBlackBoard.brushCursor.hideCursor()
  }
}
export default CanvasEventHandlers;