import JSZip from "jszip";
import WebBlackBoard from "./WebBlackBoard";
import { AudioInfo, HistoryStack } from "./types";
import Konva from "konva";
import { LineConfig } from "konva/lib/shapes/Line";
import { FFmpeg } from '@ffmpeg/ffmpeg'

type AudioTimeInfo = {
  currentTime: number;
  duration: number;
  percent: number;
  currentTimeStr: string;
}
type AudioCallbackData = {
  message: string,
  data: {
    audioInfo: AudioInfo | null
    isPlaying: boolean
    timeInfo: AudioTimeInfo
  }
}
function debounce(func: (...args: unknown[]) => void, wait: number) {
  let timeout: NodeJS.Timeout;
  return function (this: unknown, ...args: unknown[]) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

class RecordBlackboard {
  audioElement: HTMLAudioElement;
  private isSeeking: boolean = false;
  private movedSeeker: boolean = false;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: BlobPart[] = [];
  private audioInfo: AudioInfo | null = null;
  private webBlackboard: WebBlackBoard;
  private animations: Set<Konva.Animation> = new Set();
  private playingTimeouts: Set<NodeJS.Timeout> = new Set();
  private beforeHistoryStack: HistoryStack[] = [];
  private playHistoryStack: HistoryStack[] = [];
  private initialTime: number = 0;
  private backgroundLayer: Konva.Layer;
  private backgroundImg: Konva.Image | null = null;
  private drawingLayer: Konva.Layer;
  private historyMap: Map<number, HistoryStack[]> = new Map();
  private playMap: Map<number, HistoryStack[]> = new Map();
  private audioEnded: boolean = false;
  private duration: number = 0;
  cb: (data: AudioCallbackData) => void = (() => { });
  timeCallback: (data: AudioTimeInfo) => void = (() => { });
  private seekerWrapper: HTMLDivElement | null = null;
  private seekerElement: HTMLDivElement | null = null;
  private nextTime: number = 0;
  constructor(webBlackboard: WebBlackBoard, audioElement: HTMLAudioElement) {
    this.audioElement = audioElement;
    this.webBlackboard = webBlackboard;
    this.backgroundLayer = new Konva.Layer();
    this.drawingLayer = new Konva.Layer();
    this.webBlackboard.stage.add(this.backgroundLayer);
    this.webBlackboard.stage.add(this.drawingLayer);
  }
  async toggleAudio() {
    console.log('this.audioInfo', this.audioInfo)
    console.log('this.audioElement', this.audioElement)
    if (!this.audioInfo) return;
    if (this.audioElement.paused) {
      await this.audioElement.play();
    } else {
      this.audioElement.pause();
    }
    return !this.audioElement.paused;
  }
  setCallback(cb: (data: AudioCallbackData) => void) {
    this.cb = cb;
  }
  setTimeCallback(cb: (data: AudioTimeInfo) => void) {
    this.timeCallback = cb;
  }
  setSeeker(seekerElement: HTMLDivElement, seekerWrapper: HTMLDivElement) {
    this.seekerElement = seekerElement;
    this.seekerWrapper = seekerWrapper
    this.seekerWrapper.onpointerdown = this.onSeekerDown.bind(this);
    this.seekerWrapper.onpointermove = this.onSeekerMove.bind(this);
    this.seekerWrapper.onpointerup = this.onSeekerUp.bind(this);
  }
  destroySeeker() {
    if (!this.seekerWrapper) return;
    this.seekerWrapper.onpointerdown = null;
    this.seekerWrapper.onpointermove = null;
    this.seekerWrapper.onpointerup = null;
    this.seekerWrapper = null;
    this.seekerElement = null;
  }

  debouncedFunction = debounce(() => {
    console.log('debouncedFunction', this.nextTime)
    if (!this.isSeeking) return;
    this.isSeeking = false;
    this.reRenderDrawingLayer(this.nextTime);
  }, 250);
  updateSeeker(percent: number) {
    if (!this.seekerElement) return;
    if (!this.seekerWrapper) return;
    this.seekerElement.style.width = percent + '%'
  }
  onSeekerMove(e: PointerEvent) {
    if (!this.isSeeking) return;
    if (!this.audioElement) return;
    if (!this.seekerWrapper) return;
    if (!this.seekerElement) return;
    this.movedSeeker = true;

    const XPosition = e.pageX - this.seekerWrapper.offsetLeft;
    const percent = (XPosition / this.seekerWrapper.offsetWidth) * 100;
    this.seekerElement.style.width = percent + '%'
    const currentTime = this.duration * percent / 100;
    this.nextTime = currentTime;
    console.log('currentTime', currentTime)
    // run methods with debounce

    this.debouncedFunction();
  }
  onSeekerUp(e: PointerEvent) {
    console.log('onSeekerUp',)
    if (!this.audioElement) return;
    if (!this.seekerWrapper) return;
    if (!this.seekerElement) return;
    if (this.movedSeeker) {
    }

    const XPosition = e.pageX - this.seekerWrapper.offsetLeft;
    const percent = (XPosition / this.seekerWrapper.offsetWidth) * 100;
    this.seekerElement.style.width = percent + '%'
    const currentTime = this.duration * percent / 100;
    this.nextTime = currentTime;
    this.reRenderDrawingLayer(this.nextTime);
    console.log('currentTime', currentTime)
    this.isSeeking = false;
  }
  onSeekerDown() {
    if (!this.audioInfo) return;
    if (!this.audioElement) return;
    if (!this.seekerElement) return;
    console.log('onSeekerDown',)
    console.log(this.audioElement.duration, this.audioInfo!.duration / 1000, this.duration)
    this.isSeeking = true;
    this.movedSeeker = false;
  }
  parseTimeToHHMMSS(time: number) {
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time - hours * 3600) / 60);
    const seconds = Math.floor(time - hours * 3600 - minutes * 60);
    const hoursStr = hours < 10 ? `0${hours}` : `${hours}`;
    const minutesStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
    const secondsStr = seconds < 10 ? `0${seconds}` : `${seconds}`;
    return `${hoursStr}:${minutesStr}:${secondsStr}`;
  }
  parseTimeToPercent(currentTime: number, duration: number) {
    return currentTime / duration * 100;
  }
  parseCurrentTime(currentTime: number) {
    if (!this.audioElement || !this.audioInfo) return {
      currentTime: 0,
      duration: 0,
      percent: 0,
      currentTimeStr: '00:00:00'
    }
    return {
      currentTime,
      duration: this.duration,
      percent: this.parseTimeToPercent(currentTime, this.duration),
      currentTimeStr: this.parseTimeToHHMMSS(currentTime)
    }
  }
  setAudioStack(audioInfo: AudioInfo, audioUrl: string) {
    this.audioElement.src = audioUrl ?? `http://localhost:3000/audio.aac`;
    this.audioElement.preload = 'metadata';
    this.audioInfo = audioInfo;
    const initialTime = audioInfo.startTime;
    this.initialTime = audioInfo.startTime;
    this.setHistoryStack(audioInfo.historyStack, this.initialTime);
    this.backgroundLayer.destroyChildren();
    this.drawingLayer.destroyChildren();
    this.webBlackboard.layer.destroyChildren();
    this.playHistoryStack.forEach(stack => {
      const timeKey = Math.floor((stack.startAt - initialTime) / 1000);
      if (!this.historyMap.has(timeKey)) {
        this.historyMap.set(timeKey, []);
      }
      this.historyMap.get(timeKey)?.push(stack);
    });
    console.log('this.historyMap', this.historyMap)
    this.playMap = new Map(this.historyMap);
    this.audioElement.onloadedmetadata = () => {
      if (!this.audioInfo) return;
      console.log('시간', this.audioElement.duration, isFinite(this.audioElement.duration))
      this.duration = isFinite(this.audioElement.duration) ? this.audioElement.duration : this.audioInfo.duration / 1000;

      this.cb({
        message: 'loadedmetadata',
        data: {
          audioInfo,
          isPlaying: false,
          timeInfo: this.parseCurrentTime(this.audioElement.currentTime)
        }
      })
    }
    this.audioElement.onpause = () => {
      this.stopHistoryReplay();
      let timeInfo = this.parseCurrentTime(this.audioElement.currentTime);
      this.cb({
        message: 'pause',
        data: {
          audioInfo,
          isPlaying: false,
          timeInfo,
        }
      })
      this.timeCallback(timeInfo);
    }
    this.audioElement.onended = () => {
      this.stopHistoryReplay();
      this.playMap = new Map(this.historyMap);
      let timeInfo = this.parseCurrentTime(this.audioElement.currentTime);
      timeInfo.currentTime = this.duration;
      timeInfo.percent = 100;
      this.cb({
        message: 'ended',
        data: {
          audioInfo,
          isPlaying: false,
          timeInfo
        }
      })
      this.timeCallback(timeInfo);
      this.audioEnded = true;
    }
    this.audioElement.onseeked = () => {
      console.log('onseeked')
      if (this.isSeeking) return;
      this.reRenderDrawingLayer(this.audioElement.currentTime, true);
    }
    this.audioElement.ontimeupdate = (e) => {
      if (this.isSeeking) {
        return
      };
      const timeInfo = this.parseCurrentTime(this.audioElement.currentTime)
      const currentTime = Math.floor(this.audioElement.currentTime);
      if (currentTime === 0 && this.audioEnded) {
        this.audioEnded = false;
        this.drawingLayer.destroyChildren();
      }
      if (this.playMap.has(currentTime)) {
        const historyStack = this.playMap.get(currentTime);
        this.playMap.delete(currentTime);
        if (!historyStack) return;
        if (historyStack.length === 0) return;
        historyStack.forEach((stack) => {
          const delay = stack.startAt - initialTime - currentTime * 1000;
          const playTimeout = setTimeout(() => {
            this.drawingStack(stack, this.drawingLayer);
          }, delay)
          this.playingTimeouts.add(playTimeout);
        })
        console.log('currentTime', currentTime)
        this.cb({
          message: 'timeupdate',
          data: {
            audioInfo,
            isPlaying: !this.audioElement.paused,
            timeInfo: timeInfo
          }
        })
      }
      this.timeCallback(timeInfo);
      this.updateSeeker(timeInfo.percent)
    }
    this.cb({
      message: 'loadedmetadata',
      data: {
        audioInfo,
        isPlaying: false,
        timeInfo: this.parseCurrentTime(this.audioElement.currentTime)
      }
    })
  }

  protected setHistoryStack(historyStack: HistoryStack[], seekTime: number) {
    this.beforeHistoryStack = historyStack.filter((stack) => (stack.startAt - seekTime <= 0));
    this.playHistoryStack = historyStack.filter((stack) => (stack.startAt - seekTime > 0));
    this.preRenderBeforeHistoryStack();
  }

  protected drawingStack(stack: HistoryStack, layer: Konva.Layer, useAnimation: boolean = true) {
    if (!layer) return;
    const position = {
      before: stack.action === 'panning-before' ? stack.afterPosition : stack.beforePosition,
      after: stack.action === 'panning-before' ? stack.beforePosition : stack.afterPosition
    }
    if (stack.action.includes('panning')) {
      if (!useAnimation) {
        this.webBlackboard.stage.position(position.after);
        return;
      }
      this.animateStageMovement(this.webBlackboard.stage, position, stack.duration);
    } else {
      const stackPosition = position.after
      const currentPosition = this.webBlackboard.stage.getPosition()
      if (currentPosition.x !== stackPosition.x || currentPosition.y !== stackPosition.y) {
        if (!useAnimation) {
          this.webBlackboard.stage.position(position.after);
          return;
        }
        this.animateStageMovement(this.webBlackboard.stage, position, stack.duration);
      }
    }
    if (stack.action === 'remove') {
      stack.options.forEach(option => {
        const newLine = this.drawingLayer.findOne(`#${option.id}`)
        if (!newLine) return;
        newLine.remove();
      })
    } else {
      stack.options.forEach(option => {
        if (stack.duration === 0 || !useAnimation) {
          const newLine = new Konva.Line(option)
          this.drawingLayer.add(newLine);
          return;
        }
        this.animateLineWithDuration(stack.duration, this.drawingLayer, option);
      })
    }
  }

  protected preRenderBeforeHistoryStack() {
    this.webBlackboard.stage.position({ x: 0, y: 0 });
    this.beforeHistoryStack.forEach((stack) => {
      this.drawingStack(stack, this.backgroundLayer!);
    })
    this.webBlackboard.updated('preRenderBeforeHistoryStack');
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
    this.webBlackboard.isPlaying = false;
    this.clearAllTimeouts();
    this.stopAllAnimations()
    this.webBlackboard.updated('stop history replay');
  }

  async getAudioStream() {
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      console.error('오디오 스트림을 얻는 데 실패했습니다:', err);
    }
  }
  reRenderDrawingLayer(seekTime: number, disableTimeUpdate?: boolean) {
    if (!disableTimeUpdate) this.audioElement.currentTime = seekTime;
    this.clearAllTimeouts();
    this.stopAllAnimations()
    this.webBlackboard.stage.position({ x: 0, y: 0 });
    this.drawingLayer.destroyChildren();
    this.playMap = new Map(this.historyMap);
    const result: HistoryStack[][] = [];
    for (const [key, value] of Array.from(this.historyMap.entries())) {
      if (Number.isInteger(key) && key <= Math.floor(seekTime) && seekTime !== 0) {
        result.push(value);
        this.playMap.delete(key);
      }
    }
    result.flat().forEach((stack) => {
      this.drawingStack(stack, this.drawingLayer, false);
    })
    this.webBlackboard.updated('reRenderBeforeHistoryStack');
  }
  animateStageMovement(stage: Konva.Stage, stagePosition: {
    before: { x: number, y: number },
    after: { x: number, y: number }
  }, duration: number) {
    let startX = stagePosition.before.x;
    let startY = stagePosition.before.y;
    let endX = stagePosition.after.x;
    let endY = stagePosition.after.y;
    const animation = new Konva.Animation((frame) => {
      if (!frame) return;
      let time = frame.time, // 애니메이션 진행 시간 (밀리초)
        timeFraction = time / duration; // 진행 비율 (0 ~ 1)

      if (timeFraction > 1) timeFraction = 1;

      let newX = startX + (endX - startX) * timeFraction; // 새 X 위치
      let newY = startY + (endY - startY) * timeFraction; // 새 Y 위치

      stage.position({ x: newX, y: newY });

      if (timeFraction === 1) {
        animation.stop(); // 애니메이션 종료
        this.animations.delete(animation)
      }
    }, stage);
    this.animations.add(animation);
    animation.start(); // 애니메이션 시작
  }
  animateLineWithDuration(duration: number, layer: Konva.Layer, lineOptions: LineConfig, endCallback?: (newLine: Konva.Line) => void) {
    let startTime: number;
    const { points, ...rest } = lineOptions;
    if (!points || points.length < 2) return;
    const newLine = new Konva.Line({ ...rest, points: [] });

    this.webBlackboard.eventHandlers.bindHitLineEvent(newLine);
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
        this.animations.delete(animation);
        endCallback && endCallback(newLine);
      }
    }, layer);
    this.animations.add(animation);
    animation.start();
  }
  async getAudioInfo(audioData: Uint8Array | string) {
    const ffmpeg = new FFmpeg();
    ffmpeg.load()
    ffmpeg.writeFile('audio.opus', audioData)
    await ffmpeg.exec(['-i', 'audio.opus', '-f', 'null', '-']);
    const data = await ffmpeg.readFile('output.txt');
    console.log('data', data)
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
      const json = await stackJson.async('string')
      const blob = await audioBlob.async('blob')
      const audioInfo = JSON.parse(json);
      audioJson = audioInfo;
      const audioUrl = URL.createObjectURL(blob);
      this.setAudioStack(audioJson, audioUrl);
    })
  }
  async startRecording() {
    const stream = await this.getAudioStream();
    if (!stream) {
      console.error('오디오 스트림을 얻는 데 실패했습니다: 사용자 권한 거부');
      return
    };
    let ext = 'wav'
    let options: MediaRecorderOptions = {
      audioBitsPerSecond: 32768,
    };
    // safari
    if (MediaRecorder.isTypeSupported('audio/webm; codecs=opus')) {
      options = { ...options, mimeType: 'audio/webm; codecs=opus' };
      ext = 'opus';
    } else
      if (MediaRecorder.isTypeSupported('audio/mp4; codecs=mp4a')) {
        options = { ...options, mimeType: 'audio/mp4; codecs=mp4a' };
        ext = 'aac';
      }
    this.mediaRecorder = new MediaRecorder(stream, options);
    this.mediaRecorder.start();

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
        historyStack: this.webBlackboard.historyStack
      }

      const audioUrl = URL.createObjectURL(audioBlob);
      this.downloadZip(audioBlob, this.audioInfo, ext);
      this.audioChunks = [];

      this.mediaRecorder = null;
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

}
export default RecordBlackboard
