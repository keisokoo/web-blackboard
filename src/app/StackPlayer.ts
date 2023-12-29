import Konva from "konva";
import Blackboard from "./Blackboard";
import { PaintStackType, RecordInfoType, StackType } from "./types";
import WBLine from "./WBLine";
import { LineConfig } from "konva/lib/shapes/Line";

type AudioTimeInfo = {
  currentTime: number;
  duration: number;
  percent: number;
  currentTimeStr: string;
}
type AudioCallbackData = {
  message: string,
  data: {
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

class StackPlayer {
  blackboard: Blackboard;
  currentStagePosition: {
    before: Konva.Vector2d
    after: Konva.Vector2d
  } = {
      before: {
        x: 0,
        y: 0
      },
      after: {
        x: 0,
        y: 0
      }
    }
  recordInfo: RecordInfoType | null = null;
  audio: HTMLAudioElement | null = null;
  seekerElement: HTMLDivElement | null = null;
  seekerWrapper: HTMLDivElement | null = null;

  timeInfo: AudioTimeInfo = {
    currentTime: 0,
    duration: 0,
    percent: 0,
    currentTimeStr: '00:00'
  }
  startTime: number = 0; // audio의 시작 시간 Date.now()값
  nextTime: number = 0;
  historyStack: StackType[] = [];
  playedStacks: StackType[] = []; // audio의 시작 시간 이전에 실행된 스택들
  notPlayingStacks: StackType[] = []; // audio의 시작 시간 이후에 실행된 스택들
  historyMap: Map<number, StackType[]> = new Map(); // 전체 스택을 시간(초)순으로 정렬한 Map
  playMap: Map<number, StackType[]> = new Map(); // 실행할 스택을 시간(초)순으로 정렬한 Map, 실행 후에는 각 항목을 delete한다.

  isSeeking = false;
  movedSeeker = false;
  isPlaying = false;
  audioEnded = false;

  private playingTimeouts: Set<NodeJS.Timeout> = new Set();
  animations: Set<Konva.Animation> = new Set();

  audioUpdated: (data: AudioCallbackData) => void = (() => { });

  constructor(blackboard: Blackboard) {
    this.blackboard = blackboard;
    const currentStagePosition = this.blackboard.stage.getPosition();
    this.currentStagePosition = {
      before: currentStagePosition,
      after: currentStagePosition
    }
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
    this.clearAllTimeouts();
    this.stopAllAnimations()
    this.blackboard.updated('stop history replay');
  }
  setAudioUpdated(cb: (data: AudioCallbackData) => void) {
    this.audioUpdated = cb;
  }
  updated(message: string, currentAudioTime?: number) {
    this.audioUpdated({
      message,
      data: {
        isPlaying: this.isPlaying,
        timeInfo: this.getTimeInfo(currentAudioTime)
      }
    })
  }

  getTimeInfo(currentTime?: number) {
    if (!this.audio) return {
      currentTime: 0,
      duration: 0,
      percent: 0,
      currentTimeStr: '00:00'
    }
    if (currentTime)
      this.timeInfo = {
        currentTime,
        duration: this.timeInfo.duration,
        percent: this.parseTimeToPercent(currentTime, this.timeInfo.duration),
        currentTimeStr: this.parseTimeToHHMMSS(currentTime)
      }
    return this.timeInfo
  }

  parseTimeToHHMMSS(time: number) {
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time - hours * 3600) / 60);
    const seconds = Math.floor(time - hours * 3600 - minutes * 60);
    const hoursStr = hours < 10 ? `0${hours}` : `${hours}`;
    const minutesStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
    const secondsStr = seconds < 10 ? `0${seconds}` : `${seconds}`;
    return `${hours ? hoursStr + ':' : ''}${minutesStr}:${secondsStr}`;
  }

  parseTimeToPercent(currentTime: number, duration: number) {
    return currentTime / duration * 100;
  }

  setStacksBySeekTime(historyStacks: StackType[], seekTime: number) {
    // seekTime과 timeline.start는 실행 시점의 Date.now()값을 지니고 있다.
    this.playedStacks = historyStacks.filter(stack => stack.timeline.start - seekTime <= 0);
    this.notPlayingStacks = historyStacks.filter(stack => stack.timeline.start - seekTime > 0);
    this.preRenderPlayedStacks()
  }
  private preRenderPlayedStacks() {
    if (!this.recordInfo) return;
    this.blackboard.backgroundLayer.destroyChildren();
    this.blackboard.stage.position({ x: 0, y: 0 });
    this.blackboard.setBackground(this.recordInfo.firstImage, true);
    this.playedStacks.forEach(stack => {
      this.blackboard.stackManager.runStack(stack);
    })
    this.blackboard.stage.draw();
    this.blackboard.updated('pre-render-played-stacks');
  }
  disposeActionDirection<T>(action: 'before' | 'after', data: {
    before: T,
    after: T
  }) {
    if (action === 'before') return {
      before: data.after,
      after: data.before
    };
    return data
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

  animateLineWithDuration(duration: number, layer: Konva.Layer, paintStack: PaintStackType, endCallback?: (newLine: Konva.Line) => void) {
    if (!paintStack) return;
    const points = paintStack.paint.points
    const lineOptions = paintStack.paint.lineConfig;
    let startTime: number;
    if (!points || points.length < 2) return;

    const wb = new WBLine({
      userType: 'local',
      userId: this.blackboard.user.id,
      lineConfig: {
        ...lineOptions
      },
      deleteAble: true
    })

    const newLine = wb.line;

    this.blackboard.handlers.bindHitLineEvent(wb);
    layer.add(newLine);
    console.log('drawing!', points)
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

  drawingStack(stack: StackType, useAnimation: boolean = false) {
    if (!useAnimation || stack.action === 'remove') {
      this.blackboard.stackManager.runStack(stack);
      return
    }
    const isImageStack = this.blackboard.stackManager.isImageStackType(stack);
    const isPanningStack = this.blackboard.stackManager.isPanningStackType(stack);
    const isClearStack = this.blackboard.stackManager.isClearStackType(stack);
    const isPaintStack = this.blackboard.stackManager.isPaintStackType(stack);

    if (isImageStack) {
      this.blackboard.stackManager.runStack(stack);
    }
    if (isPanningStack) {
      const position = this.disposeActionDirection(stack.action, {
        before: stack.panning.before,
        after: stack.panning.after
      })
      this.animateStageMovement(this.blackboard.stage, position, stack.timeline.duration);
    }
    if (isClearStack) {
      this.blackboard.stackManager.runStack(stack);
    }
    if (isPaintStack) {
      if (stack.action === 'add') {
        this.animateLineWithDuration(stack.timeline.duration, this.blackboard.layer, stack);
      }
    }
  }
  reRenderDrawingLayer(seekTime: number, updateCurrentTime: boolean = true) {
    if (!this.recordInfo) return;
    if (this.audio && updateCurrentTime) this.audio.currentTime = seekTime;
    this.clearAllTimeouts();
    this.stopAllAnimations()
    this.blackboard.stage.position({ x: 0, y: 0 });
    this.blackboard.layer.destroyChildren();

    this.playMap = new Map(this.historyMap);
    const result: StackType[][] = [];
    for (const [key, value] of Array.from(this.historyMap.entries())) {
      if (Number.isInteger(key) && key <= Math.floor(seekTime) && seekTime !== 0) {
        result.push(value);
        this.playMap.delete(key);
      }
    }
    result.flat().forEach((stack) => {
      this.drawingStack(stack, false);
    })
    this.blackboard.updated('reRenderBeforeHistoryStack');

  }
  setRecord(audioElement: HTMLAudioElement, recordInfo: RecordInfoType) {
    this.recordInfo = recordInfo;
    this.audio = audioElement;
    this.audio.src = this.recordInfo.audioUrl;
    this.audio.preload = "metadata";
    this.audio.style.display = 'none';
    this.startTime = this.recordInfo.audioInfo.startTime;
    this.historyStack = this.recordInfo.audioInfo.historyStack;
    this.setStacksBySeekTime(this.historyStack, this.startTime);

    // 재생할 스택들을 시간(초)순으로 정렬한 Map을 만든다.
    this.notPlayingStacks.forEach(stack => {
      const timeKey = Math.floor((stack.timeline.start - this.startTime) / 1000);
      if (!this.historyMap.has(timeKey)) {
        this.historyMap.set(timeKey, []);
      }
      this.historyMap.get(timeKey)?.push(stack);
    })
    this.playMap = new Map(this.historyMap);

    this.audio.onloadedmetadata = (e) => {
      const currentAudio = e.target as HTMLAudioElement;
      const duration = isFinite(currentAudio.duration) ? currentAudio.duration : recordInfo.audioInfo.duration;
      console.log('current duration', duration)
      this.timeInfo = {
        currentTime: currentAudio.currentTime,
        duration,
        percent: 0,
        currentTimeStr: '00:00'
      }
      this.updated('audio-loaded-metadata');
    }
    this.audio.onpause = (e) => {
      const currentAudio = e.target as HTMLAudioElement;
      this.stopHistoryReplay();
      this.isPlaying = false;
      this.updated('audio-paused', currentAudio.currentTime);
    }
    this.audio.onended = (e) => {
      const currentAudio = e.target as HTMLAudioElement;
      this.stopHistoryReplay();
      this.playMap = new Map(this.historyMap);
      this.isPlaying = false;
      this.audioEnded = true;
      this.updated('audio-ended', currentAudio.currentTime);
    }
    this.audio.onseeked = (e) => {
      const currentAudio = e.target as HTMLAudioElement;
      if (this.isSeeking) return;
      this.reRenderDrawingLayer(currentAudio.currentTime, false);
    }

    this.audio.ontimeupdate = (e) => {
      if (this.isSeeking) {
        return
      };
      const currentAudio = e.target as HTMLAudioElement;
      const timeInfo = this.getTimeInfo(currentAudio.currentTime)
      const currentTime = Math.floor(currentAudio.currentTime);
      if (currentTime === 0 && this.audioEnded) {
        this.audioEnded = false;
        this.blackboard.layer.destroyChildren();
      }
      if (this.playMap.has(currentTime)) {
        const historyStack = this.playMap.get(currentTime);
        this.playMap.delete(currentTime);
        if (!historyStack) return;
        if (historyStack.length === 0) return;
        historyStack.forEach((stack) => {
          const delay = stack.timeline.start - this.startTime - currentTime * 1000;
          const playTimeout = setTimeout(() => {
            this.drawingStack(stack, true);
          }, delay)
          this.playingTimeouts.add(playTimeout);
        })
        this.updated('audio-time-update', currentAudio.currentTime);
      }
      this.updateSeeker(timeInfo.percent)
    }
  }

  async toggleAudio() {
    if (!this.recordInfo) return;
    if (!this.audio) return;
    if (this.audio.paused) {
      await this.audio.play();
    } else {
      this.audio.pause();
    }
    return !this.audio.paused;
  }
  debouncedFunction = debounce(() => {
    console.log('debouncedFunction', this.nextTime)
    if (!this.isSeeking) return;
    this.isSeeking = false;
    this.updateSeeker(this.parseTimeToPercent(this.nextTime, this.timeInfo.duration))
    this.reRenderDrawingLayer(this.nextTime);
  }, 250);

  updateSeeker(percent: number) {
    if (!this.seekerElement) return;
    if (!this.seekerWrapper) return;
    this.seekerElement.style.width = percent + '%'
  }
  onSeekerDown() {
    if (!this.recordInfo) return;
    if (!this.audio) return;
    if (!this.seekerElement) return;
    this.isSeeking = true;
    this.movedSeeker = false;
    // if (!this.audio.paused) {
    //   this.audio.pause();
    // }
  }
  onSeekerMove(e: PointerEvent) {
    if (!this.isSeeking) return;
    if (!this.audio) return;
    if (!this.seekerWrapper) return;
    if (!this.seekerElement) return;
    this.movedSeeker = true;

    const XPosition = e.pageX - this.seekerWrapper.offsetLeft;
    const percent = (XPosition / this.seekerWrapper.offsetWidth) * 100;
    this.seekerElement.style.width = percent + '%'
    const currentTime = this.timeInfo.duration * percent / 100;
    this.nextTime = currentTime;
    console.log('currentTime', currentTime)
    // run methods with debounce

    this.debouncedFunction(this);
  }
  onSeekerUp(e: PointerEvent) {
    console.log('onSeekerUp',)
    if (!this.audio) return;
    if (!this.seekerWrapper) return;
    if (!this.seekerElement) return;
    if (!this.movedSeeker) {
      this.movedSeeker = false;
      const XPosition = e.pageX - this.seekerWrapper.offsetLeft;
      const percent = (XPosition / this.seekerWrapper.offsetWidth) * 100;
      this.seekerElement.style.width = percent + '%'
      const currentTime = this.timeInfo.duration * percent / 100;
      this.nextTime = currentTime;
      this.reRenderDrawingLayer(this.nextTime);
      console.log('currentTime', currentTime)
    }
    // if (this.audio.paused) {
    //   this.audio.play();
    // }
    this.isSeeking = false;
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
}
export default StackPlayer;