import WebBlackBoard from "../WebBlackBoard";

class BrushCursor {
  webBlackBoard: WebBlackBoard;
  cursor: HTMLDivElement | null = null;
  constructor(webBlackBoard: WebBlackBoard) {
    this.webBlackBoard = webBlackBoard
    this.initializeCursor()
  }
  private cursorStyle(cursorElement: HTMLDivElement) {
    if (!cursorElement) return;
    cursorElement.style.position = 'fixed';
    cursorElement.style.zIndex = '99999';
    cursorElement.style.pointerEvents = 'none';
    cursorElement.style.transform = 'translate(-50%, -50%)';
    cursorElement.style.border = '1px solid #000000';
  }
  initializeCursor() {
    if (document.querySelector('#cursor')) {
      this.cursor = document.querySelector('#cursor')!;
    } else {
      this.cursor = document.createElement('div');
      this.webBlackBoard.el.appendChild(this.cursor);
    }
    this.cursor.id = 'cursor';
    this.cursor.style.display = 'none';
    this.cursorStyle(this.cursor);
  }
  hideCursor() {
    if (!this.cursor) return;
    this.cursor.style.display = 'none';
  }
  drawCursor(x: number, y: number) {
    if (!this.cursor) return;
    if (!this.webBlackBoard.el) return;
    if (!this.webBlackBoard.currentBrush) return;
    if (x < 0 || x > this.webBlackBoard.width || y < 0 || y > this.webBlackBoard.height) {
      this.hideCursor();
      return;
    }
    const board = this.webBlackBoard.el
    const mode = this.webBlackBoard.mode
    const currentBrush = this.webBlackBoard.currentBrush
    const brushSize = currentBrush.brushSize;
    const brushRadius = (mode === 'eraser' || mode === 'delete') ? 0 : brushSize / 2;
    this.cursor.style.width = brushSize + 'px';
    this.cursor.style.height = brushSize + 'px';
    this.cursor.style.display = 'block';
    this.cursor.style.top = `${y + board.offsetTop}px`;
    this.cursor.style.left = `${x - board.offsetLeft}px`;
    this.cursor.style.borderRadius = brushRadius + 'px';
  }
}
export default BrushCursor;