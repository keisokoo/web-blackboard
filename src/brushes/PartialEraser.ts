import BrushOptions from "./BrushOptions";

class PartialEraser {
  options: BrushOptions = {
    brushSize: 10,
    color: '#ffffff'
  };
  constructor(options?: Partial<BrushOptions>) {
    if (options) {
      this.options = Object.assign({}, this.options, options);
    }
  }
}
export default PartialEraser;