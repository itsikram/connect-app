import React from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    StyleSheet,
    Animated,
    Easing,
    ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../contexts/ThemeContext';

interface LiveVoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    isActive: boolean;
    duration: number;
    isConnecting: boolean;
    role: 'sender' | 'receiver';
    friendName: string;
    onStop?: () => void;
}

const LiveVoiceModal: React.FC<LiveVoiceModalProps> = ({
    isOpen,
    onClose,
    isActive,
    duration,
    isConnecting,
    role,
    friendName,
    onStop,
}) => {
    const { colors: themeColors, isDarkMode } = useTheme();
    const pulseAnim = React.useRef(new Animated.Value(1)).current;

    React.useEffect(() => {
        if (isActive) {
            const pulseAnimation = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.5,
                        duration: 2000,
                        easing: Easing.out(Easing.ease),
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 0,
                        useNativeDriver: true,
                    }),
                ])
            );
            pulseAnimation.start();
            return () => pulseAnimation.stop();
        }
    }, [isActive, pulseAnim]);

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <Modal
            visible={isOpen}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={[styles.modal, { backgroundColor: themeColors.surface.primary || (isDarkMode ? '#1a1a1a' : '#FFFFFF') }]}>
                    {/* Header */}
                    <View style={[styles.header, { borderBottomColor: themeColors.border.primary || 'rgba(255,255,255,0.1)' }]}>
                        <Text style={[styles.title, { color: themeColors.text.primary }]}>
                            Live Voice Transfer
                        </Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Icon name="close" size={24} color={themeColors.text.secondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Content */}
                    <View style={styles.content}>
                        {/* Status Container */}
                        <View style={[styles.statusContainer, { backgroundColor: themeColors.surface.secondary || (isDarkMode ? '#252525' : '#F5F5F5') }]}>
                            {/* Icon Container */}
                            <View style={styles.iconContainer}>
                                {isConnecting ? (
                                    <ActivityIndicator size="large" color="#ffa500" />
                                ) : isActive ? (
                                    <>
                                        <Icon name="phone" size={40} color="#1DB954" />
                                        <Animated.View
                                            style={[
                                                styles.pulse,
                                                {
                                                    transform: [{ scale: pulseAnim }],
                                                    opacity: pulseAnim.interpolate({
                                                        inputRange: [1, 1.5],
                                                        outputRange: [1, 0],
                                                    }),
                                                },
                                            ]}
                                        />
                                    </>
                                ) : (
                                    <Icon name="phone-disabled" size={40} color="#666" />
                                )}
                            </View>

                            {/* Status Text */}
                            <View style={styles.info}>
                                <Text style={[styles.statusText, {
                                    color: isConnecting ? '#ffa500' : isActive ? '#1DB954' : '#666'
                                }]}>
                                    {isConnecting ? 'Connecting...' : isActive ? 'Live Voice Active' : 'Inactive'}
                                </Text>

                                {friendName && (
                                    <Text style={[styles.participant, { color: themeColors.text.secondary }]}>
                                        {role === 'sender' ? 'Transferring to: ' : 'Receiving from: '}
                                        <Text style={{ fontWeight: '600', color: themeColors.text.primary }}>
                                            {friendName}
                                        </Text>
                                    </Text>
                                )}

                                {isActive && duration !== null && (
                                    <View style={styles.durationContainer}>
                                        <Icon name="access-time" size={20} color="#1DB954" />
                                        <Text style={styles.duration}>{formatDuration(duration)}</Text>
                                    </View>
                                )}
                            </View>
                        </View>

                        {/* Details */}
                        <View style={[styles.details, { backgroundColor: themeColors.surface.secondary || (isDarkMode ? '#252525' : '#F5F5F5') }]}>
                            <View style={styles.detailItem}>
                                <Icon name="info" size={20} color="#1DB954" />
                                <Text style={[styles.detailText, { color: themeColors.text.secondary }]}>
                                    {role === 'sender'
                                        ? 'Your voice is being transmitted in real-time'
                                        : 'You are receiving live audio'}
                                </Text>
                            </View>
                            <View style={styles.detailItem}>
                                <Icon name="signal-cellular-alt" size={20} color="#1DB954" />
                                <Text style={[styles.detailText, { color: themeColors.text.secondary }]}>
                                    Connection: {isActive ? 'Active' : isConnecting ? 'Connecting' : 'Disconnected'}
                                </Text>
                            </View>
                        </View>

                        {/* Actions */}
                        {role === 'sender' && isActive && onStop && (
                            <TouchableOpacity
                                style={styles.stopButton}
                                onPress={onStop}
                            >
                                <Icon name="stop" size={20} color="#FFFFFF" />
                                <Text style={styles.stopButtonText}>Stop Live Voice</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modal: {
        width: '90%',
        maxWidth: 400,
        borderRadius: 12,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
    },
    title: {
        fontSize: 20,
        fontWeight: '600',
    },
    closeButton: {
        padding: 5,
    },
    content: {
        padding: 20,
        gap: 20,
    },
    statusContainer: {
        alignItems: 'center',
        padding: 20,
        borderRadius: 8,
        gap: 15,
    },
    iconContainer: {
        width: 80,
        height: 80,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    pulse: {
        position: 'absolute',
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 2,
        borderColor: '#1DB954',
    },
    info: {
        alignItems: 'center',
        width: '100%',
    },
    statusText: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 10,
    },
    participant: {
        fontSize: 14,
        marginBottom: 10,
        textAlign: 'center',
    },
    durationContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 10,
    },
    duration: {
        fontSize: 24,
        fontWeight: '600',
        color: '#1DB954',
    },
    details: {
        padding: 15,
        borderRadius: 8,
        gap: 12,
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    detailText: {
        fontSize: 14,
        flex: 1,
    },
    stopButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ff4d4f',
        padding: 12,
        borderRadius: 6,
        gap: 8,
    },
    stopButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default LiveVoiceModal;

