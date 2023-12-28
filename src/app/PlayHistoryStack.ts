import Konva from "konva";
import Blackboard from "./Blackboard";
import { StackType } from "./types";

type AudioWithStacksType = {
  id?: string
  url: string
  startTime: number // audio의 녹음 시작 시간 Date.now()값
  endTime?: number // audio의 녹음 종료 시간 Date.now()값
  duration?: number
  image: string
  historyStacks: StackType[]
}

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
class PlayHistoryStack {
  blackboard: Blackboard;

  private backgroundLayer: Konva.Layer;
  private drawingLayer: Konva.Layer;

  audioElement: HTMLAudioElement | null = null;
  backgroundImage: string; // 시작 시점의 이미지
  audioUrl: string;
  startTime: number = 0; // audio의 시작 시간 Date.now()값
  historyStacks: StackType[];
  playedStacks: StackType[] = []; // audio의 시작 시간 이전에 실행된 스택들
  notPlayingStacks: StackType[] = []; // audio의 시작 시간 이후에 실행된 스택들

  historyMap: Map<number, StackType[]> = new Map(); // 전체 스택을 시간(초)순으로 정렬한 Map
  playMap: Map<number, StackType[]> = new Map(); // 실행할 스택을 시간(초)순으로 정렬한 Map, 실행 후에는 각 항목을 delete한다.

  cb: (data: AudioCallbackData) => void = (() => { });
  timeCallback: (data: AudioTimeInfo) => void = (() => { });

  private animations: Set<Konva.Animation> = new Set();
  private playingTimeouts: Set<NodeJS.Timeout> = new Set();
  private audioEnded: boolean = false;
  private isSeeking: boolean = false;

  duration: number = 0;
  constructor(blackboard: Blackboard, data: AudioWithStacksType) {
    this.backgroundImage = data.image;
    this.blackboard = blackboard;

    this.backgroundLayer = new Konva.Layer({
      id: 'backgroundLayer'
    });
    this.drawingLayer = new Konva.Layer({
      id: 'drawingLayer'
    });
    this.blackboard.stage.add(this.backgroundLayer);
    this.blackboard.stage.add(this.drawingLayer);

    this.audioUrl = data.url;
    this.startTime = data.startTime;
    this.historyStacks = data.historyStacks;
    this.duration = data.duration ? data.duration / 1000 : 0;
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
    if (!this.audioElement) return {
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

  reRenderDrawingLayer(seekTime: number, disableTimeUpdate?: boolean) {
    if (!this.audioElement) return;
    if (!disableTimeUpdate) this.audioElement.currentTime = seekTime;
    this.clearAllTimeouts();
    this.stopAllAnimations()
    this.blackboard.stage.position({ x: 0, y: 0 });
    this.drawingLayer.destroyChildren();

    this.playMap = new Map(this.historyMap);
    const result: StackType[][] = [];
    for (const [key, value] of Array.from(this.historyMap.entries())) {
      if (Number.isInteger(key) && key <= Math.floor(seekTime) && seekTime !== 0) {
        result.push(value);
        this.playMap.delete(key);
      }
    }
    result.flat().forEach((stack) => {
      // this.drawingStack(stack, this.drawingLayer, false);
    })
    this.blackboard.updated('reRenderBeforeHistoryStack');
  }

  setAudio(audioElement: HTMLAudioElement, audioUrl: string) {
    this.audioElement = audioElement;
    this.audioElement.src = audioUrl;
    this.audioElement.preload = 'metadata';
    this.setStacksBySeekTime(this.historyStacks, this.startTime);
    this.preRenderPlayedStacks();
    this.notPlayingStacks.forEach(stack => {
      const timeKey = Math.floor((stack.timeline.start - this.startTime) / 1000);
      if (!this.historyMap.has(timeKey)) {
        this.historyMap.set(timeKey, []);
      }
      this.historyMap.get(timeKey)?.push(stack);
    })
    this.playMap = new Map(this.historyMap);

    this.audioElement.onloadedmetadata = () => {
      if (!this.historyStacks || !this.audioElement) return;
      this.duration = isFinite(this.audioElement.duration) ? this.audioElement.duration : this.duration / 1000;

      this.cb({
        message: 'loadedmetadata',
        data: {
          isPlaying: false,
          timeInfo: this.parseCurrentTime(this.audioElement.currentTime)
        }
      })
    }

    this.audioElement.onpause = () => {
      if (!this.audioElement) return;
      this.stopHistoryReplay();
      let timeInfo = this.parseCurrentTime(this.audioElement.currentTime);
      this.cb({
        message: 'pause',
        data: {
          isPlaying: false,
          timeInfo,
        }
      })
      this.timeCallback(timeInfo);
    }

    this.audioElement.onended = () => {
      if (!this.audioElement) return;
      this.stopHistoryReplay();
      this.playMap = new Map(this.historyMap);
      let timeInfo = this.parseCurrentTime(this.audioElement.currentTime);
      timeInfo.currentTime = this.duration;
      timeInfo.percent = 100;
      this.cb({
        message: 'ended',
        data: {
          isPlaying: false,
          timeInfo
        }
      })
      this.timeCallback(timeInfo);
      this.audioEnded = true;
    }

    this.audioElement.onseeked = () => {
      if (!this.audioElement) return;
      if (this.isSeeking) return;
      this.reRenderDrawingLayer(this.audioElement.currentTime, true);
    }
  }
  setStacksBySeekTime(historyStacks: StackType[], seekTime: number) {
    // seekTime과 timeline.start는 실행 시점의 Date.now()값을 지니고 있다.
    this.playedStacks = historyStacks.filter(stack => stack.timeline.start - seekTime <= 0);
    this.notPlayingStacks = historyStacks.filter(stack => stack.timeline.start - seekTime > 0);
    this.preRenderPlayedStacks()
  }
  private preRenderPlayedStacks() {
    this.blackboard.layer.hide();
    this.blackboard.backgroundLayer.hide();
    this.backgroundLayer.destroyChildren();
    this.drawingLayer.destroyChildren();
    this.blackboard.stage.position({ x: 0, y: 0 });
    this.blackboard.setBackground(this.backgroundImage, true);
    this.playedStacks.forEach(stack => {
      this.blackboard.stackManager.runStack(stack);
    })
    this.blackboard.stage.draw();
    this.blackboard.updated('pre-render-played-stacks');
  }
}
export default PlayHistoryStack;