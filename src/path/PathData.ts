import Point from "./Point";

type PathData = {
  points: { x: number; y: number }[];
  brushSize: number;
  color: string;
  quadTreePoints: Set<Point>;
};
export default PathData;