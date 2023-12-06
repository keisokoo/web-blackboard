import Point from "./Point";
import Rectangle from "./Rectangle";

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

  query(range: Rectangle, found: Point[] = []): Promise<Point[]> {
    return new Promise((resolve) => {
      if (!this.boundary.intersects(range)) {
        resolve(found)
        return;
      }

      for (const point of this.points) {
        if (range.contains(point)) {
          found.push(point);
        }
      }

      if (this.divided) {
        const promises = this.children.map(child => child.query(range, found));
        Promise.all(promises).then(() => resolve(found));
      } else {
        resolve(found);
      }
    })
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
export default QuadTreeNode;