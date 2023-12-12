import JSZip from "jszip";
import WebBlackBoard from "./WebBlackBoard";
import { AudioInfo, HistoryStack } from "./types";
import Konva from "konva";
import { LineConfig } from "konva/lib/shapes/Line";

function debounce(func: (...args: any[]) => void, wait: number) {
  let timeout: NodeJS.Timeout;
  return function (this: GlobalEventHandlers, ...args: any[]) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

class RecordBlackboard {
  audioElement: HTMLAudioElement;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: BlobPart[] = [];
  private audioInfo: AudioInfo | null = null;
  private webBlackboard: WebBlackBoard;
  private animations: Set<Konva.Animation> = new Set();
  private playingTimeouts: Set<NodeJS.Timeout> = new Set();
  constructor(webBlackboard: WebBlackBoard, audioElement: HTMLAudioElement) {
    this.audioElement = audioElement;
    this.webBlackboard = webBlackboard;
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

  reRenderBeforeHistoryStack(historyStack: HistoryStack[], seekTime: number) {
    this.clearAllTimeouts();
    this.stopAllAnimations()
    this.webBlackboard.layer.destroyChildren();
    const threshold = 1000;
    const stacksBeforeInitialTime = historyStack.filter((stack) => (stack.startAt - (seekTime + threshold) <= 0));
    stacksBeforeInitialTime.forEach((stack) => {
      if (stack.action === 'remove') {
        stack.options.forEach(option => {
          const newLine = this.webBlackboard.layer.findOne(`#${option.id}`)
          if (!newLine) return;
          newLine.remove();
        })
      } else {
        stack.options.forEach(option => {
          const newLine = new Konva.Line(option)
          this.webBlackboard.layer.add(newLine);
        })
      }
    })
    this.webBlackboard.updated('reRenderBeforeHistoryStack');
  }
  animateLineWithDuration(duration: number, layer: Konva.Layer, lineOptions: LineConfig, endCallback?: (newLine: Konva.Line) => void) {
    let startTime: number;
    const { points, ...rest } = lineOptions;
    if (!points || points.length < 2) return;
    const newLine = new Konva.Line({ ...rest, points: [] });

    this.webBlackboard.bindHitLineEvent(newLine);
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
  setAudioStack(audioInfo: AudioInfo, audioBlob: string) {
    this.webBlackboard.isPlaying = true;
    this.webBlackboard.restoreControlStack();
    this.webBlackboard.updated('setAudioStack');
    const audioElement = this.audioElement;
    audioElement.src = audioBlob;
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
                const newLine = this.webBlackboard.layer.findOne(`#${option.id}`)
                if (!newLine) return;
                newLine.remove();
              })
            } else {
              stack.options.forEach(option => {
                if (stack.duration === 0) {
                  const newLine = new Konva.Line(option)
                  this.webBlackboard.layer.add(newLine);
                  return;
                }
                this.animateLineWithDuration(stack.duration, this.webBlackboard.layer, option);
              })
            }
          }, delay)
          this.playingTimeouts.add(playTimeout);
        })
      }
    }
    audioElement.onpause = () => {
      this.webBlackboard.isPlaying = false;
      this.webBlackboard.updated('paused history Stack')
    }
    audioElement.onended = () => {
      isSeeking = false;
    }
    this.audioInfo = audioInfo;
    this.webBlackboard.historyStack = audioInfo.historyStack;
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


}
export default RecordBlackboard
