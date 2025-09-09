import React from 'react';
import { View } from 'react-native';
import { SkeletonBlock, SkeletonColumn } from './Skeleton';
import { useTheme } from '../../contexts/ThemeContext';

interface FriendCardSkeletonProps {
    count?: number;
}

const FriendCardSkeleton: React.FC<FriendCardSkeletonProps> = ({ count = 6 }) => {
    const { colors: themeColors } = useTheme();

    return (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
            {Array.from({ length: count }).map((_, idx) => (
                <View key={idx} style={{ width: '48%', margin: '1%', padding: 10, backgroundColor: themeColors.surface.primary, borderRadius: 10, borderWidth: 1, borderColor: themeColors.border.primary }}
                >
                    <SkeletonBlock width={64} height={64} borderRadius={32} style={{ alignSelf: 'center', marginBottom: 8 }} />
                    <SkeletonColumn>
                        <SkeletonBlock width={'70%'} height={16} style={{ alignSelf: 'center' }} />
                        <SkeletonBlock width={'100%'} height={36} borderRadius={6} />
                        <SkeletonBlock width={'100%'} height={36} borderRadius={6} />
                    </SkeletonColumn>
                </View>
            ))}
        </View>
    );
};

export default FriendCardSkeleton;


