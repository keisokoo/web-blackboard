import BrushOptions from "../brushes/BrushOptions";
import Eraser from "../brushes/Eraser";
import Pen from "../brushes/Pen";
import { DrawingType } from "../types";

export let currentType: DrawingType = 'pen'
export let currentDrawingOptions = getCurrentOptions(currentType);
const pen = new Pen();
const eraser = new Eraser();
function getCurrentOptions(type: DrawingType = 'pen'): BrushOptions {
  if (type === 'pen') return pen.options;
  if (type === 'eraser') return eraser.options;
  return pen.options;
}
export default getCurrentOptions;