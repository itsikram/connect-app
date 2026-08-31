import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonBlock, SkeletonRow, SkeletonColumn } from './Skeleton';
import { useFeedTokens } from '../../theme/feedTokens';

interface PostSkeletonProps {
    count?: number;
}

const PostSkeleton: React.FC<PostSkeletonProps> = ({ count = 3 }) => {
    const feed = useFeedTokens();
    return (
        <View>
            {Array.from({ length: count }).map((_, idx) => (
                <View
                    key={idx}
                    style={[
                        styles.card,
                        {
                            backgroundColor: feed.postBg,
                            borderColor: feed.postBorder,
                            shadowOpacity: feed.shadowOpacity,
                        },
                    ]}
                >
                    <View style={styles.header}>
                        <SkeletonRow style={styles.authorRow} spacing={10}>
                            <SkeletonBlock width={40} height={40} borderRadius={20} style={[styles.avatar, { borderColor: feed.postBorder }]} />
                            <SkeletonColumn style={{ flex: 1 }} spacing={8}>
                                <SkeletonBlock width={120} height={13} borderRadius={999} />
                                <SkeletonBlock width={78} height={9} borderRadius={999} />
                            </SkeletonColumn>
                            <SkeletonBlock width={34} height={34} borderRadius={17} />
                            <SkeletonBlock width={34} height={34} borderRadius={17} />
                        </SkeletonRow>
                    </View>

                    <SkeletonColumn style={styles.caption} spacing={8}>
                        <SkeletonBlock width={'92%'} height={12} borderRadius={999} />
                        <SkeletonBlock width={'74%'} height={12} borderRadius={999} />
                        <SkeletonBlock width={'46%'} height={12} borderRadius={999} />
                    </SkeletonColumn>

                    <SkeletonBlock width={'100%'} height={220} borderRadius={0} style={[styles.media, { backgroundColor: feed.mediaBg }]} />

                    <View style={styles.footer}>
                        <SkeletonRow style={styles.reactRow} spacing={10}>
                            <SkeletonBlock width={18} height={18} borderRadius={9} />
                            <SkeletonBlock width={18} height={18} borderRadius={9} />
                            <SkeletonBlock width={18} height={18} borderRadius={9} />
                            <SkeletonBlock width={28} height={10} borderRadius={999} />
                            <View style={{ flex: 1 }} />
                            <SkeletonBlock width={56} height={10} borderRadius={999} />
                            <SkeletonBlock width={56} height={10} borderRadius={999} />
                        </SkeletonRow>
                        <View style={styles.actions}>
                            <View style={styles.actionSlot}>
                                <SkeletonBlock width={'100%'} height={38} borderRadius={10} />
                            </View>
                            <View style={styles.actionSlot}>
                                <SkeletonBlock width={'100%'} height={38} borderRadius={10} />
                            </View>
                            <View style={styles.actionSlot}>
                                <SkeletonBlock width={'100%'} height={38} borderRadius={10} />
                            </View>
                        </View>
                        <SkeletonRow style={styles.composer} spacing={10}>
                            <SkeletonBlock width={34} height={34} borderRadius={17} />
                            <SkeletonBlock width={'100%'} height={40} borderRadius={22} style={{ flex: 1 }} />
                        </SkeletonRow>
                    </View>
                </View>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        borderRadius: 12,
        marginHorizontal: 0,
        marginBottom: 10,
        borderWidth: 1,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 12,
        elevation: 4,
    },
    header: {
        paddingTop: 10,
        paddingHorizontal: 5,
        paddingBottom: 10,
    },
    authorRow: {
        alignItems: 'flex-start',
        justifyContent: 'space-between',
    },
    avatar: {
        borderWidth: 1.5,
    },
    caption: {
        paddingHorizontal: 12,
        marginBottom: 12,
    },
    media: {},
    footer: {
        paddingHorizontal: 12,
        paddingBottom: 12,
    },
    reactRow: {
        paddingVertical: 10,
        alignItems: 'center',
    },
    actions: {
        flexDirection: 'row',
        width: '100%',
        paddingVertical: 6,
        gap: 4,
    },
    actionSlot: {
        flex: 1,
    },
    composer: {
        paddingTop: 10,
        alignItems: 'center',
    },
});

export default PostSkeleton;
