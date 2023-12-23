import Konva from "konva";
import { ModeType } from "./types";
import BrushDefault from "./BrushDefault";
import Cursor from "./Cursor";
import StackManager from "./StackManager";
import WBLine from "./WBLine";
import { isPaintType } from "./types";

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
  container: HTMLDivElement;
  width: number = window.innerWidth;
  height: number = window.innerHeight;
  brush: BrushDefault;
  mode: ModeType = 'pen';
  cursor: Cursor;
  stackManager: StackManager;
  layer: Konva.Layer;
  stage: Konva.Stage;
  lines: Map<string, WBLine> = new Map();
  callback: (data: WebBlackboardCallBackData) => void = () => { };
  constructor(container: HTMLDivElement, config?: BlackboardConfig) {
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
    this.callback = config?.callback || this.callback
  }
  setMode(mode: ModeType) {
    this.mode = mode;
    let currentBrush = this.brush.getBrushConfig()
    if(this.mode === 'panning'){
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
  updated(message: string, extraData?: unknown) {
    this.callback({
      message,
      data: {
        mode: this.mode,
        brush: this.brush.getBrushConfig(),
        stacks: this.stackManager.getStacks(),
      }
    })
  }
  getStagePosition(): { x: number, y: number } {
    const position = JSON.parse(JSON.stringify(this.stage.getPosition()));
    return { x: position.x, y: position.y };
  }
}
export default Blackboard;