import { ShapeConfig } from "konva/lib/Shape";


type ControlAbleBrushType = {
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
}

type BrushType = 'pen' | 'marker' | 'eraser'
interface BrushConfig extends ShapeConfig {
  stroke: string;
  strokeWidth: number;
}
const PenBrushDefaultConfig: BrushConfig = {
  stroke: '#000000',
  strokeWidth: 2,
  globalCompositeOperation: 'source-over',
  lineCap: 'round',
  lineJoin: 'round',
  tension: 0.5
}
const MarkerBrushDefaultConfig: BrushConfig = {
  stroke: '#000000',
  strokeWidth: 4,
  globalCompositeOperation: 'source-over',
  lineCap: 'round',
  lineJoin: 'round',
  tension: 0.5,
  opacity: 0.5
}
const EraserBrushDefaultConfig: BrushConfig = {
  stroke: '#ffffff',
  strokeWidth: 5,
  globalCompositeOperation: 'destination-out',
  lineCap: 'square',
  lineJoin: 'miter',
  hitStrokeWidth: 5
}

class BrushDefault {
  private brushes: {
    pen: ShapeConfig,
    marker: ShapeConfig,
    eraser: ShapeConfig
  } = {
      pen: PenBrushDefaultConfig,
      marker: MarkerBrushDefaultConfig,
      eraser: EraserBrushDefaultConfig
    }
  brushType: BrushType = 'pen'
  currentBrush: { type: BrushType, config: ShapeConfig } = {
    type: this.brushType,
    config: this.brushes[this.brushType]
  }
  constructor(type?: BrushType, config?: ControlAbleBrushType) {
    if (type) {
      this.setBrushType(type)
    }
    if (config) {
      this.setBrushConfig(config)
    }
  }
  setBrushType(type: BrushType) {
    this.brushType = type;
    this.currentBrush = {
      type: this.brushType,
      config: this.brushes[this.brushType]
    }
    return this.currentBrush
  }
  setBrushConfig(config: ControlAbleBrushType) {
    this.brushes[this.brushType] = {
      ...this.brushes[this.brushType],
      ...config
    }
    return this.setBrushType(this.brushType)
  }
  getBrushConfig() {
    return this.currentBrush
  }
}
export default BrushDefault;