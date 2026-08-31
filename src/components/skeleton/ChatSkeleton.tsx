import React from 'react';
import { View, ScrollView } from 'react-native';
import { SkeletonBlock, SkeletonRow, SkeletonColumn } from './Skeleton';
import { useTheme } from '../../contexts/ThemeContext';
import type { ChatThemeColors } from '../../utils/chatThemes';

const BUBBLE_WIDTHS = [170, 110, 150, 90, 130, 160, 100, 140];
const SENT_PATTERN = [false, false, true, false, true, true, false, true];
const ATTACH_PATTERN = [false, true, false, false, true, false, false, true];
const REPLY_PATTERN = [false, false, true, false, false, false, true, false];

type SkeletonColors = Partial<ChatThemeColors>;

const useChatSkeletonColors = (theme?: SkeletonColors) => {
    const { colors: themeColors } = useTheme();
    return {
        sentBg: theme?.sentBg || themeColors.surface.secondary,
        recvBg: theme?.recvBg || themeColors.surface.secondary,
        sentBorder: theme?.sentBorder || 'transparent',
        recvBorder: theme?.recvBorder || 'transparent',
        headerBg: theme?.headerBg || themeColors.surface.header,
        footerBg: theme?.footerBg || themeColors.surface.primary,
        overlay: theme?.overlay || 'transparent',
    };
};

export const ChatHeaderSkeleton: React.FC<{ theme?: SkeletonColors }> = ({ theme }) => {
    const colors = useChatSkeletonColors(theme);
    return (
        <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 8,
            backgroundColor: colors.headerBg,
            borderBottomWidth: 1,
            borderBottomColor: colors.sentBorder || 'rgba(255,255,255,0.08)',
        }}>
            <SkeletonBlock width={22} height={22} borderRadius={11} style={{ marginRight: 8 }} />
            <SkeletonRow style={{ flex: 1, alignItems: 'center' }}>
                <SkeletonBlock width={35} height={35} borderRadius={18} />
                <SkeletonColumn style={{ marginLeft: 10, flex: 1 }}>
                    <SkeletonBlock width={'48%'} height={14} />
                    <SkeletonBlock width={'32%'} height={11} />
                </SkeletonColumn>
            </SkeletonRow>
            <SkeletonRow>
                <SkeletonBlock width={35} height={35} borderRadius={18} style={{ marginLeft: 6 }} />
                <SkeletonBlock width={35} height={35} borderRadius={18} style={{ marginLeft: 6 }} />
                <SkeletonBlock width={35} height={35} borderRadius={18} style={{ marginLeft: 6 }} />
                <SkeletonBlock width={35} height={35} borderRadius={18} style={{ marginLeft: 6 }} />
            </SkeletonRow>
        </View>
    );
};

const ChatBubbleSkeletonRow: React.FC<{ index: number; theme?: SkeletonColors }> = ({ index, theme }) => {
    const colors = useChatSkeletonColors(theme);
    const isSent = SENT_PATTERN[index % SENT_PATTERN.length];
    const primaryWidth = BUBBLE_WIDTHS[index % BUBBLE_WIDTHS.length];
    const hasSecondLine = index % 3 === 1;
    const hasAttachment = ATTACH_PATTERN[index % ATTACH_PATTERN.length];
    const hasReply = REPLY_PATTERN[index % REPLY_PATTERN.length];
    const bubbleBg = isSent ? colors.sentBg : colors.recvBg;
    const bubbleBorder = isSent ? colors.sentBorder : colors.recvBorder;

    const avatar = (
        <View style={{ marginBottom: 2, [isSent ? 'marginLeft' : 'marginRight']: 8 }}>
            <SkeletonBlock width={36} height={36} borderRadius={18} />
        </View>
    );

    return (
        <View
            style={{
                marginBottom: 8,
                marginHorizontal: 16,
                flexDirection: 'row',
                alignItems: 'flex-end',
                justifyContent: isSent ? 'flex-end' : 'flex-start',
            }}
        >
            {!isSent && avatar}
            <View style={{ maxWidth: isSent ? '75%' : '78%', alignItems: isSent ? 'flex-end' : 'flex-start' }}>
                <View
                    style={{
                        backgroundColor: bubbleBg,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 18,
                        borderBottomLeftRadius: isSent ? 18 : 4,
                        borderBottomRightRadius: isSent ? 4 : 18,
                        borderWidth: 1,
                        borderColor: bubbleBorder,
                    }}
                >
                    {hasReply ? (
                        <View
                            style={{
                                marginBottom: 8,
                                paddingVertical: 8,
                                paddingHorizontal: 10,
                                borderLeftWidth: 3,
                                borderLeftColor: 'rgba(255,255,255,0.35)',
                                backgroundColor: 'rgba(0,0,0,0.18)',
                                borderRadius: 8,
                            }}
                        >
                            <SkeletonBlock width={72} height={8} borderRadius={4} style={{ marginBottom: 6 }} />
                            <SkeletonBlock width={Math.max(88, Math.round(primaryWidth * 0.7))} height={10} borderRadius={4} />
                        </View>
                    ) : null}
                    {hasAttachment ? (
                        <View
                            style={{
                                width: 220,
                                maxWidth: '100%',
                                height: 156,
                                borderRadius: 14,
                                overflow: 'hidden',
                                marginBottom: 6,
                            }}
                        >
                            <SkeletonBlock width={220} height={156} borderRadius={14} />
                        </View>
                    ) : null}
                    <SkeletonBlock width={primaryWidth} height={11} borderRadius={6} />
                    {hasSecondLine ? (
                        <SkeletonBlock
                            width={Math.round(primaryWidth * 0.55)}
                            height={11}
                            borderRadius={6}
                            style={{ marginTop: 6 }}
                        />
                    ) : null}
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
                        <SkeletonBlock width={42} height={9} borderRadius={4} />
                    </View>
                </View>
            </View>
            {isSent && avatar}
        </View>
    );
};

export const ChatBubblesSkeleton: React.FC<{
    count?: number;
    theme?: SkeletonColors;
    scrollable?: boolean;
}> = ({
    count = 14,
    theme,
    scrollable = true,
}) => {
    const rows = Array.from({ length: count }).map((_, idx) => (
        <ChatBubbleSkeletonRow key={idx} index={idx} theme={theme} />
    ));

    if (!scrollable) {
        return <View style={{ paddingVertical: 4 }}>{rows}</View>;
    }

    return (
        <ScrollView
            style={{ flex: 1, backgroundColor: 'transparent' }}
            contentContainerStyle={{ paddingVertical: 8, justifyContent: 'flex-end', flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
        >
            {rows}
        </ScrollView>
    );
};

export const ChatComposerSkeleton: React.FC<{ theme?: SkeletonColors }> = ({ theme }) => {
    const colors = useChatSkeletonColors(theme);
    return (
        <View
            style={{
                backgroundColor: colors.footerBg,
                borderTopWidth: 1,
                borderTopColor: colors.sentBorder || 'rgba(255,255,255,0.08)',
                paddingHorizontal: 12,
                paddingTop: 8,
                paddingBottom: 0,
            }}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <SkeletonBlock width={40} height={40} borderRadius={20} style={{ marginRight: 8 }} />
                <View style={{ flex: 1, marginRight: 8 }}>
                    <SkeletonBlock width={'100%'} height={40} borderRadius={20} />
                </View>
                <SkeletonBlock width={40} height={40} borderRadius={20} />
            </View>
        </View>
    );
};

export const ChatPageSkeleton: React.FC<{
    count?: number;
    theme?: SkeletonColors;
    showHeader?: boolean;
    showComposer?: boolean;
}> = ({ count = 14, theme, showHeader = true, showComposer = true }) => {
    return (
        <View style={{ flex: 1 }}>
            {showHeader ? <ChatHeaderSkeleton theme={theme} /> : null}
            <ChatBubblesSkeleton count={count} theme={theme} />
            {showComposer ? <ChatComposerSkeleton theme={theme} /> : null}
        </View>
    );
};

export const MessageListSkeleton: React.FC<{ count?: number }> = ({ count = 12 }) => {
    return <ChatBubblesSkeleton count={count} />;
};
