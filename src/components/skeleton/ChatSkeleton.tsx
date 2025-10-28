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

export const MessageListSkeleton: React.FC<{ count?: number }> = ({ count = 12 }) => {
    const { colors: themeColors } = useTheme();
    
    const renderMessage = (idx: number) => {
        const isMyMessage = idx % 2 === 0;
        const width = [120, 160, 140, 180, 150, 170, 130, 165][idx % 8];
        const bgColor = themeColors?.surface?.secondary || themeColors?.gray?.[200] || 'rgba(0,0,0,0.1)';
        
        return (
            <View key={idx} style={{
                marginBottom: 8,
                marginHorizontal: 16,
                flexDirection: 'row',
                alignItems: 'flex-end',
                justifyContent: isMyMessage ? 'flex-end' : 'flex-start',
            }}>
                {!isMyMessage && (
                    <View style={{ marginRight: 8, marginBottom: 2 }}>
                        <SkeletonBlock width={36} height={36} borderRadius={18} />
                    </View>
                )}

                <View style={{ 
                    flex: 1, 
                    maxWidth: isMyMessage ? '75%' : '78%',
                    alignItems: isMyMessage ? 'flex-end' : 'flex-start',
                }}>
                    <View style={{
                        backgroundColor: bgColor,
                        borderRadius: 18,
                        borderBottomLeftRadius: isMyMessage ? 18 : 4,
                        borderBottomRightRadius: isMyMessage ? 4 : 18,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        width: width,
                        minWidth: width,
                    }}>
                        <SkeletonBlock width={width} height={20} borderRadius={4} />
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 6 }}>
                            {isMyMessage && <SkeletonBlock width={14} height={14} style={{ marginRight: 4 }} />}
                            <SkeletonBlock width={35} height={11} borderRadius={4} />
                        </View>
                    </View>
                </View>

                {isMyMessage && idx % 3 === 2 && (
                    <View style={{ marginLeft: 8, marginBottom: 2 }}>
                        <SkeletonBlock width={15} height={15} borderRadius={8} />
                    </View>
                )}
                
                {isMyMessage && idx % 3 !== 2 && (
                    <View style={{ marginLeft: 8, marginBottom: 2, width: 15, height: 15 }} />
                )}
            </View>
        );
    };

    return (
        <View style={{ flex: 1, paddingVertical: 8 }}>
            {Array.from({ length: count }).map((_, idx) => renderMessage(idx))}
        </View>
    );
};


