import Blackboard from "./Blackboard";
declare class Cursor {
    private blackBoard;
    cursor: HTMLDivElement | null;
    constructor(blackBoard: Blackboard);
    private setDefaultCursorStyles;
    initCursor(): void;
    hideCursor(): void;
    drawCursor(x: number, y: number): void;
}
export default Cursor;
