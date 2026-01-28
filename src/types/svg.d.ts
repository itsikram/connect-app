declare module '*.svg' {
  import React from 'react';
  import { SvgProps } from 'react-native-svg';
  const content: React.FC<SvgProps>;
  export default content;
}

declare module 'react-native-svg' {
  import React from 'react';
  
  export interface SvgProps {
    width?: number | string;
    height?: number | string;
    fill?: string;
    stroke?: string;
    strokeWidth?: string | number;
    [key: string]: any;
  }

  export const Svg: React.FC<SvgProps>;
  export const Rect: React.FC<SvgProps>;
  export const Circle: React.FC<SvgProps>;
  export const Path: React.FC<SvgProps>;
  export const G: React.FC<SvgProps>;
  export const Defs: React.FC<SvgProps>;
  export const LinearGradient: React.FC<SvgProps>;
  export const Stop: React.FC<SvgProps>;
  export const Text: React.FC<SvgProps>;
}










