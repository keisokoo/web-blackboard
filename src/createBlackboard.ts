type Blackboard = {
  width: number;
  height: number;
};
interface Drawable {
  draw(context: CanvasRenderingContext2D): void;
}
class Point {
  constructor(public x: number, public y: number) { }
}
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

}
const drawAbles: Drawable[] = [];

class Path implements Drawable {
  private points: { x: number; y: number }[] = [];

  addPoint(x: number, y: number) {
    this.points.push({ x, y });
  }

  isNear(x: number, y: number, threshold: number): boolean {
    return this.points.some(point =>
      Math.sqrt((point.x - x) ** 2 + (point.y - y) ** 2) < threshold
    );
  }
  containsPoint(point: Point): boolean {
    return this.points.some(p => p.x === point.x && p.y === point.y);
  }
  draw(context: CanvasRenderingContext2D): void {
    if (this.points.length === 0) return;

    context.beginPath();
    context.moveTo(this.points[0].x, this.points[0].y);

    for (const point of this.points) {
      context.lineTo(point.x, point.y);
    }

    context.stroke();
  }
}
type DrawingType = 'pen' | 'eraser';

function createBlackboard(el: HTMLCanvasElement, options?: Partial<Blackboard>) {

  if (!el || !(el instanceof HTMLCanvasElement)) {
    throw new Error('Canvas element not found');
  }
  const context = el.getContext('2d')
  if (!context) {
    throw new Error('Canvas context not found');
  }
  let currentType: DrawingType = 'pen'
  let undoStack: Drawable[] = [];
  let redoStack: Drawable[] = [];

  let isDrawing = false;
  let isErasing = false;
  let currentPath: Path | null = null;
  let eraseThreshold = 10;
  const canvasBoundary = new Rectangle(0, 0, el.width, el.height);
  const quadTreeRoot = new QuadTreeNode(canvasBoundary);

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
    const point = new Point(x, y);
    currentPath.addPoint(point.x, point.y);
    quadTreeRoot.insert(point);
  }
  function redrawCanvas() {
    if (!context || !el) return;
    context.clearRect(0, 0, el.width, el.height);
    for (const drawable of undoStack) {
      drawable.draw(context);
    }
  }
  function undo() {
    if (undoStack.length > 0) {
      const drawable = undoStack.pop();
      if (drawable) {
        redoStack.push(drawable);
        redrawCanvas();
      }
    }
  }
  function redo() {
    if (redoStack.length > 0) {
      const drawable = redoStack.pop();
      if (drawable) {
        undoStack.push(drawable);
        redrawCanvas();
      }
    }
  }
  // function eraseAt(x: number, y: number) {
  //   for (let i = 0; i < undoStack.length; i++) {
  //     const drawable = undoStack[i];
  //     if (drawable instanceof Path && drawable.isNear(x, y, eraseThreshold)) {
  //       undoStack.splice(i, 1);
  //       i--;
  //     }
  //   }
  //   redrawCanvas();
  // }
  function erasePaths(pointsToErase: Point[]) {
    const pathsToRemove = new Set<Path>();

    for (const point of pointsToErase) {
      for (const drawable of undoStack) {
        if (drawable instanceof Path && drawable.containsPoint(point)) {
          pathsToRemove.add(drawable);
        }
      }
    }

    undoStack = undoStack.filter(drawable => !(drawable instanceof Path && pathsToRemove.has(drawable)));
    redrawCanvas();
  }
  function eraseInQuadTree(x: number, y: number, width: number, height: number) {
    const eraseArea = new Rectangle(x, y, width, height);
    const pointsToErase = quadTreeRoot.query(eraseArea);
    erasePaths(pointsToErase);
  }
  context.clearRect(0, 0, el.width, el.height);
  el.addEventListener('mousedown', (e) => {
    if (currentType === 'eraser') {
      eraseInQuadTree(e.offsetX, e.offsetY, eraseThreshold, eraseThreshold);
      isErasing = true;
    }
    if (currentType === 'pen') {
      isDrawing = true;
      currentPath = new Path();
      currentPath.addPoint(e.offsetX, e.offsetY);
      addPointToPathAndQuadTree(e.offsetX, e.offsetY);
      redrawCanvas();
    }
    el.addEventListener('mousemove', draw);
  });
  function draw(e: MouseEvent) {
    if (e.buttons !== 1) {
      el.removeEventListener('mousemove', draw);
      return;
    }
    if (!context || !currentPath) {
      return;
    }
    if (isDrawing) {
      currentPath.addPoint(e.offsetX, e.offsetY);
      addPointToPathAndQuadTree(e.offsetX, e.offsetY);
      currentPath.draw(context);
    }
    if (isErasing) {
      console.log('isErasing', isErasing)
      eraseInQuadTree(e.offsetX, e.offsetY, eraseThreshold, eraseThreshold);
    }
  }
  el.addEventListener('mouseup', (e) => {
    if (isDrawing && currentPath) {
      undoStack.push(currentPath);
      isDrawing = false;
    }
    if (isErasing) {
      isErasing = false;
    }
    el.removeEventListener('mousemove', draw);
  });
  el.addEventListener('mouseleave', () => {
    el.removeEventListener('mousemove', draw);
  });
  // el.addEventListener('touchstart', (e) => {
  //   context.beginPath();
  //   context.moveTo(e.touches[0].clientX, e.touches[0].clientY);
  //   el.addEventListener('touchmove', drawTouch);
  // }
  // );
  // function drawTouch(e: TouchEvent) {
  //   if (!context) {
  //     return;
  //   }
  //   context.lineTo(e.touches[0].clientX, e.touches[0].clientY);
  //   context.stroke();
  // }
  // el.addEventListener('touchend', () => {
  //   el.removeEventListener('touchmove', drawTouch);
  // });
  // el.addEventListener('touchcancel', () => {
  //   el.removeEventListener('touchmove', drawTouch);
  // });
  // el.addEventListener('touchleave', () => {
  //   el.removeEventListener('touchmove', drawTouch);
  // }
  // );
  // el.addEventListener('pointerdown', (e) => {
  //   context.beginPath();
  //   context.moveTo(e.offsetX, e.offsetY);
  //   el.addEventListener('pointermove', drawPointer);
  // }
  // );
  // function drawPointer(e: PointerEvent) {
  //   if (!context) {
  //     return;
  //   }
  //   context.lineTo(e.offsetX, e.offsetY);
  //   context.stroke();
  // }
  // el.addEventListener('pointerup', () => {
  //   el.removeEventListener('pointermove', drawPointer);
  // });
  // el.addEventListener('pointerleave', () => {
  //   el.removeEventListener('pointermove', drawPointer);
  // });
  // el.addEventListener('pointerout', () => {
  //   el.removeEventListener('pointermove', drawPointer);
  // });
  // el.addEventListener('pointerover', () => {
  //   el.removeEventListener('pointermove', drawPointer);
  // });
  // el.addEventListener('pointercancel', () => {
  //   el.removeEventListener('pointermove', drawPointer);
  // });
  // el.addEventListener('dblclick', () => {
  //   context.clearRect(0, 0, el.width, el.height);
  // });
  return {
    setDrawingType,
    setEraseThreshold,
    undo,
    redo,
    clear() {
      if (!context) {
        return;
      }
      context.clearRect(0, 0, el.width, el.height);
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
    },
    setOptions(options: Partial<Blackboard>) {
      if (options.width) {
        el.width = options.width;
      }
      if (options.height) {
        el.height = options.height;
      }
    }
  };
};
export default createBlackboard;