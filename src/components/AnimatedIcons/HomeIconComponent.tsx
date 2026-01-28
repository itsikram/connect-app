import React from 'react';
import { 
  Svg, 
  Path, 
  Circle 
} from 'react-native-svg';

interface HomeIconProps {
  size?: number;
  color?: string;
}

const HomeIconComponent: React.FC<HomeIconProps> = ({ 
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
      {/* Roof */}
      <Path
        d="M12 3L2 12h3v8h14v-8h3L12 3z"
        fill={color}
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Door */}
      <Path
        d="M9 22V12h6v10"
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Door handle */}
      <Circle
        cx="13.5"
        cy="16.5"
        r="0.5"
        fill={color}
      />
      {/* Windows */}
      <Circle cx="7" cy="9" r="1" fill="white" />
      <Circle cx="17" cy="9" r="1" fill="white" />
    </Svg>
  );
};

export default HomeIconComponent;
