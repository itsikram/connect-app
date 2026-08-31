import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { SkeletonBlock, SkeletonColumn, SkeletonRow } from './Skeleton';

type ProfileSkeletonProps = {
    showBackHeader?: boolean;
};

export const ProfileAboutSkeleton = () => {
    const { colors } = useTheme();
    return (
        <View
            style={[
                styles.detailsCard,
                {
                    backgroundColor: colors.surface.secondary,
                    borderColor: colors.border.secondary,
                },
            ]}
        >
            {[0, 1, 2, 3, 4].map((idx) => (
                <SkeletonRow key={idx} spacing={10} style={styles.detailsRow}>
                    <SkeletonBlock width={20} height={20} borderRadius={10} />
                    <SkeletonBlock width={idx % 2 === 0 ? '72%' : '58%'} height={14} borderRadius={8} />
                </SkeletonRow>
            ))}
        </View>
    );
};

export const ProfileFriendsSkeleton = ({ count = 4 }: { count?: number }) => {
    const { colors } = useTheme();
    return (
        <View style={styles.friendsGrid}>
            {Array.from({ length: count }).map((_, idx) => (
                <View
                    key={idx}
                    style={[
                        styles.friendItem,
                        {
                            backgroundColor: colors.surface.secondary,
                            borderColor: colors.border.secondary,
                        },
                    ]}
                >
                    <SkeletonBlock width={64} height={64} borderRadius={32} style={{ marginBottom: 8 }} />
                    <SkeletonBlock width={'70%'} height={14} borderRadius={8} />
                </View>
            ))}
        </View>
    );
};

export const ProfileMediaSkeleton = ({ count = 2 }: { count?: number }) => {
    const { colors } = useTheme();
    return (
        <View style={styles.mediaList}>
            {Array.from({ length: count }).map((_, idx) => (
                <View
                    key={idx}
                    style={[
                        styles.mediaCard,
                        {
                            backgroundColor: colors.surface.secondary,
                            borderColor: colors.border.secondary,
                        },
                    ]}
                >
                    <SkeletonBlock width={'100%'} height={280} borderRadius={0} />
                </View>
            ))}
        </View>
    );
};

const ProfileSkeleton = ({ showBackHeader = false }: ProfileSkeletonProps) => {
    const { colors } = useTheme();
    const { width } = useWindowDimensions();
    const isSmall = width < 380;
    const avatarSize = isSmall ? 120 : 170;
    const coverHeight = isSmall ? 240 : 280;
    const infoOverlap = -Math.round(avatarSize / 3);

    return (
        <View style={[styles.page, { backgroundColor: colors.background.primary }]}>
            {showBackHeader && (
                <View
                    style={[
                        styles.backHeader,
                        {
                            backgroundColor: colors.surface.header,
                            borderBottomColor: colors.border.secondary,
                        },
                    ]}
                >
                    <SkeletonBlock width={36} height={36} borderRadius={10} />
                    <SkeletonBlock width={90} height={18} borderRadius={8} />
                    <View style={{ width: 36 }} />
                </View>
            )}

            <View style={[styles.header, { backgroundColor: colors.surface.header }]}>
                <View style={[styles.cover, { height: coverHeight, backgroundColor: colors.surface.secondary }]}>
                    <SkeletonBlock width={'100%'} height={coverHeight} borderRadius={0} />
                </View>

                <View style={[styles.info, { marginTop: infoOverlap, borderBottomColor: colors.border.secondary }]}>
                    <View
                        style={[
                            styles.avatarRing,
                            {
                                width: avatarSize,
                                height: avatarSize,
                                borderRadius: avatarSize / 2,
                                borderColor: colors.border.secondary,
                                backgroundColor: colors.surface.secondary,
                            },
                        ]}
                    >
                        <SkeletonBlock width={avatarSize - 8} height={avatarSize - 8} borderRadius={(avatarSize - 8) / 2} />
                    </View>

                    <SkeletonColumn spacing={8} style={styles.nameBlock}>
                        <SkeletonBlock width={180} height={22} borderRadius={8} />
                        <SkeletonBlock width={88} height={12} borderRadius={8} />
                    </SkeletonColumn>

                    <View
                        style={[
                            styles.bioCard,
                            {
                                backgroundColor: colors.surface.secondary,
                                borderColor: colors.border.secondary,
                            },
                        ]}
                    >
                        <SkeletonBlock width={'92%'} height={12} borderRadius={8} style={{ alignSelf: 'center' }} />
                        <SkeletonBlock width={'70%'} height={12} borderRadius={8} style={{ alignSelf: 'center', marginTop: 8 }} />
                        <SkeletonBlock width={84} height={22} borderRadius={6} style={{ alignSelf: 'center', marginTop: 12 }} />
                    </View>

                    <SkeletonRow spacing={8} style={styles.buttons}>
                        <SkeletonBlock width={128} height={34} borderRadius={6} />
                        <SkeletonBlock width={118} height={34} borderRadius={6} />
                    </SkeletonRow>
                </View>

                <SkeletonRow spacing={8} style={styles.tabs}>
                    <SkeletonBlock width={64} height={28} borderRadius={10} />
                    <SkeletonBlock width={58} height={28} borderRadius={10} />
                    <SkeletonBlock width={72} height={28} borderRadius={10} />
                    <SkeletonBlock width={64} height={28} borderRadius={10} />
                    <SkeletonBlock width={62} height={28} borderRadius={10} />
                </SkeletonRow>
            </View>

            <View style={styles.content}>
                <ProfileAboutSkeleton />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    page: {
        flex: 1,
    },
    backHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    header: {
        marginBottom: 15,
    },
    cover: {
        width: '100%',
        overflow: 'hidden',
        borderBottomLeftRadius: 10,
        borderBottomRightRadius: 10,
    },
    info: {
        width: '94%',
        alignSelf: 'center',
        alignItems: 'center',
        borderBottomWidth: 1,
        paddingBottom: 20,
    },
    avatarRing: {
        borderWidth: 3.5,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        marginBottom: 12,
    },
    nameBlock: {
        alignItems: 'center',
        marginBottom: 10,
    },
    bioCard: {
        width: '90%',
        minHeight: 60,
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginBottom: 10,
    },
    buttons: {
        marginTop: 4,
    },
    tabs: {
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    content: {
        padding: 16,
    },
    detailsCard: {
        borderRadius: 10,
        padding: 16,
        borderWidth: 1,
        gap: 14,
    },
    detailsRow: {
        alignItems: 'center',
    },
    friendsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    friendItem: {
        width: '48%',
        borderRadius: 10,
        padding: 12,
        marginBottom: 10,
        borderWidth: 1,
        alignItems: 'center',
    },
    mediaList: {
        gap: 12,
    },
    mediaCard: {
        borderRadius: 10,
        borderWidth: 1,
        overflow: 'hidden',
        marginBottom: 12,
    },
});

export default ProfileSkeleton;
