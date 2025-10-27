declare module '@tensorflow-models/facemesh' {
  export interface FaceMeshLoadOptions {
    maxFaces?: number;
    refineLandmarks?: boolean;
  }
  export interface FaceMeshPrediction {
    scaledMesh?: Array<[number, number, number?]> | number[][];
    mesh?: Array<[number, number, number?]> | number[][];
    boundingBox?: {
      topLeft: number[] | { arraySync: () => number[] };
      bottomRight: number[] | { arraySync: () => number[] };
    };
  }
  export interface FaceMeshModel {
    estimateFaces(input: { input: any } | any): Promise<FaceMeshPrediction[]>;
  }
  export function load(options?: FaceMeshLoadOptions): Promise<FaceMeshModel>;
}

// Global helpers
declare const globalThis: any;

declare module 'jpeg-js' {
  export interface DecodeOptions {
    useTArray?: boolean;
  }
  export interface DecodedJpeg {
    width: number;
    height: number;
    data: Uint8Array; // RGBA
  }
  export function decode(buffer: Uint8Array | ArrayBuffer | Buffer, options?: DecodeOptions): DecodedJpeg;
}


