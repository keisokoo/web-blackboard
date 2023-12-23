import Blackboard from "./Blackboard";

class Cursor {
  private blackBoard: Blackboard
  cursor: HTMLDivElement | null = null;
  constructor(blackBoard: Blackboard) {
    this.blackBoard = blackBoard
    this.initCursor()
  }
  private setDefaultCursorStyles(cursorElement: HTMLDivElement) {
    if (!cursorElement) return;
    cursorElement.id = 'wb-cursor';
    cursorElement.style.position = 'fixed';
    cursorElement.style.zIndex = '99999';
    cursorElement.style.pointerEvents = 'none';
    cursorElement.style.transform = 'translate(-50%, -50%)';
    cursorElement.style.border = '1px solid #000000';
    cursorElement.style.display = 'none';
  }
  initCursor() {
    if (document.querySelector('#wb-cursor')) {
      this.cursor = document.querySelector('#wb-cursor')!;
    } else {
      this.cursor = document.createElement('div');
      this.blackBoard.container.appendChild(this.cursor);
      this.setDefaultCursorStyles(this.cursor);
    }
  }
  hideCursor() {
    if (!this.cursor) return;
    this.cursor.style.display = 'none';
  }
  drawCursor(x: number, y: number) {
    if (!this.cursor) return;
    if (!this.blackBoard.container) return;
    if (!this.blackBoard.brush) return;
    if (x < 0 || x > this.blackBoard.width || y < 0 || y > this.blackBoard.height) {
      this.hideCursor();
      return;
    }
    const board = this.blackBoard.container
    const currentBrush = this.blackBoard.brush.getBrushConfig()
    const mode = this.blackBoard.mode
    const brushSize = currentBrush.config.strokeWidth!;
    const brushRadius = (mode === 'eraser' || mode === 'delete') ? 0 : brushSize / 2;
    this.cursor.style.width = brushSize + 'px';
    this.cursor.style.height = brushSize + 'px';
    this.cursor.style.display = 'block';
    this.cursor.style.top = `${y + board.offsetTop}px`;
    this.cursor.style.left = `${x - board.offsetLeft}px`;
    this.cursor.style.borderRadius = brushRadius + 'px';
  }
}
export default Cursor;