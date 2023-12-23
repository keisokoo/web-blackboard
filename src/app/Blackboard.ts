import Konva from "konva";
import { ModeType } from "./types";
import BrushDefault from "./BrushDefault";
import Cursor from "./Cursor";
import StackManager from "./StackManager";
import WBLine from "./WBLine";
import { isPaintType } from "./types";
import Handlers from "./Handlers";

type WebBlackboardCallBackData = {
  message: string
  data?: unknown
}

type BlackboardConfig = {
  width?: number
  height?: number
  callback: (data: WebBlackboardCallBackData) => void
}
class Blackboard {
  userId: string
  container: HTMLDivElement;
  width: number = window.innerWidth;
  height: number = window.innerHeight;
  brush: BrushDefault;
  mode: ModeType = 'pen';
  cursor: Cursor;
  stackManager: StackManager;
  layer: Konva.Layer;
  stage: Konva.Stage;
  handlers: Handlers;
  lines: Map<string, WBLine> = new Map(); // event handler 에서 사용되며, userId를 key로 사용한다. remote 라인과 구별하기 위해 Map을 사용.
  callback: (data: WebBlackboardCallBackData) => void = () => { };
  constructor(userId: string, container: HTMLDivElement, config?: BlackboardConfig) {
    this.userId = userId
    this.container = container;
    if (config) {
      this.width = config.width || this.width;
      this.height = config.height || this.height;
    }
    this.stage = new Konva.Stage({
      container: this.container,
      width: this.width,
      height: this.height,
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
    })
    this.layer = new Konva.Layer();
    this.stage.add(this.layer);
    this.brush = new BrushDefault();
    this.cursor = new Cursor(this);
    this.stackManager = new StackManager();
    this.handlers = new Handlers(this);
    this.callback = config?.callback || this.callback
    window.addEventListener('resize', () => { // TODO: refactor this 
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.stage.width(this.width);
      this.stage.height(this.height);
      this.stage.draw();
    })
    this.setStageHandler(this.handlers);
  }
  setStageHandler(handlers: Handlers) {
    this.stage.on('pointerdown', handlers.stageDown);
    this.stage.on('pointerup', handlers.stageUp);
    this.stage.on('pointermove', handlers.stageMove);
  }
  setNewLine(wb: WBLine) {
    this.lines.set(wb.userId, wb); // userId is wb's ID, remote 라인과 구별하기 위해
    this.layer.add(wb.line);
    this.updated('paint down');
  }
  getLastLine(id?: string) { // TODO: userId is wb's ID, 호출한 곳에서 remote 라인일 경우를 고려해야함
    return this.lines.get(id ? id : this.userId);
  }
  setMode(mode: ModeType) {
    this.mode = mode;
    let currentBrush = this.brush.getBrushConfig()
    if (this.mode === 'panning') {
      this.stage.draggable(true)
      this.container.style.cursor = 'grab';
    } else {
      this.stage.draggable(false)
      this.container.style.cursor = 'none';
    }
    if (isPaintType(mode)) {
      currentBrush = this.brush.setBrushType(mode)
    }
    return currentBrush
  }
  updated<T extends object>(message: string, extraData?: T) {
    this.callback({
      message,
      data: {
        mode: this.mode,
        brush: this.brush.getBrushConfig(),
        undoStack: this.stackManager.getUndoStack(),
        redoStack: this.stackManager.getRedoStack(),
        stacks: this.stackManager.getStacks(),
        ...extraData
      }
    })
  }
  getStagePosition(): { x: number, y: number } {
    const position = JSON.parse(JSON.stringify(this.stage.getPosition()));
    return { x: position.x, y: position.y };
  }
}
export default Blackboard;