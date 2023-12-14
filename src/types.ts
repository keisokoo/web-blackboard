import Konva from "konva";
import { LineConfig } from "konva/lib/shapes/Line";

export type ModeType = 'brush' | 'eraser' | 'delete' | 'dragging';
export type ActionType = 'add' | 'remove' | 'panning-after' | 'panning-before';

export type TimelineType = {
  start: number,
  end: number
}
export type StackType = {
  id: string,
  mode: ModeType,
  action: ActionType,
  startAt: number,
  duration: number,
  beforePosition: Konva.Vector2d
  afterPosition: Konva.Vector2d
}
export type AudioInfo = {
  startTime: number,
  endTime: number,
  duration: number
  historyStack: HistoryStack[]
}
export type ControlStack = StackType & {
  lines: Konva.Line[]
}
export type HistoryStack = StackType & {
  options: LineConfig[]
}

export type CallbackData = {
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
export class WebBoardValues {
  protected isPaint: boolean = false;
  protected mode: ModeType = 'brush';
  protected isEraseLine: boolean = false;
  protected undoStack: ControlStack[] = [];
  protected redoStack: ControlStack[] = [];
  protected historyStack: HistoryStack[] = [];
  protected lastRemovedLines: Set<Konva.Line> = new Set();
  protected isPlaying: boolean = false;
  protected timeline: TimelineType = {
    start: 0,
    end: 0
  };
  protected animations: Set<Konva.Animation> = new Set();
  protected audioChunks: BlobPart[] = [];
  protected uploadedAudioUrl: string = '';
  protected mediaRecorder: MediaRecorder | null = null;
  protected audioInfo: AudioInfo | null = null;
  protected playingTimeouts: Set<NodeJS.Timeout> = new Set();
  brushes: {
    brush: BrushOptions,
    eraser: BrushOptions,
    delete: BrushOptions,
    dragging: BrushOptions
  } = {
      brush: new BrushOptions(),
      eraser: new BrushOptions({
        brushSize: 10,
        color: '#ffffff'
      }),
      delete: new BrushOptions(eraseLineDefault),
      dragging: new BrushOptions()
    }
  currentBrush: BrushOptions = this.brushes[this.mode];
  protected lastLine: Konva.Line = new Konva.Line();
}