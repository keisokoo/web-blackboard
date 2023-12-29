import Konva from "konva";
import { BlackboardUserType, LiveControlUserType, ModeType, RecordDataType, RoleType, StackType } from "./types";
import BrushDefault from "./BrushDefault";
import Cursor from "./Cursor";
import StackManager from "./StackManager";
import WBLine from "./WBLine";
import { isPaintType } from "./types";
import Handlers from "./Handlers";
import LiveControl from "./LiveControl";
import StackPlayer from "./StackPlayer";

type WebBlackboardCallBackData = {
  message: string
  data?: {
    brush: ReturnType<BrushDefault['getBrushConfig']>
    mode: ModeType
    undoStack: StackType[]
    redoStack: StackType[]
    stacks: StackType[]
    userList: Map<string, LiveControlUserType>
    access?: LiveControlUserType['access'],
    recordData?: RecordDataType | null
  }
}

type BlackboardConfig = {
  width?: number
  height?: number
  image?: string
  callback: (data: WebBlackboardCallBackData) => void
  isPublisher?: boolean
  bucketUrl?: {
    bucket: string
    region: string
    presigned?: (url: string) => Promise<string>
  }
}
class Blackboard {
  recordData: RecordDataType | null = null
  user: BlackboardUserType
  userList: Map<string, LiveControlUserType> = new Map();
  isPublisher: boolean = true // false면 subscriber. TODO: subscriber는 최초에 드로잉 불가능하게 해야함. 현재는 로직으로만 처리
  container: HTMLDivElement;
  width: number = window.innerWidth;
  height: number = window.innerHeight;
  brush: BrushDefault;
  mode: ModeType = 'pen';
  cursor: Cursor;
  stackManager: StackManager;
  layer: Konva.Layer;
  backgroundLayer: Konva.Layer;
  stage: Konva.Stage;
  handlers: Handlers;
  lines: Map<string, WBLine> = new Map(); // event handler 에서 사용되며, userId를 key로 사용한다. remote 라인과 구별하기 위해 Map을 사용.
  background: Konva.Image | null = null;
  firstBackgroundImage: string = '';
  liveControl: LiveControl
  callback: (data: WebBlackboardCallBackData) => void = () => { };
  onClose: () => void = () => { };
  stackPlayer: StackPlayer;
  constructor(user: BlackboardUserType, container: HTMLDivElement, config: BlackboardConfig) {
    this.user = user
    this.container = container;
    if (config) {
      this.width = config.width || this.width;
      this.height = config.height || this.height;
      if (config.image) {
        this.firstBackgroundImage = config.image
        this.setBackground(config.image, true)
      }
      this.isPublisher = config.isPublisher ?? true
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
    this.backgroundLayer = new Konva.Layer();
    this.layer = new Konva.Layer();
    this.stage.add(this.backgroundLayer);
    this.stage.add(this.layer);
    this.brush = new BrushDefault();
    this.cursor = new Cursor(this);
    this.stackManager = new StackManager(this);
    this.liveControl = new LiveControl(this)
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
    if (this.user.role !== 'presenter') this.setMode('panning')
    this.stackPlayer = new StackPlayer(this)
  }
  setOnClose(onClose: () => void) {
    this.onClose = onClose
  }
  clear(clearControlStacks: boolean = false) {
    this.layer.destroyChildren();
    this.layer.draw();
    if (clearControlStacks) this.stackManager.clearControlStacks();
    this.stackManager.addStack({
      id: `stack-${Date.now()}`,
      action: 'after',
      timeline: {
        start: Date.now(),
      },
      clearIndex: this.stackManager.getStacks().length
    })
    this.updated('clear');
  }
  sizeLimit({ width, height }: { width: number, height: number }, limit?: number) {
    limit = limit ?? window.innerWidth
    if (width > limit) {
      width = limit
      height = height * (limit / width)
    }
    return { width, height }
  }
  setBackground(image: string, ignoreStack: boolean = false) {
    const beforeImage = this.background?.id() ?? image
    const imageObj = new Image();
    imageObj.onload = () => {
      // const { width, height } = this.sizeLimit({ width: imageObj.width, height: imageObj.height })
      const { width, height } = imageObj
      if (this.background) {
        this.background.id(image)
        this.background.image(imageObj)
        this.background.width(width)
        this.background.height(height)
      } else {
        this.background = new Konva.Image({
          id: image,
          image: imageObj,
          width,
          height,
          x: 0,
          y: 0,
          scaleX: 1,
          scaleY: 1
        })
        this.backgroundLayer.add(this.background);
      }
      this.backgroundLayer.draw();
      if (!ignoreStack) {
        this.stackManager.addStack({
          id: `stack-${Date.now()}`,
          action: 'after',
          timeline: {
            start: Date.now(),
          },
          image: {
            before: beforeImage,
            after: image
          }
        })
      }
      this.updated('set background');
    }
    imageObj.src = image;
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
    return this.lines.get(id ? id : this.user.id);
  }
  getMode() {
    return this.mode;
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
    this.updated('mode changed');
    return currentBrush
  }
  updated<T extends object>(message: string, extraData?: T) {
    const localUser = this.userList.get(this.user.id)

    this.callback({
      message,
      data: {
        mode: this.mode,
        brush: this.brush.getBrushConfig(),
        undoStack: this.stackManager.getUndoStack(),
        redoStack: this.stackManager.getRedoStack(),
        stacks: this.stackManager.getStacks(),
        userList: this.userList,
        access: localUser?.access,
        recordData: this.recordData,
        ...extraData
      }
    })
  }
  getUserInfo(userId: string) {
    return this.userList.get(userId)
  }
  getStagePosition(): { x: number, y: number } {
    const position = JSON.parse(JSON.stringify(this.stage.getPosition()));
    return { x: position.x, y: position.y };
  }
}
export default Blackboard;