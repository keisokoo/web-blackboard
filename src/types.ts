export type DrawingType = 'pen' | 'eraser' | 'partialEraser';
export type PathActionType = 'add' | 'remove' | 'edited';

export type HistoryStack = {
  hash: string;
  pathAction: PathActionType;
}
