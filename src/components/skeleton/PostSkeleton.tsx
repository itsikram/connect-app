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
        <View style={{ paddingHorizontal: 12, paddingTop: 8 }}>
            {Array.from({ length: count }).map((_, idx) => (
                <View key={idx} style={{ backgroundColor: themeColors.surface.primary, borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: themeColors.border.primary }}
                >
                    <SkeletonRow>
                        <SkeletonBlock width={44} height={44} borderRadius={22} />
                        <SkeletonColumn style={{ flex: 1 }}>
                            <SkeletonBlock width={'60%'} height={14} />
                            <SkeletonBlock width={'40%'} height={12} />
                        </SkeletonColumn>
                        <SkeletonBlock width={24} height={24} borderRadius={6} />
                    </SkeletonRow>

                    <SkeletonColumn style={{ marginTop: 12 }}>
                        <SkeletonBlock width={'100%'} height={180} borderRadius={10} />
                    </SkeletonColumn>

                    <SkeletonRow style={{ marginTop: 12 }}>
                        <SkeletonBlock width={'20%'} height={14} />
                        <SkeletonBlock width={'18%'} height={14} />
                        <SkeletonBlock width={'16%'} height={14} />
                    </SkeletonRow>
                </View>
            ))}
        </View>
    );
};

export default PostSkeleton;


