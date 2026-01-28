import React from 'react';
import { 
  Svg, 
  Path, 
  Circle 
} from 'react-native-svg';

interface FriendsIconProps {
  size?: number;
  color?: string;
}

const FriendsIconComponent: React.FC<FriendsIconProps> = ({ 
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
      {/* Person 1 - Left */}
      <Circle
        cx="8"
        cy="7"
        r="3"
        fill={color}
      />
      <Path
        d="M8 12c-2.21 0-4 1.79-4 4v2h8v-2c0-2.21-1.79-4-4-4z"
        fill={color}
      />
      
      {/* Person 2 - Right */}
      <Circle
        cx="16"
        cy="7"
        r="3"
        fill={color}
        opacity={0.8}
      />
      <Path
        d="M16 12c-2.21 0-4 1.79-4 4v2h8v-2c0-2.21-1.79-4-4-4z"
        fill={color}
        opacity={0.8}
      />
      
      {/* Connection heart */}
      <Path
        d="M12 9.5c0-0.5.5-1 1-1s1 .5 1 1-.5 1-1 1-1-.5-1-1z"
        fill="#ff4458"
        transform="scale(0.8) translate(3, 2)"
      />
    </Svg>
  );
};

export default FriendsIconComponent;
