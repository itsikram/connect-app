import React from 'react';
import { 
  Svg, 
  Path, 
  Circle,
  Rect 
} from 'react-native-svg';

interface MenuIconProps {
  size?: number;
  color?: string;
}

const MenuIconComponent: React.FC<MenuIconProps> = ({ 
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
      <Circle 
        cx="12" 
        cy="12" 
        r="10" 
        fill={color}
        stroke={color}
        strokeWidth={1.5}
      />
      <Rect 
        x="7" 
        y="8" 
        width="10" 
        height="1.5" 
        rx="0.75" 
        fill="white"
      />
      <Rect 
        x="7" 
        y="11.25" 
        width="10" 
        height="1.5" 
        rx="0.75" 
        fill="white"
      />
      <Rect 
        x="7" 
        y="14.5" 
        width="10" 
        height="1.5" 
        rx="0.75" 
        fill="white"
      />
      <Circle 
        cx="18" 
        cy="6" 
        r="2" 
        fill="#ff4458"
      />
      <Path 
        d="M17 5h2v2h-2z" 
        fill="white"
      />
    </Svg>
  );
};

export default MenuIconComponent;
