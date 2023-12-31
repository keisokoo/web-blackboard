/// <reference types="node" />
import Konva from "konva";
import Blackboard from "./Blackboard";
import { PaintStackType, RecordInfoType, StackType } from "./types";
type AudioTimeInfo = {
    currentTime: number;
    duration: number;
    percent: number;
    currentTimeStr: string;
};
type AudioCallbackData = {
    message: string;
    data: {
        isPlaying: boolean;
        timeInfo: AudioTimeInfo;
    };
};
declare class StackPlayer {
    blackboard: Blackboard;
    currentStagePosition: {
        before: Konva.Vector2d;
        after: Konva.Vector2d;
    };
    recordInfo: RecordInfoType | null;
    audio: HTMLAudioElement | null;
    seekerElement: HTMLDivElement | null;
    seekerWrapper: HTMLDivElement | null;
    audioPaused: boolean;
    timeInfo: AudioTimeInfo;
    startTime: number;
    nextTime: number;
    historyStack: StackType[];
    playedStacks: StackType[];
    notPlayingStacks: StackType[];
    historyMap: Map<number, StackType[]>;
    playMap: Map<number, StackType[]>;
    isSeeking: boolean;
    movedSeeker: boolean;
    isPlaying: boolean;
    audioEnded: boolean;
    debounceTimeout: NodeJS.Timeout | null;
    private playingTimeouts;
    animations: Set<Konva.Animation>;
    audioUpdated: (data: AudioCallbackData) => void;
    constructor(blackboard: Blackboard);
    debounce(func: (...args: unknown[]) => void, wait: number, _this: StackPlayer): (this: unknown, ...args: unknown[]) => void;
    stopAllAnimations(): void;
    clearAllTimeouts(): void;
    stopHistoryReplay(): void;
    setAudioUpdated(cb: (data: AudioCallbackData) => void): void;
    updated(message: string, currentAudioTime?: number): void;
    getTimeInfo(currentTime?: number): AudioTimeInfo;
    parseTimeToHHMMSS(time: number): string;
    parseTimeToPercent(currentTime: number, duration: number): number;
    millisecondsToSeconds(milliseconds: number): number;
    setStacksBySeekTime(historyStacks: StackType[], seekTime: number): void;
    private preRenderPlayedStacks;
    disposeActionDirection<T>(action: 'before' | 'after', data: {
        before: T;
        after: T;
    }): {
        before: T;
        after: T;
    };
    animateStageMovement(stage: Konva.Stage, stagePosition: {
        before: {
            x: number;
            y: number;
        };
        after: {
            x: number;
            y: number;
        };
    }, duration: number): void;
    animateLineWithDuration(duration: number, layer: Konva.Layer, paintStack: PaintStackType, endCallback?: (newLine: Konva.Line) => void): void;
    drawingStack(stack: StackType, useAnimation?: boolean): void;
    reRenderDrawingLayer(seekTime: number, updateCurrentTime?: boolean): void;
    setRecord(audioElement: HTMLAudioElement, recordInfo: RecordInfoType): void;
    toggleAudio(): Promise<boolean | undefined>;
    updateSeeker(percent: number): void;
    onSeekerDown(): void;
    debouncedFunction: (this: unknown, ...args: unknown[]) => void;
    onSeekerMove(e: PointerEvent): void;
    onSeekerUp(e: PointerEvent): void;
    setSeeker(seekerElement: HTMLDivElement, seekerWrapper: HTMLDivElement): void;
    destroySeeker(): void;
}
export default StackPlayer;
