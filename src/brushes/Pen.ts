import BrushOptions from "./BrushOptions";

class Pen {
  options: BrushOptions = {
    brushSize: 3,
    color: '#000000'
  };
  constructor(options?: Partial<BrushOptions>) {
    if (options) {
      this.options = Object.assign({}, this.options, options);
    }
  }
}
export default Pen;