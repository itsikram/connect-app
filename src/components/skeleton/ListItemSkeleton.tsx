import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SkeletonBlock, SkeletonRow, SkeletonColumn } from './Skeleton';
import { useTheme } from '../../contexts/ThemeContext';

interface ListItemSkeletonProps {
    count?: number;
}

const ListItemSkeleton: React.FC<ListItemSkeletonProps> = ({ count = 6 }) => {
    const { colors: themeColors } = useTheme();

    return (
        <View style={styles.list}>
            {Array.from({ length: count }).map((_, idx) => (
                <View key={idx} style={[styles.item, { backgroundColor: themeColors.surface.primary, borderColor: themeColors.border.secondary }]}
                >
                    <View>
                        <SkeletonBlock width={48} height={48} borderRadius={24} />
                        {idx % 3 === 0 ? <SkeletonBlock width={12} height={12} borderRadius={6} style={[styles.online, { backgroundColor: themeColors.status.success, borderColor: themeColors.surface.primary }]} /> : null}
                    </View>
                    <SkeletonColumn style={styles.content} spacing={7}>
                        <SkeletonRow style={styles.titleRow} spacing={8}>
                            <SkeletonBlock width={idx % 2 === 0 ? '52%' : '42%'} height={14} borderRadius={999} />
                            <SkeletonBlock width={44} height={10} borderRadius={999} />
                        </SkeletonRow>
                        <SkeletonRow spacing={8}>
                            <SkeletonBlock width={idx % 3 === 1 ? '68%' : '78%'} height={11} borderRadius={999} />
                            <SkeletonBlock width={28} height={11} borderRadius={999} />
                        </SkeletonRow>
                    </SkeletonColumn>
                </View>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    list: { paddingHorizontal: 12, paddingBottom: 16 },
    item: {
        minHeight: 72,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 11,
        marginBottom: 8,
        borderRadius: 16,
        borderWidth: 1,
    },
    content: { flex: 1, marginLeft: 12 },
    titleRow: { justifyContent: 'space-between' },
    online: { position: 'absolute', right: -1, bottom: 0, borderWidth: 2 },
});

export default ListItemSkeleton;

