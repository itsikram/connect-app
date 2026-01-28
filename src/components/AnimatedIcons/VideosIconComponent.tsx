import React from 'react';
import { 
  Svg, 
  Path, 
  Circle,
  Rect 
} from 'react-native-svg';

interface VideosIconProps {
  size?: number;
  color?: string;
}

const VideosIconComponent: React.FC<VideosIconProps> = ({ 
  size = 24, 
  color = '#666'
}) => {
  return (
    <Svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none"
      // Optimize for scaling - better than crispEdges for animations
      shapeRendering="geometricPrecision"
      // Ensure proper scaling
      preserveAspectRatio="xMidYMid meet"
    >
      <Rect 
        x="2" 
        y="4" 
        width="18" 
        height="14" 
        rx="2" 
        fill={color}
        stroke={color}
        strokeWidth={1.5}
      />
      <Path 
        d="M10,8 L16,11 L10,14" 
        fill="white"
      />
      <Circle 
        cx="18" 
        cy="6" 
        r="1" 
        fill="#ff4458"
      />
      <Path 
        d="M20 8h2v2h-2z" 
        fill={color}
        opacity={0.6}
      />
      <Path 
        d="M20 11h2v2h-2z" 
        fill={color}
        opacity={0.6}
      />
    </Svg>
  );
};

export default VideosIconComponent;
