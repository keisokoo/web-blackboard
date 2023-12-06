export type DrawingType = 'pen' | 'eraser';
export type PathActionType = 'add' | 'remove';

export type HistoryStack = {
  hash: string;
  pathAction: PathActionType;
}
