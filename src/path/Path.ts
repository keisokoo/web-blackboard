import generateHash from "../helper/generateHash";
import { PathActionType } from "../types";
import PathData from "./PathData";
import Point from "./Point";
import QuadTreeNode from "./QuadTreeNode";
import Rectangle from "./Rectangle";

class Path {
  private points: Point[] = [];
  public quadTreePoints: Set<Point> = new Set();
  private options: PathData = {
    points: [],
    brushSize: 1,
    color: '#000000',
    quadTreePoints: new Set()
  };
  hash: string;
  actionType: PathActionType = 'add';
  originalHash: string = ''; // actionType이 edited일때, Path의 원본 hash
  private quadTreeRoot: QuadTreeNode;
  private el: HTMLCanvasElement;
  constructor(el: HTMLCanvasElement, quadTreeRoot: QuadTreeNode, options?: Partial<PathData>) {
    this.el = el;
    this.quadTreeRoot = quadTreeRoot;
    this.hash = generateHash();
    if (options) {
      this.fromData(Object.assign({}, this.options, options));
    }
  }
  setUpdateOptions(options: Partial<PathData>) {
    this.options = Object.assign({}, this.options, options);
  }
  setRemove() {
    this.actionType = 'remove';
  }
  clearQuadTreePoints() {
    this.quadTreePoints.clear();
  }
  getPoints() {
    return this.points;
  }
  setEdited() {
    this.actionType = 'edited';
  }
  // setEdited(originalHash: string) {
  //   this.actionType = 'edited';
  //   this.originalHash = originalHash;
  //   this.hash = generateHash();
  //   return this.hash;
  // }
  toData(): PathData {
    return {
      points: this.points.slice(),
      brushSize: this.options.brushSize,
      color: this.options.color,
      quadTreePoints: this.quadTreePoints
    };
  }
  fromData(data: PathData) {
    this.points = data.points.slice();
    this.options.brushSize = data.brushSize;
    this.options.color = data.color;
    this.quadTreePoints = data.quadTreePoints;
  }
  insertQuadTree(x: number, y: number) {
    if (x < 0 || x > this.el.width || y < 0 || y > this.el.height) {
      return;
    }
    if (this.options.brushSize === 1) {
      const point = new Point(x, y);
      this.quadTreeRoot.insert(point);
      this.quadTreePoints.add(point);
      return;
    }
    const radius = this.options.brushSize / 2;
    const radiusSquared = radius * radius;
    const step = Math.max(1, Math.ceil(radius / 3));

    for (let dx = -radius; dx <= radius; dx += step) {
      for (let dy = -radius; dy <= radius; dy += step) {
        if (dx * dx + dy * dy <= radiusSquared) {
          const pointX = x + dx;
          const pointY = y + dy;
          const point = new Point(pointX, pointY);
          this.quadTreeRoot.insert(point);
          this.quadTreePoints.add(point);
        }
      }
    }
  }
  addPoint(x: number, y: number) {
    this.points.push({ x, y });
  }
  removePointsInArea(eraseArea: Rectangle) {
    const erasedArea = this.points.filter(point => {
      return eraseArea.contains(point)
    });
    this.points = this.points.filter(point => {
      return !eraseArea.contains(point)
    });
    console.log('erasedArea', erasedArea)
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
  draw(bufferContext: CanvasRenderingContext2D, callback: () => void): void {
    if (this.points.length === 0) return;
    if (this.actionType === 'remove') return;
    if (this.actionType === 'edited') {
      bufferContext.globalCompositeOperation = 'destination-out';
      bufferContext.lineCap = 'square';
      bufferContext.lineJoin = 'bevel';
    } else if (this.actionType === 'add') {
      bufferContext.globalCompositeOperation = 'source-over';
      bufferContext.lineCap = 'round';
      bufferContext.lineJoin = 'round';
    }
    bufferContext.beginPath();
    bufferContext.lineWidth = this.options.brushSize;
    bufferContext.strokeStyle = this.options.color;
    bufferContext.moveTo(this.points[0].x, this.points[0].y);

    for (const point of this.points) {
      bufferContext.lineTo(point.x, point.y);
    }

    bufferContext.stroke();
    bufferContext.closePath();
    callback()
  }
}
export default Path;