interface Drawable {
  draw(bufferContext: CanvasRenderingContext2D): void;
}
class Point {
  constructor(public x: number, public y: number) { }
}
type PathData = {
  points: { x: number; y: number }[];
  brushSize: number;
  color: string;
  quadTreePoints: Set<Point>;
};
class Rectangle {
  constructor(public x: number, public y: number, public width: number, public height: number) { }

  contains(point: Point): boolean {
    return (
      point.x >= this.x &&
      point.x <= this.x + this.width &&
      point.y >= this.y &&
      point.y <= this.y + this.height
    );
  }

  intersects(range: Rectangle): boolean {
    return !(
      range.x > this.x + this.width ||
      range.x + range.width < this.x ||
      range.y > this.y + this.height ||
      range.y + range.height < this.y
    );
  }
}
class QuadTreeNode {
  boundary: Rectangle;
  points: Point[];
  divided: boolean;
  children: QuadTreeNode[];

  constructor(boundary: Rectangle) {
    this.boundary = boundary;
    this.points = [];
    this.divided = false;
    this.children = [];
  }

  insert(point: Point): boolean {
    if (!this.boundary.contains(point)) {
      return false;
    }

    if (this.points.length < 4) {
      this.points.push(point);
      return true;
    }

    if (!this.divided) {
      this.subdivide();
    }

    return (
      this.children[0].insert(point) ||
      this.children[1].insert(point) ||
      this.children[2].insert(point) ||
      this.children[3].insert(point)
    );
  }

  query(range: Rectangle, found: Point[] = []): Point[] {
    if (!this.boundary.intersects(range)) {
      return found;
    }

    for (const point of this.points) {
      if (range.contains(point)) {
        found.push(point);
      }
    }

    if (this.divided) {
      for (const child of this.children) {
        child.query(range, found);
      }
    }

    return found;
  }
  subdivide() {
    const { x, y, width, height } = this.boundary;
    const nw = new Rectangle(x, y, width / 2, height / 2);
    const ne = new Rectangle(x + width / 2, y, width / 2, height / 2);
    const sw = new Rectangle(x, y + height / 2, width / 2, height / 2);
    const se = new Rectangle(x + width / 2, y + height / 2, width / 2, height / 2);

    this.children.push(new QuadTreeNode(nw));
    this.children.push(new QuadTreeNode(ne));
    this.children.push(new QuadTreeNode(sw));
    this.children.push(new QuadTreeNode(se));

    this.divided = true;
  }
  remove(point: Point): boolean {
    if (!this.boundary.contains(point)) {
      return false;
    }

    const index = this.points.findIndex(p => p.x === point.x && p.y === point.y);
    if (index !== -1) {
      this.points.splice(index, 1);
      return true;
    }

    if (this.divided) {
      return (
        this.children[0].remove(point) ||
        this.children[1].remove(point) ||
        this.children[2].remove(point) ||
        this.children[3].remove(point)
      );
    }

    return false;
  }

}

function generateHash() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
type DrawingType = 'pen' | 'eraser';
type PathActionType = 'add' | 'remove';
export type HistoryStack = {
  hash: string;
  pathAction: PathActionType;
}
function createBlackboard(el: HTMLCanvasElement) {

  if (!el || !(el instanceof HTMLCanvasElement)) {
    throw new Error('Canvas element not found');
  }
  const context = el.getContext('2d')
  const bufferCanvas = document.createElement('canvas');
  bufferCanvas.width = el.width;
  bufferCanvas.height = el.height;
  const bufferContext = bufferCanvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas context not found');
  }
  if (!bufferContext) {
    throw new Error('Canvas context not found');
  }
  type PathArrayType = {
    [key: string]: Path;
  }
  let currentType: DrawingType = 'pen'
  let undoStack: HistoryStack[] = [];
  let redoStack: HistoryStack[] = [];
  let pathArray: PathArrayType = {};

  let isDrawing = false;
  let isErasing = false;
  let currentPath: Path | null = null;
  let eraseThreshold = 5;
  let currentBrushSize = 5;
  let currentColor = '#000000';
  let currentMousePosition = { x: 0, y: 0 };


  const canvasBoundary = new Rectangle(0, 0, el.width, el.height);
  const quadTreeRoot = new QuadTreeNode(canvasBoundary);
  function updateMainCanvas() {
    if (!context) return;
    context.clearRect(0, 0, el.width, el.height);
    context.drawImage(bufferCanvas, 0, 0);
    drawCursor(currentMousePosition.x, currentMousePosition.y);
  }
  class Path implements Drawable {
    private points: { x: number; y: number }[] = [];
    public brushSize: number = 1;
    public color: string = 'black';
    public quadTreePoints: Set<Point> = new Set();
    private options: PathData = {
      points: [],
      brushSize: 1,
      color: 'black',
      quadTreePoints: new Set()
    };
    hash: string;
    actionType: PathActionType = 'add';
    constructor(options?: Partial<PathData>) {
      this.hash = generateHash();
      if (options) {
        this.fromData(Object.assign({}, this.options, options));
      }
    }
    setRemove() {
      this.actionType = 'remove';
    }
    toData(): PathData {
      return {
        points: this.points.slice(),
        brushSize: this.brushSize,
        color: this.color,
        quadTreePoints: this.quadTreePoints
      };
    }
    fromData(data: PathData) {
      this.points = data.points.slice();
      this.brushSize = data.brushSize;
      this.color = data.color;
      this.quadTreePoints = data.quadTreePoints;
    }
    insertQuadTree(x: number, y: number) {
      if (this.brushSize === 1) {
        const point = new Point(x, y);
        quadTreeRoot.insert(point);
        this.quadTreePoints.add(point);
        return;
      }
      const radius = this.brushSize / 2;
      const radiusSquared = radius * radius;

      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          if (dx * dx + dy * dy <= radiusSquared) {
            const pointX = x + dx;
            const pointY = y + dy;
            const point = new Point(pointX, pointY);
            quadTreeRoot.insert(point);
            this.quadTreePoints.add(point);
          }
        }
      }
    }
    addPoint(x: number, y: number) {
      this.points.push({ x, y });
      this.insertQuadTree(x, y);
    }

    isNear(x: number, y: number, threshold: number): boolean {
      return this.points.some(point =>
        Math.sqrt((point.x - x) ** 2 + (point.y - y) ** 2) < threshold
      );
    }
    containsPoint(point: Point): boolean {
      return this.points.some(p => p.x === point.x && p.y === point.y);
    }
    containsQuadTreePoint(point: Point): boolean {
      return this.quadTreePoints.has(point);
    }
    draw(bufferContext: CanvasRenderingContext2D): void {
      if (this.points.length === 0) return;
      if (this.actionType !== 'add') return;

      bufferContext.beginPath();
      bufferContext.lineWidth = this.brushSize;
      bufferContext.lineCap = 'round';
      bufferContext.lineJoin = 'round';
      bufferContext.strokeStyle = this.color;
      bufferContext.moveTo(this.points[0].x, this.points[0].y);

      for (const point of this.points) {
        bufferContext.lineTo(point.x, point.y);
      }

      bufferContext.stroke();
      bufferContext.closePath();
      updateMainCanvas()
    }
  }
  function setColor(newColor: string) {
    currentColor = newColor;
  }
  function setDrawingType(type: DrawingType) {
    currentType = type;
  }
  function setEraseThreshold(threshold: number) {
    eraseThreshold = threshold;
  }
  function addPointToPathAndQuadTree(x: number, y: number) {
    if (!currentPath) {
      return;
    }
    currentPath.addPoint(x, y);
  }
  function redrawCanvas() {
    if (!bufferContext || !el) return;
    bufferContext.clearRect(0, 0, el.width, el.height);
    let removedHash: string[] = undoStack.filter(stack => stack.pathAction === 'remove').map(stack => stack.hash)
    let parsedStack: HistoryStack[] = undoStack.filter(stack => !removedHash.includes(stack.hash))
    for (const drawable of parsedStack) {
      if (pathArray[drawable.hash]) pathArray[drawable.hash].draw(bufferContext);
    }
    if (parsedStack.length === 0) {
      updateMainCanvas()
    }
  }
  function undo() {
    if (undoStack.length > 0) {
      const action = undoStack.pop();
      if (action) {
        redoStack.push(action);
        redrawCanvas();
      }
    }
  }
  function redo() {
    if (redoStack.length > 0) {
      const action = redoStack.pop();
      if (action) {
        undoStack.push(action);
        redrawCanvas();
      }
    }
  }
  function setBrushSize(size: number) {
    currentBrushSize = size;
  }
  function erasePaths(pointsToErase: Point[]) {
    const pathsToRemove = new Set<Path>();
    for (const point of pointsToErase) {
      for (const drawable of Object.values(pathArray)) {
        if (drawable instanceof Path && drawable.containsQuadTreePoint(point)) {
          pathsToRemove.add(drawable);
        }
      }
    }
    const erasedPaths = Array.from(pathsToRemove);
    if (erasedPaths.length > 0) {
      for (const path of erasedPaths) {
        for (const point of Array.from(path.quadTreePoints)) {
          quadTreeRoot.remove(point);
        }
        undoStack.push({
          hash: path.hash,
          pathAction: 'remove'
        })
      }
    }
    redrawCanvas();
  }
  function eraseInQuadTree(x: number, y: number, width: number, height: number) {
    const eraseArea = new Rectangle(x, y, width, height);
    const pointsToErase = quadTreeRoot.query(eraseArea);
    erasePaths(pointsToErase);
  }
  bufferContext.clearRect(0, 0, el.width, el.height);
  el.addEventListener('mousedown', (e) => {
    if (currentType === 'eraser') {
      isErasing = true;
      eraseInQuadTree(e.offsetX, e.offsetY, eraseThreshold, eraseThreshold);
    }
    if (currentType === 'pen') {
      isDrawing = true;
      currentPath = new Path();
      currentPath.color = currentColor;
      currentPath.brushSize = currentBrushSize;
      currentPath.addPoint(e.offsetX, e.offsetY);
      currentPath.draw(bufferContext);
    }
    el.addEventListener('mousemove', freeDraw);
  });
  function drawCursor(x: number, y: number) {
    if (!context) return;
    context.beginPath();
    context.arc(x, y, currentBrushSize / 2, 0, Math.PI * 2);
    context.strokeStyle = '#000000';
    context.stroke();
    context.closePath();
  }
  el.addEventListener('mousemove', (e) => {
    currentMousePosition.x = e.offsetX;
    currentMousePosition.y = e.offsetY;
    if (!isDrawing) updateMainCanvas();
  });
  function freeDraw(e: MouseEvent) {
    if (e.buttons !== 1) {
      el.removeEventListener('mousemove', freeDraw);
      return;
    }
    if (!bufferContext || !currentPath) {
      return;
    }
    if (isDrawing) {
      addPointToPathAndQuadTree(e.offsetX, e.offsetY);
      currentPath.draw(bufferContext);
    }
    if (isErasing) {
      eraseInQuadTree(e.offsetX, e.offsetY, eraseThreshold, eraseThreshold);
    }
  }
  el.addEventListener('mouseup', (e) => {
    if (isDrawing && currentPath) {
      undoStack.push({
        hash: currentPath.hash,
        pathAction: 'add'
      });
      pathArray[currentPath.hash] = currentPath;
      isDrawing = false;
    }
    if (isErasing) {
      isErasing = false;
    }
    redoStack = [];
    updateMainCanvas()
    el.removeEventListener('mousemove', freeDraw);
  });
  el.addEventListener('mouseleave', () => {
    el.removeEventListener('mousemove', freeDraw);
  });
  function getUndoStack() {
    return undoStack;
  }
  function getRedoStack() {
    return redoStack;
  }
  return {
    data: {
      color: currentColor,
      brushSize: currentBrushSize,
    },
    getRedoStack,
    getUndoStack,
    setDrawingType,
    setEraseThreshold,
    undo,
    redo,
    setBrushSize,
    setColor,
    clear() {
      if (!bufferContext) {
        return;
      }
      bufferContext.clearRect(0, 0, el.width, el.height);
    },
    toDataURL() {
      return el.toDataURL();
    },
    toBlob(callback: (blob: Blob | null) => void, type?: string, quality?: any) {
      el.toBlob(callback, type, quality);
    },
    resize(width: number, height: number) {
      el.width = width;
      el.height = height;
    },
    setWidth(width: number) {
      el.width = width;
    },
    setHeight(height: number) {
      el.height = height;
    }
  };
};
export default createBlackboard;