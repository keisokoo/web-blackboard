import Konva from "konva";
import Blackboard from "./Blackboard";
import WBLine from "./WBLine";
import generateHash from "../helper/generateHash";
import { ModeType, PaintType, isPaintType } from "./types";
import { StackType } from "../types";

class Handlers {
  blackboard: Blackboard;
  isPaint: boolean = false;
  isPanning: boolean = false;
  isDeleteMode: boolean = false;
  startTime: number = 0;
  endTime: number = 0;
  beforeStagePosition: Konva.Vector2d = {
    x: 0,
    y: 0
  }
  afterStagePosition: Konva.Vector2d = {
    x: 0,
    y: 0
  }
  constructor(blackboard: Blackboard) {
    this.blackboard = blackboard
  }
  private deleteLine(wb: WBLine) {
    const deleteAble = wb.config.deleteAble;
    if (!deleteAble) return;
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
  private getDrawable() {
    return this.blackboard.userList.get(this.blackboard.user.id)?.access.draw
  }
  bindHitLineEvent(wb: WBLine) {
    wb.line.on('pointerdown', (e) => {
      if (!this.getDrawable()) return;
      if (this.blackboard.mode === 'delete' && wb.line) {
        this.deleteLine(wb)
      }
    });
    wb.line.on('pointerover', (e) => {
      if (!this.getDrawable()) return;
      if (this.blackboard.mode === 'delete' && this.isDeleteMode && wb.line) {
        this.deleteLine(wb)
      }
    });
  }
  remoteDown(wb: WBLine) {
    const remoteWb = new WBLine({
      userType: 'remote',
      userId: wb.userId,
      lineConfig: {
        id: `remote-${generateHash()}`,
        points: wb.line.points(),
        ...wb.config.lineConfig
      },
      deleteAble: true
    })
    const remoteData = {
      type: 'remote-down',
      userType: 'remote',
      userId: this.blackboard.user.id,
      lineConfig: {
        id: remoteWb.line.id(),
        points: remoteWb.line.points(),
        ...remoteWb.config.lineConfig
      },
    }
    this.blackboard.liveControl.publishData(JSON.stringify(remoteData))
  }
  addDown(mode: PaintType) {
    if (!this.getDrawable()) return;
    this.isPaint = true;
    this.beforeStagePosition = this.blackboard.getStagePosition();
    this.afterStagePosition = this.blackboard.getStagePosition();
    const pos = this.blackboard.stage.getPointerPosition();
    const stagePos = this.blackboard.getStagePosition();
    if (!pos) return;
    const brushConfig = this.blackboard.brush.getBrushConfig();
    const wb = new WBLine({
      userType: 'local',
      userId: this.blackboard.user.id,
      lineConfig: {
        id: `${mode}-${generateHash()}`,
        points: [pos.x - stagePos.x, pos.y - stagePos.y],
        ...brushConfig.config
      },
      deleteAble: true
    })
    this.bindHitLineEvent(wb);
    this.blackboard.setNewLine(wb);
    this.remoteDown(wb);
  }
  draggingDown(mode: ModeType) {
    if (mode !== 'panning') return
    this.isPanning = true;
    this.beforeStagePosition = this.blackboard.getStagePosition();
    this.startTime = Date.now();
    this.blackboard.container.style.cursor = 'grabbing';
    this.blackboard.updated('dragstart');
  }
  deleteModeDown(mode: ModeType) {
    if (mode !== 'delete') return
    this.isDeleteMode = true;
  }
  downEventByMode(mode: ModeType) {
    switch (mode) {
      case 'panning':
        this.draggingDown(mode);
        break;
      case 'delete':
        this.deleteModeDown(mode);
        break;
      default:
        if (isPaintType(mode)) {
          this.addDown(mode);
        }
        break;
    }
  }
  deleteMove(mode: ModeType) {
    return
  }
  draggingMove(mode: ModeType) {
    if (mode !== 'panning') return;
    if (!this.isPanning) return;
    console.log('this.blackboard.getStagePosition();', this.blackboard.getStagePosition())
  }
  remoteMove(userId: string, nextPoints: number[]) {
    const remoteData = {
      type: 'remote-move',
      userType: 'remote',
      userId,
      nextPoints
    }
    this.blackboard.liveControl.publishData(JSON.stringify(remoteData))
  }
  addMove(mode: PaintType, e: Konva.KonvaEventObject<PointerEvent>) {
    if (!this.getDrawable()) return;
    if (!this.isPaint || this.isDeleteMode) return;
    e.evt.preventDefault();
    const pos = this.blackboard.stage.getPointerPosition();
    const stagePos = this.blackboard.getStagePosition();
    if (!pos) return;
    const wb = this.blackboard.getLastLine()
    if (!wb) return;
    const nextPoints = [pos.x - stagePos.x, pos.y - stagePos.y]
    const newPoints = wb.line.points().concat(nextPoints);
    wb.line.points(newPoints);
    this.remoteMove(this.blackboard.user.id, nextPoints);
    this.blackboard.layer.batchDraw();
  }
  moveEventByMode(mode: ModeType, e: Konva.KonvaEventObject<PointerEvent>) {
    switch (mode) {
      case 'panning':
        this.draggingMove(mode);
        break;
      case 'delete':
        this.deleteMove(mode);
        break;
      default:
        if (isPaintType(mode)) {
          this.addMove(mode, e);
        }
        break;
    }
  }
  remoteUp(wb: WBLine) {
    const remoteData = {
      type: 'remote-up',
      userType: 'remote',
      userId: this.blackboard.user.id,
      lineConfig: {
        id: wb.line.id(),
        points: wb.line.points(),
        ...wb.config.lineConfig
      },
    }
    console.log('remoteData', remoteData)
    this.blackboard.liveControl.publishData(JSON.stringify(remoteData))
  }
  addUp(mode: PaintType) {
    if (!this.getDrawable()) return;
    this.isPaint = false;
    const wb = this.blackboard.getLastLine()
    if (!wb) return;
    wb.setTimestamp({ end: Date.now() })
    this.blackboard.stackManager.addStack({
      id: `stack-${generateHash()}`,
      action: 'add',
      timeline: {
        start: wb.timestamp.start,
        end: wb.timestamp.end,
        duration: (wb.timestamp.start - wb.timestamp.start) / 1000
      },
      paint: {
        id: wb.line.id(),
        type: wb.type,
        lineConfig: wb.config.lineConfig,
        points: wb.line.points()
      }
    }, true, false)
    this.remoteUp(wb)
    this.blackboard.updated('paint up');
  }
  draggingUp(mode: ModeType) {
    if (mode !== 'panning') return
    this.isPanning = false;
    this.afterStagePosition = this.blackboard.getStagePosition();
    this.endTime = Date.now();
    this.blackboard.container.style.cursor = 'grab';
    this.blackboard.stackManager.addStack({
      id: `${mode}-${generateHash()}`,
      action: 'after',
      timeline: {
        start: this.startTime,
        end: this.endTime,
        duration: (this.endTime - this.startTime) / 1000
      },
      panning: {
        before: this.beforeStagePosition,
        after: this.afterStagePosition
      }
    }, true, this.blackboard.isPublisher)
    this.blackboard.updated('dragend');
  }
  deleteModeUp(mode: ModeType) {
    if (mode !== 'delete') return
    this.isDeleteMode = false;
    this.isPaint = false;
  }
  upEventByMode(mode: ModeType) {
    switch (mode) {
      case 'panning':
        this.draggingUp(mode);
        break;
      case 'delete':
        this.deleteModeUp(mode);
        break;
      default:
        if (isPaintType(mode)) {
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
    this.isDeleteMode = false;
    this.upEventByMode(this.blackboard.mode);
  }
}
export default Handlers