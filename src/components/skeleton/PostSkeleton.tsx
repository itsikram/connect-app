import React from 'react';
import { View } from 'react-native';
import { SkeletonBlock, SkeletonRow, SkeletonColumn } from './Skeleton';
import { useTheme } from '../../contexts/ThemeContext';

interface PostSkeletonProps {
    count?: number;
}

const PostSkeleton: React.FC<PostSkeletonProps> = ({ count = 3 }) => {
    const { colors: themeColors } = useTheme();

    return (
        <View>
            {Array.from({ length: count }).map((_, idx) => (
                <View
                    key={idx}
                    style={{
                        backgroundColor: themeColors.surface.primary,
                        borderRadius: 12,
                        marginHorizontal: 10,
                        marginBottom: 10,
                        borderWidth: 1,
                        borderColor: themeColors.border.primary,
                        overflow: 'hidden',
                    }}
                >
                    <View style={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8 }}>
                        <SkeletonRow>
                            <SkeletonBlock width={42} height={42} borderRadius={21} />
                            <SkeletonColumn style={{ flex: 1, marginLeft: 10 }}>
                                <SkeletonBlock width={'55%'} height={14} />
                                <SkeletonBlock width={'30%'} height={10} />
                            </SkeletonColumn>
                            <SkeletonBlock width={34} height={34} borderRadius={17} />
                            <SkeletonBlock width={34} height={34} borderRadius={17} />
                        </SkeletonRow>
                    </View>

                    <SkeletonColumn style={{ paddingHorizontal: 14, marginBottom: 12 }}>
                        <SkeletonBlock width={'92%'} height={12} />
                        <SkeletonBlock width={'70%'} height={12} />
                    </SkeletonColumn>

                    <SkeletonBlock width={'100%'} height={idx % 2 === 0 ? 280 : 200} borderRadius={0} />

                    <View style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
                        <SkeletonRow style={{ justifyContent: 'space-between', marginBottom: 12 }}>
                            <SkeletonBlock width={'40%'} height={12} />
                            <SkeletonBlock width={'28%'} height={12} />
                        </SkeletonRow>
                        <SkeletonRow style={{ justifyContent: 'space-between' }}>
                            <SkeletonBlock width={'28%'} height={18} />
                            <SkeletonBlock width={'28%'} height={18} />
                            <SkeletonBlock width={'28%'} height={18} />
                        </SkeletonRow>
                    </View>
                </View>
            ))}
        </View>
    );
};

export default PostSkeleton;
