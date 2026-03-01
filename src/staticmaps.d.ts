declare module "staticmaps" {
  interface StaticMapsOptions {
    width: number;
    height: number;
    tileUrl?: string;
    tileSubdomains?: string[];
    tileRequestHeader?: Record<string, string>;
    tileRequestTimeout?: number;
    tileRequestLimit?: number;
    tileSize?: number;
    reverseY?: boolean;
    zoomRange?: { min?: number; max?: number };
    maxZoom?: number;
    paddingX?: number;
    paddingY?: number;
  }

  interface MarkerOptions {
    coord: [number, number];
    img: string;
    height: number;
    width: number;
    drawWidth?: number;
    drawHeight?: number;
    resizeMode?: string;
    offsetX?: number;
    offsetY?: number;
  }

  interface CircleOptions {
    coord: [number, number];
    radius: number;
    color?: string;
    fill?: string;
    width?: number;
  }

  interface ImageOutput {
    buffer(mime: string): Promise<Buffer>;
  }

  class StaticMaps {
    image: ImageOutput;
    constructor(options?: StaticMapsOptions);
    addMarker(options: MarkerOptions): void;
    addCircle(options: CircleOptions): void;
    render(center?: [number, number], zoom?: number): Promise<void>;
  }

  export default StaticMaps;
}
