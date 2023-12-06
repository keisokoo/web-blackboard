import Point from "./path/Point";
import Rectangle from "./path/Rectangle";
import QuadTreeNode from "./path/QuadTreeNode";
import BrushOptions from "./brushes/BrushOptions";
import Eraser from "./brushes/Eraser";
import Pen from "./brushes/Pen";
import { DrawingType, HistoryStack, PathActionType } from "./types";
import Path from "./path/Path";
import PathArrayType from "./path/PathArrayType";

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
  let currentType: DrawingType = 'pen'
  let undoStack: HistoryStack[] = [];
  let redoStack: HistoryStack[] = [];
  let pathArray: PathArrayType = {};
  function getCurrentOptions(type: DrawingType = 'pen'): BrushOptions {
    if (type === 'pen') return pen.options;
    if (type === 'eraser') return eraser.options;
    return pen.options;
  }
  let isDrawing = false;
  let isErasing = false;
  let pen = new Pen();
  let eraser = new Eraser();
  let currentPath: Path | null = null;
  let currentDrawingOptions = getCurrentOptions(currentType);

  let currentMousePosition = { x: 0, y: 0 };
  let isQueryInProgress = false;

  let lastX: number, lastY: number;

  const canvasBoundary = new Rectangle(0, 0, el.width, el.height);
  let quadTreeRoot = new QuadTreeNode(canvasBoundary);

  function updateMainCanvas() {
    if (!context) return;
    context.clearRect(0, 0, el.width, el.height);
    context.drawImage(bufferCanvas, 0, 0);
    drawCursor(currentMousePosition.x, currentMousePosition.y);
  }
  function drawQuadTreePoints(node?: QuadTreeNode) {
    node = node || quadTreeRoot;
    if (!context) return;

    node.points.forEach(point => {
      context.fillStyle = 'red';
      context.globalAlpha = 0.5;
      context.beginPath();
      context.arc(point.x, point.y, 0.5, 0, Math.PI * 2);
      context.fill();
    });
    context.globalAlpha = 1;

    if (node.divided) {
      node.children.forEach(child => drawQuadTreePoints(child));
    }
  }
  function drawQuadTreeBoundary(node?: QuadTreeNode) {
    node = node || quadTreeRoot;
    if (!context) return;

    context.strokeStyle = 'blue';
    context.beginPath();
    context.rect(node.boundary.x, node.boundary.y, node.boundary.width, node.boundary.height);
    context.stroke();

    if (node.divided) {
      node.children.forEach(child => drawQuadTreeBoundary(child));
    }
  }
  function drawQuadTreePointsInPaths() {
    if (!context) return;
    for (const path of Object.values(pathArray)) {
      if (path instanceof Path) {
        for (const point of Array.from(path.quadTreePoints.values())) {
          context.fillStyle = 'red';
          context.globalAlpha = 0.5;
          context.beginPath();
          context.arc(point.x, point.y, 0.5, 0, Math.PI * 2);
          context.fill();
        }
      }
    }
    context.globalAlpha = 1;
  }
  function setColor(newColor: string) {
    currentDrawingOptions.color = newColor;
  }
  function setDrawingType(type: DrawingType) {
    currentType = type;
    currentDrawingOptions = getCurrentOptions(type);
  }
  function setEraseThreshold(threshold: number) {
    currentDrawingOptions.brushSize = threshold;
  }
  function addPointToQuadTree(path: Path, x: number, y: number, lastX: number, lastY: number) {
    const distance = Math.sqrt((x - lastX) ** 2 + (y - lastY) ** 2);
    const steps = Math.ceil(distance / 2);

    for (let i = 0; i <= steps; i++) {
      const interpolatedX = lastX + (x - lastX) * (i / steps);
      const interpolatedY = lastY + (y - lastY) * (i / steps);
      path.insertQuadTree(interpolatedX, interpolatedY);
    }
    path.addPoint(x, y)
  }

  function redrawCanvas() {
    if (!bufferContext || !el) return;
    bufferContext.clearRect(0, 0, el.width, el.height);
    let removedHash: string[] = undoStack.filter(stack => stack.pathAction === 'remove').map(stack => stack.hash)
    let parsedStack: HistoryStack[] = undoStack.filter(stack => !removedHash.includes(stack.hash))
    for (const drawable of parsedStack) {
      if (pathArray[drawable.hash]) pathArray[drawable.hash].draw(bufferContext, updateMainCanvas);
    }
    rebuildQuadTree(parsedStack)
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
    currentDrawingOptions.brushSize = size;
  }
  function rebuildQuadTree(parsedStack: HistoryStack[]) {
    quadTreeRoot = new QuadTreeNode(canvasBoundary);

    for (const parsed of parsedStack) {
      const path = pathArray[parsed.hash]
      if (path instanceof Path) {
        for (const point of Array.from(path.quadTreePoints.values())) {
          quadTreeRoot.insert(point);
        }
      }
    }
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
  async function eraseInQuadTree(x: number, y: number, width: number, height: number) {
    const halfSize = width / 2;
    const eraseArea = new Rectangle(x - halfSize, y - halfSize, width, height);
    isQueryInProgress = true;
    const pointsToErase = await quadTreeRoot.query(eraseArea);
    isQueryInProgress = false;
    erasePaths(pointsToErase);
  }
  bufferContext.clearRect(0, 0, el.width, el.height);
  el.addEventListener('mousedown', async (e) => {
    if (currentType === 'eraser' && !isQueryInProgress) {
      isErasing = true;
      await eraseInQuadTree(e.offsetX, e.offsetY, currentDrawingOptions.brushSize, currentDrawingOptions.brushSize);
    }
    if (currentType === 'pen') {
      isDrawing = true;
      lastX = e.offsetX;
      lastY = e.offsetY;
      currentPath = new Path(el, quadTreeRoot);
      currentPath.setUpdateOptions(currentDrawingOptions);
      currentPath.addPoint(e.offsetX, e.offsetY);
      currentPath.insertQuadTree(e.offsetX, e.offsetY);
      currentPath.draw(bufferContext, updateMainCanvas);
    }
    el.addEventListener('mousemove', updateWithMouseMovement);
  });
  function drawCursor(x: number, y: number) {
    if (!context) return;
    const brushSize = currentDrawingOptions.brushSize;
    context.beginPath();
    if (currentType === 'eraser') {
      context.rect(x - brushSize / 2, y - brushSize / 2, brushSize, brushSize);
    } else {
      context.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    }
    context.strokeStyle = '#000000';
    context.stroke();
    context.closePath();
  }
  el.addEventListener('mousemove', (e) => {
    currentMousePosition.x = e.offsetX;
    currentMousePosition.y = e.offsetY;
    if (!isDrawing) updateMainCanvas();
  });
  let offsetX = 0;
  let offsetY = 0;
  function updateWithMouseMovement(e: MouseEvent) {
    if (e.buttons !== 1) {
      el.removeEventListener('mousemove', updateWithMouseMovement);
      return;
    }
    offsetX = e.offsetX;
    offsetY = e.offsetY;
    requestAnimationFrame(freeDraw);
  }
  async function freeDraw() {
    if (!bufferContext || !currentPath) {
      return;
    }
    if (isDrawing) {
      addPointToQuadTree(currentPath, offsetX, offsetY, lastX, lastY)
      lastX = offsetX;
      lastY = offsetY;
      currentPath.draw(bufferContext, updateMainCanvas);
    }
    if (isErasing) {
      await eraseInQuadTree(offsetX, offsetY, currentDrawingOptions.brushSize, currentDrawingOptions.brushSize);
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
    el.removeEventListener('mousemove', updateWithMouseMovement);
  });
  el.addEventListener('mouseleave', () => {
    el.removeEventListener('mousemove', updateWithMouseMovement);
  });
  function getUndoStack() {
    return undoStack;
  }
  function getRedoStack() {
    return redoStack;
  }
  return {
    data: currentDrawingOptions,
    drawQuadTreePointsInPaths,
    drawQuadTreeBoundary,
    drawQuadTreePoints,
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