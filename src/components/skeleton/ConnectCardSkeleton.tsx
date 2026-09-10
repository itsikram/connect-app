import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SkeletonBlock } from './Skeleton';
import { useTheme } from '../../contexts/ThemeContext';

interface ConnectCardSkeletonProps {
    count?: number;
}

const ConnectCardSkeleton: React.FC<ConnectCardSkeletonProps> = ({ count = 6 }) => {
    const { colors: themeColors } = useTheme();

    return (
        <View style={styles.container}>
            {Array.from({ length: count }).map((_, idx) => (
                <View
                    key={idx}
                    style={[
                        styles.card,
                        {
                            backgroundColor: themeColors.surface.primary,
                            borderColor: themeColors.border.primary,
                        },
                    ]}
                >
                    <SkeletonBlock width={60} height={60} borderRadius={30} style={styles.avatar} />
                    <SkeletonBlock width="78%" height={18} borderRadius={6} style={styles.name} />
                    <View style={styles.actions}>
                        <SkeletonBlock width="48%" height={36} borderRadius={8} />
                        <SkeletonBlock width="48%" height={36} borderRadius={8} />
                    </View>
                </View>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    card: {
        width: '48%',
        marginBottom: 12,
        padding: 12,
        alignItems: 'center',
        borderRadius: 14,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    avatar: {
        marginBottom: 10,
    },
    name: {
        minHeight: 40,
        marginBottom: 6,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        gap: 8,
    },
});

export default ConnectCardSkeleton;

