declare module 'react-native-particles' {
  import { Component, ReactNode } from 'react';

  export interface VectorType {
    x: number;
    y: number;
  }

  export interface EmitterProps {
    autoStart?: boolean;
    numberOfParticles: number;
    interval: number;
    fromPosition?: VectorType | (() => VectorType);
    emissionRate: number;
    particleLife: number;
    width?: number;
    height?: number;
    particleContainerStyle?: any;
    children: ReactNode;
    infiniteLoop?: boolean;
    direction: number;
    spread: number;
    speed?: number;
    gravity?: number;
    segments?: number;
  }

  export class Emitter extends Component<EmitterProps> {
    start(): void;
  }

  export class BurstAndMoveEmitter extends Component<any> {}

  export function Vector(x: number, y: number): VectorType;
}

