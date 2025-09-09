import React from 'react';
import { View } from 'react-native';
import { SkeletonBlock, SkeletonRow, SkeletonColumn } from './Skeleton';
import { useTheme } from '../../contexts/ThemeContext';

interface ListItemSkeletonProps {
    count?: number;
}

const ListItemSkeleton: React.FC<ListItemSkeletonProps> = ({ count = 6 }) => {
    const { colors: themeColors } = useTheme();

    return (
        <View>
            {Array.from({ length: count }).map((_, idx) => (
                <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: themeColors.border.secondary }}
                >
                    <SkeletonBlock width={40} height={40} borderRadius={20} />
                    <SkeletonColumn style={{ marginLeft: 10, flex: 1 }}>
                        <SkeletonBlock width={'50%'} height={14} />
                        <SkeletonRow>
                            <SkeletonBlock width={'30%'} height={12} />
                            <SkeletonBlock width={40} height={12} />
                        </SkeletonRow>
                    </SkeletonColumn>
                </View>
            ))}
        </View>
    );
};

export default ListItemSkeleton;


