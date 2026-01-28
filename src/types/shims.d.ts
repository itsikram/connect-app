// Global helpers
declare global {
  var globalThis: any;
}

export {};

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


