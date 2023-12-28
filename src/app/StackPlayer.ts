import Konva from "konva";
import Blackboard from "./Blackboard";
import { RecordInfoType, StackType } from "./types";

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
class StackPlayer {
  blackboard: Blackboard;

  private backgroundLayer: Konva.Layer;
  private drawingLayer: Konva.Layer;

  recordInfo: RecordInfoType | null = null;
  audio: HTMLAudioElement | null = null;
  timeInfo: AudioTimeInfo = {
    currentTime: 0,
    duration: 0,
    percent: 0,
    currentTimeStr: '00:00'
  }
  startTime: number = 0; // audio의 시작 시간 Date.now()값
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
    this.backgroundLayer = new Konva.Layer({
      id: 'backgroundLayer'
    });
    this.drawingLayer = new Konva.Layer({
      id: 'drawingLayer'
    });
    this.blackboard.stage.add(this.backgroundLayer);
    this.blackboard.stage.add(this.drawingLayer);

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
    this.blackboard.layer.hide();
    this.blackboard.backgroundLayer.hide();
    this.backgroundLayer.destroyChildren();
    this.drawingLayer.destroyChildren();
    this.blackboard.stage.position({ x: 0, y: 0 });
    this.blackboard.setBackground(this.recordInfo.firstImage, true);
    this.playedStacks.forEach(stack => {
      this.blackboard.stackManager.runStack(stack);
    })
    this.blackboard.stage.draw();
    this.blackboard.updated('pre-render-played-stacks');
  }
  reRenderDrawingLayer(seekTime: number, updateCurrentTime: boolean) {
    if (!this.recordInfo) return;
    if (this.audio && updateCurrentTime) this.audio.currentTime = seekTime;
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
  setRecord(audioElement: HTMLAudioElement, recordInfo: RecordInfoType) {
    this.recordInfo = recordInfo;
    this.audio = audioElement;
    this.audio.src = this.recordInfo.audioUrl;
    this.audio.preload = "metadata";
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
      this.reRenderDrawingLayer(currentAudio.currentTime, true);
    }
  }

}
export default StackPlayer;