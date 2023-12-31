import Konva from "konva";
export type ClearStackType = {
    id: string;
    action: 'before' | 'after';
    timeline: {
        start: number;
    };
    clearIndex: number;
};
export type PaintStackType = {
    id: string;
    action: 'add' | 'remove';
    timeline: {
        start: number;
        end: number;
        duration: number;
    };
    paint: {
        id: string;
        type: PaintType;
        lineConfig: Konva.LineConfig | null;
        points?: number[];
    };
};
export type PanningStackType = {
    id: string;
    action: 'before' | 'after';
    timeline: {
        start: number;
        end: number;
        duration: number;
    };
    panning: {
        before: Konva.Vector2d;
        after: Konva.Vector2d;
    };
};
export type ImageStackType = {
    id: string;
    action: 'before' | 'after';
    timeline: {
        start: number;
    };
    image: {
        before: string;
        after: string;
    };
};
export type StackType = PaintStackType | PanningStackType | ImageStackType | ClearStackType;
export type StackTypeString = 'paint' | 'panning' | 'image';
export type ActionType = 'add' | 'remove' | 'after' | 'before';
declare const paintTypes: readonly ["pen", "marker", "eraser"];
export type PaintType = typeof paintTypes[number];
export type ModeType = PaintType | 'panning' | 'image' | 'delete';
export declare function isPaintType(type: ModeType | string): type is PaintType;
export type RoleType = 'presenter' | 'audience' | 'player';
export type AccessType = {
    mic: boolean;
    draw: boolean;
};
export type UserType = {
    userId: string;
    role: RoleType;
    access: AccessType;
};
export type BlackboardUserType = {
    id: string;
    nickname: string;
    role: RoleType;
};
export type LiveControlUserType = {
    sid: string;
    access: AccessType;
    userType: 'local' | 'remote';
} & BlackboardUserType;
export type ChatMessage = {
    message: string;
    nickname: string;
    sender: string;
    timestamp: number;
};
export declare enum EgressStatus {
    EGRESS_STARTING = 0,
    EGRESS_ACTIVE = 1,
    EGRESS_ENDING = 2,
    EGRESS_COMPLETE = 3,
    EGRESS_FAILED = 4,
    EGRESS_ABORTED = 5,
    EGRESS_LIMIT_REACHED = 6,
    UNRECOGNIZED = -1
}
export interface FileInfo {
    filename?: string;
    startedAt?: number;
    endedAt?: number;
    duration?: number;
    size?: number;
    location?: string;
}
export type EgressInfo = {
    egressId?: string;
    roomId?: string;
    roomName?: string;
    status?: EgressStatus;
    startedAt?: number;
    endedAt?: number;
    updatedAt?: number;
    error?: string;
    fileResults?: FileInfo[];
};
export type AudioInfoType = {
    startTime: number;
    endTime: number;
    duration: number;
    historyStack: StackType[];
};
export type RecordDataType = {
    filename: string;
    firstImage: string;
    audioInfo: AudioInfoType;
};
export type RecordInfoType = {
    audioUrl: string;
    firstImage: string;
    audioInfo: {
        startTime: number;
        endTime: number;
        duration: number;
        historyStack: StackType[];
    };
};
export {};
