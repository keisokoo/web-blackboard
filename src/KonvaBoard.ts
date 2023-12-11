import Konva from "konva";
import generateHash from "./helper/generateHash";
import { LineConfig } from "konva/lib/shapes/Line";
import JSZip from 'jszip';

type ModeType = 'brush' | 'eraser' | 'delete';
type ActionType = 'add' | 'remove';
function debounce(func: (...args: any[]) => void, wait: number) {
  let timeout: NodeJS.Timeout;
  return function (this: GlobalEventHandlers, ...args: any[]) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
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
type TimelineType = {
  start: number,
  end: number
}
type StackType = {
  id: string,
  mode: ModeType,
  action: ActionType,
  startAt: number,
  duration: number
}
type AudioInfo = {
  startTime: number,
  endTime: number,
  duration: number
  historyStack: HistoryStack[]
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
  private animations: Set<Konva.Animation> = new Set();
  private audioChunks: BlobPart[] = [];
  private uploadedAudioUrl: string = '';
  private mediaRecorder: MediaRecorder | null = null;
  private audioInfo: AudioInfo | null = null;
  private playingTimeouts: Set<NodeJS.Timeout> = new Set();
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
  appendStack(lines: Konva.Line[], manuallyControl?: {
    actionType?: ActionType,
    withoutHistory?: boolean
  }) {
    if (!lines || lines.length < 0) return;
    const endNow = Date.now();
    if (!this.timeline.start) this.timeline.start = endNow;
    this.timeline.end = endNow;
    const startAt = this.timeline.start;
    const duration = this.timeline.end - this.timeline.start;
    const currentAction = manuallyControl?.actionType ?? this.mode === 'delete' ? 'remove' : 'add';
    const stack: StackType = { id: `stack-${generateHash()}`, mode: this.mode, action: currentAction, startAt, duration }
    this.undoStack.push({ ...stack, lines });
    if (!manuallyControl?.withoutHistory) this.historyStack.push({ ...stack, options: this.copyLineOptions(lines) });
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
    const { lines, ...rest } = { ...last }
    const forStackType = { ...rest }
    forStackType.startAt = Date.now();
    forStackType.duration = 0;
    this.historyStack.push({ ...forStackType, options: this.copyLineOptions(lines) });
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
    const { lines, ...rest } = { ...last }
    const forStackType = { ...rest }
    forStackType.startAt = Date.now();
    forStackType.duration = 0;
    this.historyStack.push({ ...forStackType, options: this.copyLineOptions(lines) });
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
  animateLineWithDuration(duration: number, layer: Konva.Layer, lineOptions: LineConfig, endCallback?: (newLine: Konva.Line) => void) {
    let startTime: number;
    const { points, ...rest } = lineOptions;
    if (!points || points.length < 2) return;
    const newLine = new Konva.Line({ ...rest, points: [] });

    this.bindHitLineEvent(newLine);
    layer.add(newLine);
    const animation = new Konva.Animation((frame) => {
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
        animation.stop();
        if (animation.id) this.animations.delete(animation);
        endCallback && endCallback(newLine);
      }
    }, layer);
    this.animations.add(animation);
    animation.start();
  }
  stopAllAnimations() {
    this.animations.forEach(anim => {
      anim.stop();
      this.animations.delete(anim);
    });
  }

  clearAllTimeouts() {
    this.playingTimeouts.forEach(clearTimeout);
    this.playingTimeouts.clear();
  }
  stopHistoryReplay() {
    this.isPlaying = false;
    this.clearAllTimeouts();
    this.updated('stop history replay');
  }
  reRenderBeforeHistoryStack(historyStack: HistoryStack[], seekTime: number) {
    this.clearAllTimeouts();
    this.stopAllAnimations()
    this.layer.destroyChildren();
    const threshold = 1000;
    const stacksBeforeInitialTime = historyStack.filter((stack) => (stack.startAt - (seekTime + threshold) <= 0));
    stacksBeforeInitialTime.forEach((stack) => {
      if (stack.action === 'remove') {
        stack.options.forEach(option => {
          const newLine = this.layer.findOne(`#${option.id}`)
          if (!newLine) return;
          newLine.remove();
        })
      } else {
        stack.options.forEach(option => {
          const newLine = new Konva.Line(option)
          this.layer.add(newLine);
        })
      }
    })
    this.updated('reRenderBeforeHistoryStack');
  }
  setAudioStack(audioInfo: AudioInfo, audioBlob: string) {
    this.isPlaying = true;
    this.undoStack = [];
    this.redoStack = [];
    this.updated('setAudioStack');
    if (document.querySelector('#audio')) document.querySelector('#wb-audio')?.remove();
    const audioElement = document.createElement('audio');
    audioElement.src = audioBlob;
    audioElement.id = 'wb-audio';
    audioElement.controls = true;
    this.el.appendChild(audioElement);
    const initialTime = audioInfo.startTime;
    this.reRenderBeforeHistoryStack(audioInfo.historyStack, initialTime);
    const stacksAfterInitialTime = audioInfo.historyStack.filter((stack) => (stack.startAt - initialTime >= 0));
    let historyMap = new Map<number, HistoryStack[]>();
    stacksAfterInitialTime.forEach(stack => {
      const timeKey = Math.floor((stack.startAt - initialTime) / 1000);
      if (!historyMap.has(timeKey)) {
        historyMap.set(timeKey, []);
      }
      historyMap.get(timeKey)?.push(stack);
    });
    let isSeeking = false;
    audioElement.onpause = () => {
      console.log('onpause')
      this.clearAllTimeouts();
      this.stopAllAnimations()
    }
    audioElement.oncanplay = () => {
      this.clearAllTimeouts();
      isSeeking = true;
    }
    audioElement.onplay = () => {
      if (!isSeeking) {
        if (audioElement.currentTime === 0) {
          this.clearAllTimeouts();
          this.stopAllAnimations();
          this.reRenderBeforeHistoryStack(audioInfo.historyStack, initialTime);
          isSeeking = false;
        }
        return
      };
      this.clearAllTimeouts();
      console.log('onplay')
      const currentTime = Math.floor(audioElement.currentTime);
      this.reRenderBeforeHistoryStack(audioInfo.historyStack, initialTime + currentTime * 1000);
      isSeeking = false;
    }
    audioElement.muted = true;
    const $this = this;
    const debouncedSeekedHandler = debounce(function () {
      if (!audioElement.paused) return;
      console.log('onseeked')
      const currentTime = Math.floor(audioElement.currentTime);
      $this.reRenderBeforeHistoryStack(audioInfo.historyStack, initialTime + currentTime * 1000);
    }, 250);
    audioElement.onseeked = debouncedSeekedHandler
    audioElement.ontimeupdate = () => {
      console.log('isSeeking', isSeeking)
      if (isSeeking) {
        return
      };
      const currentTime = Math.floor(audioElement.currentTime);
      if (historyMap.has(currentTime)) {
        const historyStack = historyMap.get(currentTime);
        if (!historyStack) return;
        if (historyStack.length === 0) return;
        historyStack.forEach((stack) => {
          const delay = stack.startAt - initialTime - currentTime * 1000;
          const playTimeout = setTimeout(() => {
            if (stack.action === 'remove') {
              stack.options.forEach(option => {
                const newLine = this.layer.findOne(`#${option.id}`)
                if (!newLine) return;
                newLine.remove();
              })
            } else {
              stack.options.forEach(option => {
                if (stack.duration === 0) {
                  const newLine = new Konva.Line(option)
                  this.layer.add(newLine);
                  return;
                }
                this.animateLineWithDuration(stack.duration, this.layer, option);
              })
            }
          }, delay)
          this.playingTimeouts.add(playTimeout);
        })
      }
    }
    audioElement.onpause = () => {
      this.isPlaying = false;
      this.updated('paused history Stack')
    }
    audioElement.onended = () => {
      isSeeking = false;
    }
    this.audioInfo = audioInfo;
    this.historyStack = audioInfo.historyStack;


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
      const playTimeout = setTimeout(() => {
        if (stack.action === 'remove') {
          stack.options.forEach(option => {
            const newLine = this.layer.findOne(`#${option.id}`)
            if (!newLine) return;
            newLine.remove();
          })
        } else {
          stack.options.forEach(option => {
            if (stack.duration === 0) {
              const newLine = new Konva.Line(option)
              this.layer.add(newLine);
              return;
            }
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
      this.playingTimeouts.add(playTimeout);
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
  async getAudioStream() {
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      console.error('오디오 스트림을 얻는 데 실패했습니다:', err);
    }
  }

  async startRecording() {
    const stream = await this.getAudioStream();
    if (!stream) {
      console.error('오디오 스트림을 얻는 데 실패했습니다: 사용자 권한 거부');
      return
    };
    let ext = 'wav'
    let options = {};
    if (MediaRecorder.isTypeSupported('audio/mp4; codecs="aac"')) {
      options = { mimeType: 'audio/mp4; codecs="aac"' };
      ext = 'aac';
    } else if (MediaRecorder.isTypeSupported('audio/webm; codecs=opus')) {
      options = { mimeType: 'audio/webm; codecs=opus' };
      ext = 'opus';
    }
    this.mediaRecorder = new MediaRecorder(stream, options);
    this.mediaRecorder.start();

    let startTime = Date.now();

    this.mediaRecorder.ondataavailable = (event) => {
      this.audioChunks.push(event.data);
    };

    this.mediaRecorder.onstop = () => {
      if (!this.audioInfo) return;
      const endTime = Date.now();
      const audioBlob = new Blob(this.audioChunks, { type: `audio/${ext}` });
      this.audioInfo = {
        ...this.audioInfo,
        endTime: endTime,
        duration: endTime - this.audioInfo.startTime,
        historyStack: this.historyStack
      }
      const audioUrl = URL.createObjectURL(audioBlob);
      // 오디오 처리 로직 (예: 오디오 재생, 저장 등)
      console.log('audioUrl: ', audioUrl);
      // this.createDownloadLink(audioUrl);
      this.downloadZip(audioBlob, this.audioInfo, ext);
      this.audioChunks = []; // 다음 녹음을 위해 배열 초기화
    };
    this.mediaRecorder.onstart = () => {
      console.log('녹음 시작');
      this.audioInfo = {
        startTime: Date.now(),
        endTime: 0,
        duration: 0,
        historyStack: []
      }
    }
  }
  stopRecording() {
    if (!this.mediaRecorder) return;
    this.mediaRecorder.stop();
  }
  createDownloadLink(audioUrl: string) {
    const downloadLink = document.createElement('a');
    downloadLink.href = audioUrl;
    downloadLink.download = 'recorded_audio.wav';
    downloadLink.textContent = 'Download Audio';
    document.body.appendChild(downloadLink);
    downloadLink.click();
  }
  downloadZip(audioBlob: Blob, jsonScript: AudioInfo, audioExt: string) {
    const zip = new JSZip();

    // 음성 파일과 스크립트를 ZIP에 추가
    zip.file(`audio.${audioExt}`, audioBlob);
    zip.file('audioInfo.json', JSON.stringify(jsonScript));

    // ZIP 파일 생성
    zip.generateAsync({ type: 'blob' })
      .then((zipContent) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(zipContent);
        a.download = 'webBoardRecord-' + Date.now() + '.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        this.audioInfo = null;
      });
  }
  handleZipFile(file: File) {
    console.log('file: ', file)
    JSZip.loadAsync(file).then(async (zip) => {
      const stackJson = zip.file('audioInfo.json')
      const audioBlob = zip.file('audio.opus') ?? zip.file('audio.aac') ?? zip.file('audio.wav');
      console.log('stackJson', stackJson)
      console.log('audioBlob', audioBlob)
      if (!audioBlob) return;
      if (!stackJson) return;
      let audioJson: AudioInfo;
      let blobUrl: string;
      const json = await stackJson.async('string')
      const blob = await audioBlob.async('blob')
      const audioInfo = JSON.parse(json);
      audioJson = audioInfo;
      const audioUrl = URL.createObjectURL(blob);
      blobUrl = audioUrl
      this.setAudioStack(audioJson, blobUrl);
    })
  }
  playAudio() {
    console.log('this.audioInfo', this.audioInfo);
    if (!this.audioInfo) return;
    console.log('this.audioInfo.historyStack: ', this.audioInfo.historyStack);
    this.playHistoryStack(this.audioInfo.historyStack);
    const audio = new Audio(this.uploadedAudioUrl);
    audio.play();
  }
}
export default KonvaBoard;