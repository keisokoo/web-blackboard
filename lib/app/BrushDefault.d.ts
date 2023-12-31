import { ShapeConfig } from "konva/lib/Shape";
type ControlAbleBrushType = {
    stroke?: string;
    strokeWidth?: number;
    opacity?: number;
};
type BrushType = 'pen' | 'marker' | 'eraser';
declare class BrushDefault {
    private brushes;
    brushType: BrushType;
    currentBrush: {
        type: BrushType;
        config: ShapeConfig;
    };
    constructor(type?: BrushType, config?: ControlAbleBrushType);
    setBrushType(type: BrushType): {
        type: BrushType;
        config: ShapeConfig;
    };
    setBrushConfig(config: ControlAbleBrushType): {
        type: BrushType;
        config: ShapeConfig;
    };
    getBrushConfig(): {
        type: BrushType;
        config: ShapeConfig;
    };
}
export default BrushDefault;
