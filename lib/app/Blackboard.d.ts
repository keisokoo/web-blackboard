import Konva from "konva";
import { BlackboardUserType, ChatMessage, EgressInfo, LiveControlUserType, ModeType, RecordDataType, StackType } from "./types";
import BrushDefault from "./BrushDefault";
import Cursor from "./Cursor";
import StackManager from "./StackManager";
import WBLine from "./WBLine";
import Handlers from "./Handlers";
import LiveControl from "./LiveControl";
import StackPlayer from "./StackPlayer";
type WebBlackboardCallBackData = {
    message: string;
    data?: {
        brush: ReturnType<BrushDefault['getBrushConfig']>;
        mode: ModeType;
        undoStack: StackType[];
        redoStack: StackType[];
        stacks: StackType[];
        userList: Map<string, LiveControlUserType>;
        egressInfo?: EgressInfo | null;
        access?: LiveControlUserType['access'];
        recordData?: RecordDataType | null;
        nowRecord?: boolean;
    };
};
type BlackboardConfig = {
    width?: number;
    height?: number;
    image?: string;
    callback: (data: WebBlackboardCallBackData) => void;
    isPublisher?: boolean;
    bucketUrl?: {
        bucket: string;
        region: string;
        presigned?: (url: string) => Promise<string>;
    };
};
declare class Blackboard {
    egressInfo: EgressInfo | null;
    nowRecord: boolean;
    recordData: RecordDataType | null;
    user: BlackboardUserType;
    userList: Map<string, LiveControlUserType>;
    isPublisher: boolean;
    container: HTMLDivElement;
    width: number;
    height: number;
    brush: BrushDefault;
    mode: ModeType;
    cursor: Cursor;
    stackManager: StackManager;
    layer: Konva.Layer;
    backgroundLayer: Konva.Layer;
    stage: Konva.Stage;
    handlers: Handlers;
    lines: Map<string, WBLine>;
    background: Konva.Image | null;
    firstBackgroundImage: string;
    liveControl: LiveControl;
    callback: (data: WebBlackboardCallBackData) => void;
    chatCallback: (data: ChatMessage) => void;
    onClose: () => void;
    stackPlayer: StackPlayer;
    constructor(user: BlackboardUserType, container: HTMLDivElement, config: BlackboardConfig);
    setChatCallback(callback: (data: ChatMessage) => void): void;
    setOnClose(onClose: () => void): void;
    clear(clearControlStacks?: boolean): void;
    sizeLimit({ width, height }: {
        width: number;
        height: number;
    }, limit?: number): {
        width: number;
        height: number;
    };
    setBackground(image: string, ignoreStack?: boolean): void;
    setStageHandler(handlers: Handlers): void;
    setNewLine(wb: WBLine): void;
    getLastLine(id?: string): WBLine | undefined;
    getMode(): ModeType;
    setMode(mode: ModeType): {
        type: "pen" | "marker" | "eraser";
        config: import("konva/lib/Shape").ShapeConfig;
    };
    updated<T extends object>(message: string, extraData?: T): void;
    getUserInfo(userId: string): LiveControlUserType | undefined;
    getStagePosition(): {
        x: number;
        y: number;
    };
}
export default Blackboard;
