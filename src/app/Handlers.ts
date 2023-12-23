import Konva from "konva";
import Blackboard from "./Blackboard";
import WBLine from "./WBLine";
import generateHash from "../helper/generateHash";
import { ModeType, PaintType, isPaintType } from "./types";

class Handlers {
  blackboard: Blackboard;
  isPaint: boolean = false;
  beforeStagePosition: Konva.Vector2d = {
    x: 0,
    y: 0
  }
  afterStagePosition: Konva.Vector2d = {
    x: 0,
    y: 0
  }
  private isDeleteMode: boolean = false;
  constructor(blackboard: Blackboard) {
    this.blackboard = blackboard
  }
  private deleteLine(wb: WBLine) {
    const deleteAble = wb.config.deleteAble;
    if(!deleteAble) return;
    wb.line.remove();
    this.blackboard.updated('remove');
    const currentTime = Date.now();
    this.blackboard.stackManager.addStack({
      id: `stack-${generateHash()}`,
      action: 'remove',
      timeline: {
        start: currentTime,
        end: currentTime,
        duration: 0
      },
      paint: {
        id: wb.line.id(),
        type: wb.type,
        lineConfig: wb.config.lineConfig,
        points: wb.line.points()
      }
    })
  }
  private drawCursor(x: number, y: number) {
    this.blackboard.cursor.drawCursor(x, y);
  }
  bindHitLineEvent(wb: WBLine) {
    wb.line.on('pointerdown', (e) => {
      if (this.blackboard.mode === 'delete' && wb.line) {
        this.deleteLine(wb)
      }
    });
    wb.line.on('pointerover', (e) => {
      if (this.blackboard.mode === 'delete' && this.isDeleteMode && wb.line) {
        this.deleteLine(wb)
      }
    });
  }
  addDown(mode: PaintType) {
    this.isPaint = true;
    this.beforeStagePosition = this.blackboard.getStagePosition();
    this.afterStagePosition = this.blackboard.getStagePosition();
    const pos = this.blackboard.stage.getPointerPosition();
    const stagePos = this.blackboard.getStagePosition();
    if (!pos) return;
    const brushConfig = this.blackboard.brush.getBrushConfig();
    const wb = new WBLine({
      userType: 'local',
      userId: this.blackboard.userId,
      lineConfig: {
        id: `${mode}-${generateHash()}`,
        points: [pos.x - stagePos.x, pos.y - stagePos.y],
        ...brushConfig.config
      },
      deleteAble: true
    })
    this.bindHitLineEvent(wb);
    this.blackboard.setNewLine(wb);
  }
  downEventByMode(mode: ModeType) {
    switch (mode) {
      case 'panning':
        // this.draggingDown(mode);
        break;
      case 'delete':
        // this.deleteModeDown(mode);
        break;
      default:
        if(isPaintType(mode)) {
          this.addDown(mode);
        }
        break;
    }
  }
  addMove(mode: PaintType, e: Konva.KonvaEventObject<PointerEvent>) {
    if(!this.isPaint || this.isDeleteMode) return;
    e.evt.preventDefault();
    const pos = this.blackboard.stage.getPointerPosition();
    const stagePos = this.blackboard.getStagePosition();
    if (!pos) return;
    const wb = this.blackboard.getLastLine()
    if (!wb) return;
    const nextPoints = [pos.x - stagePos.x, pos.y - stagePos.y]
    const newPoints = wb.line.points().concat(nextPoints);
    wb.line.points(newPoints);
    this.blackboard.layer.batchDraw();
  }
  moveEventByMode(mode: ModeType, e: Konva.KonvaEventObject<PointerEvent>) {
    switch (mode) {
      case 'panning':
        // this.draggingMove(mode);
        break;
      case 'delete':
        // this.deleteModeDown(mode);
        break;
      default:
        if(isPaintType(mode)) {
          this.addMove(mode, e);
        }
        break;
    }
  }
  addUp(mode: PaintType) {
    const wb = this.blackboard.getLastLine()
    if (!wb) return;
    this.blackboard.stackManager.addStack({
      id: `stack-${generateHash()}`,
      action: 'add',
      timeline: {
        start: wb.timestamp.start,
        end: Date.now(),
        duration: Date.now() - wb.timestamp.start
      },
      paint: {
        id: wb.line.id(),
        type: wb.type,
        lineConfig: wb.config.lineConfig,
        points: wb.line.points()
      }
    })
    this.blackboard.updated('paint up');
  }
  upEventByMode(mode: ModeType) {
    switch (mode) {
      case 'panning':
        // this.draggingUp(mode);
        break;
      case 'delete':
        // this.deleteModeUp(mode);
        break;
      default:
        if(isPaintType(mode)) {
          this.addUp(mode);
        }
        break;
    }
  }
  stageDown = (e: Konva.KonvaEventObject<PointerEvent>) => {
    if (!this.blackboard) return
    this.downEventByMode(this.blackboard.mode);
  }
  stageMove = (e: Konva.KonvaEventObject<PointerEvent>) => {
    if (!this.blackboard) return
    const isDragging = this.blackboard.mode === 'panning'
    if (!isDragging) this.drawCursor(e.evt.offsetX, e.evt.offsetY);
    this.moveEventByMode(this.blackboard.mode, e);
  }
  stageUp = (e: Konva.KonvaEventObject<PointerEvent>) => {
    if (!this.blackboard) return
    this.isPaint = false;
    this.upEventByMode(this.blackboard.mode);
  }
}
export default Handlers