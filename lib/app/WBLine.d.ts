import Konva from "konva";
import { PaintType } from "./types";
type UserType = 'local' | 'remote';
type WBLineConfig = {
    userId: string;
    userType: UserType;
    lineConfig: Konva.LineConfig;
    deleteAble?: boolean;
};
declare class WBLine {
    userId: string;
    line: Konva.Line;
    type: PaintType;
    timestamp: {
        start: number;
        end: number;
    };
    config: WBLineConfig;
    constructor(config: WBLineConfig);
    setTimestamp(timestamp: {
        start?: number;
        end?: number;
    }): void;
    getLine(): import("konva/lib/shapes/Line").Line<import("konva/lib/shapes/Line").LineConfig>;
    getPoints(): number[];
}
export default WBLine;
