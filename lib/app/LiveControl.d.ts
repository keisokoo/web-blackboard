/// <reference types="node" />
import { Room, RemoteParticipant, LocalTrackPublication, RemoteTrack, RemoteTrackPublication } from "livekit-client";
import Blackboard from "./Blackboard";
import { BlackboardUserType, LiveControlUserType, StackType, RecordDataType, EgressInfo, ChatMessage } from "./types";
type NotifyData = {
    type: 'request-draw' | 'request-mic' | 'egress_started' | 'init' | 'mute' | 'unmute' | 'draw-on' | 'draw-off';
    target?: string;
    requestId?: string;
};
declare class LiveControl {
    private wsURL;
    private wsToken;
    recordThreshold: number;
    recordLimit: number;
    limitTime: number;
    limitTimeout: NodeJS.Timeout | null;
    room: Room;
    publishTrack: LocalTrackPublication | null;
    audioElement: HTMLAudioElement | null;
    blackboard: Blackboard;
    recording?: {
        start: (roomName: string) => Promise<EgressInfo | null>;
        stop: (egressId: string, isCancel?: boolean) => Promise<EgressInfo | null>;
    };
    notify: (data: NotifyData) => void;
    timerCallback: (data: {
        limitTime: number;
        recordLimit: number;
    }) => void;
    constructor(blackboard: Blackboard);
    setTimerCallback(timerCallback: (data: {
        limitTime: number;
        recordLimit: number;
    }) => void): void;
    clearLimitTime(): void;
    pauseLimitTime(): void;
    checkLimitTime(): void;
    setNotify(notify: (data: NotifyData) => void): void;
    setRecording(recording: {
        start: (roomName: string) => Promise<EgressInfo | null>;
        stop: (egressId: string) => Promise<EgressInfo | null>;
    }): void;
    setURL(url: string): void;
    setToken(token: string): void;
    publishData(data: string, sids?: string[]): void;
    chat(message: string): ChatMessage;
    receiveData(data: string): void;
    init(audioElement: HTMLAudioElement, url: string, token: string): void;
    handleTrackSubscribed(track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant): void;
    setRoomEvent(currentRoom: Room): void;
    publishTracks(room: Room): Promise<void>;
    connect(): Promise<void>;
    groupingPlayingData(egressInfo: EgressInfo | null, stacks: StackType[]): RecordDataType | null;
    disconnect(): Promise<void>;
    cancelRecording(): Promise<void>;
    addUser(user: BlackboardUserType, participant?: RemoteParticipant | null): void;
    findParticipantByUserId(userId: string): [string, RemoteParticipant] | undefined;
    requestRemoteDraw(userId: string, sid: string): void;
    onRemoteDraw(userId: string, sid: string): void;
    offRemoteDraw(userId: string, sid: string): void;
    toggleDrawAble(userId: string, sid: string): void;
    requestRemoteMic(userId: string, sid: string): void;
    muteTracks(userId: string, sid: string): void;
    unmuteTracks(userId: string, sid: string): void;
    toggleMic(userId: string, sid: string): void;
    removeUser(userId: string): void;
    getCurrentUserBy(userId: string): LiveControlUserType | undefined;
    getRoomParticipants(): Map<string, RemoteParticipant>;
}
export default LiveControl;
