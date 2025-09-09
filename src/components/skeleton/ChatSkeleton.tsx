import React from 'react';
import { View } from 'react-native';
import { SkeletonBlock, SkeletonRow, SkeletonColumn } from './Skeleton';
import { useTheme } from '../../contexts/ThemeContext';

export const ChatHeaderSkeleton: React.FC = () => {
    const { colors: themeColors } = useTheme();
    return (
        <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 8,
            backgroundColor: themeColors.surface.header,
            borderBottomWidth: 1,
            borderBottomColor: themeColors.border.primary,
        }}>
            <SkeletonBlock width={22} height={22} borderRadius={11} style={{ marginRight: 8 }} />
            <SkeletonRow style={{ flex: 1, alignItems: 'center' }}>
                <SkeletonBlock width={35} height={35} borderRadius={18} />
                <SkeletonColumn style={{ marginLeft: 10, flex: 1 }}>
                    <SkeletonBlock width={'40%'} height={14} />
                    <SkeletonBlock width={'25%'} height={12} />
                </SkeletonColumn>
            </SkeletonRow>
            <SkeletonRow>
                <SkeletonBlock width={35} height={35} borderRadius={18} style={{ marginLeft: 6 }} />
                <SkeletonBlock width={35} height={35} borderRadius={18} style={{ marginLeft: 6 }} />
                <SkeletonBlock width={35} height={35} borderRadius={18} style={{ marginLeft: 6 }} />
            </SkeletonRow>
        </View>
    );
};

export const ChatBubblesSkeleton: React.FC<{ count?: number }> = ({ count = 10 }) => {
    const widths = ['35%', '60%', '50%', '70%', '40%', '55%', '65%', '45%', '58%', '62%'];
    return (
        <View style={{ flex: 1 }}>
            {Array.from({ length: count }).map((_, idx) => {
                const isLeft = idx % 2 === 0;
                const width = widths[idx % widths.length];
                return (
                    <View key={idx} style={{
                        paddingHorizontal: 16,
                        paddingVertical: 6,
                        flexDirection: 'row',
                        justifyContent: isLeft ? 'flex-start' : 'flex-end'
                    }}>
                        <SkeletonBlock
                            width={width}
                            height={34}
                            borderRadius={18}
                            style={{
                                borderBottomLeftRadius: isLeft ? 4 : 18,
                                borderBottomRightRadius: isLeft ? 18 : 4,
                            }}
                        />
                    </View>
                );
            })}
        </View>
    );
};


