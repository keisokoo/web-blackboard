import { ClearStackType, ImageStackType, PaintStackType, PanningStackType, StackType, StackTypeString } from "./types";
import Blackboard from "./Blackboard";
declare class StackManager {
    stacks: Map<string, StackType>;
    undoStack: StackType[];
    redoStack: StackType[];
    blackboard: Blackboard;
    constructor(blackboard: Blackboard, stacks?: StackType[]);
    private remoteCallback;
    initStacks(stacks: StackType[]): void;
    redrawStacksByClearIndex(index: number): void;
    addStack(stack: StackType, pushUndoStack?: boolean, remote?: boolean): void;
    reverseStackActionType(stack?: StackType): StackType | undefined;
    runStack(stack: StackType): void;
    undo(): void;
    clearRedoStack(): void;
    redo(): void;
    removeStack(id: string): void;
    removeStacksAfter(id: string): void;
    getStack(id: string): StackType | undefined;
    getStacks(): StackType[];
    getUndoStack(): StackType[];
    getRedoStack(): StackType[];
    clearControlStacks(): void;
    clearAllStacks(): void;
    isPaintStackType(stack: StackType): stack is PaintStackType;
    isPanningStackType(stack: StackType): stack is PanningStackType;
    isImageStackType(stack: StackType): stack is ImageStackType;
    isClearStackType(stack: StackType): stack is ClearStackType;
    isStackType(stack: StackType): stack is StackType;
    getStackType(stack: StackType): {
        type: StackTypeString;
        stack: StackType;
    };
}
export default StackManager;
