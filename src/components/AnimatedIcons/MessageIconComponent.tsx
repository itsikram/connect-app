import React from 'react';
import { 
  Svg, 
  Path, 
  Circle 
} from 'react-native-svg';

interface MessageIconProps {
  size?: number;
  color?: string;
}

const MessageIconComponent: React.FC<MessageIconProps> = ({ 
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
      <Path 
        d="M3 8C3 6.34315 4.34315 5 6 5H18C19.6569 5 21 6.34315 21 8V14C21 15.6569 19.6569 17 18 17H7L3 21V8Z" 
        fill={color}
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <Circle 
        cx="8" 
        cy="11" 
        r="1" 
        fill="white"
      />
      <Circle 
        cx="12" 
        cy="11" 
        r="1" 
        fill="white"
      />
      <Circle 
        cx="16" 
        cy="11" 
        r="1" 
        fill="white"
      />
      <Path 
        d="M19 3h2v2h-2z" 
        fill="#ff4458"
      />
    </Svg>
  );
};

export default MessageIconComponent;
