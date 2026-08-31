import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    FlatList,
    Platform,
    StatusBar,
    Alert,
    Modal,
    Pressable,
    Image,
    ImageBackground,
    Dimensions,
    ScrollView,
    ActivityIndicator,
    Linking,
    AppState,
    Keyboard,
    Animated,
    Easing,
    type KeyboardEvent,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Swipeable } from 'react-native-gesture-handler';
import { useRoute, useNavigation, useFocusEffect, useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Slider from '@react-native-community/slider';
// react-native-permissions replaced with expo-permissions for Expo compatibility
import { Video, Audio } from 'expo-av';
import * as Speech from 'expo-speech';
// Audio recording functionality moved to expo-av
import { useTheme } from '../contexts/ThemeContext';
import { ChatBubblesSkeleton, ChatComposerSkeleton, ChatPageSkeleton } from '../components/skeleton/ChatSkeleton';
import { SkeletonBlock } from '../components/skeleton/Skeleton';
import UserPP from '../components/UserPP';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import ProfileImage from '../components/ProfileImage';
import { markMessagesAsRead, addNewMessage, updateUnreadMessageCount } from '../reducers/chatReducer';
import { updateProfileField } from '../reducers/profileReducer';
import { useSocket } from '../contexts/SocketContext';
import moment from 'moment';
import * as ImagePicker from 'expo-image-picker';
import api, { friendAPI } from '../lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Background TTS service removed for Expo compatibility
import { CameraView, Camera } from 'expo-camera';
import { useSettings } from '../contexts/SettingsContext';
import { io, Socket } from 'socket.io-client';
import config from '../lib/config';
import { emitStartAudioCall, emitStartVideoCall } from '../lib/callEvents';
import LiveVoiceModal from '../components/LiveVoiceModal';
import useFriendChatSettings from '../hooks/useFriendChatSettings';
import { isRomanticMessage, QUICK_REACTION_PRESETS } from '../utils/chatThemes';
import ChatSettingsModal from '../components/ChatSettingsModal';
import LoveEmojiRain from '../components/LoveEmojiRain';
import { LinearGradient } from 'expo-linear-gradient';
import { upsertConfirmedMessage, mergeHistoryWithLive, isConversationMessage } from '../utils/optimisticMessage';
// VideoCall and AudioCall components moved to App.tsx for global rendering


interface Message {
    _id: string;
    message: string;
    receiverId: string;
    senderId: string;
    room: string;
    attachment?: string;
    timestamp: Date;
    isSeen: boolean;
    parent?: any | null;
    tempId?: string;
    reacts?: string[];
    messageType?: 'text' | 'call' | 'audio';
    callType?: 'audio' | 'video';
    callEvent?: 'missed' | 'ended' | 'declined' | 'started';
    isOptimistic?: boolean;
    sendFailed?: boolean;
}

const MESSAGES_PER_PAGE = 20;
const NEAR_BOTTOM_PX = 100;
const LOAD_OLDER_SCROLL_PERCENT = 30;

const COMPOSER_INSERT_EMOJIS = [
    ...QUICK_REACTION_PRESETS,
    '😊',
    '😢',
    '🙏',
    '🎉',
    '💯',
    '🌹',
    '🫶',
    '😅',
    '😎',
    '🥺',
];

// Function to validate if a string is a valid image URL
const isValidImageUrl = (url: string): boolean => {
    if (typeof url !== 'string') return false;
    // Basic check for image file extensions
    return /^https?:\/\/.+\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(url);
};

const isAudioUrl = (url: string): boolean => {
    if (typeof url !== 'string') return false;
    return /^https?:\/\/.+\.(mp3|m4a|aac|ogg|oga|opus|wav|webm)$/i.test(url);
};

const getMessageTime = (timestamp: Date | string) => {
    const inputDate = moment(timestamp);
    return inputDate.isValid() ? inputDate.format('DD/MM/YY hh:mm A') : '';
};

const formatHeaderLastSeen = (lastSeenValue?: string | Date | null) => {
    if (!lastSeenValue) return '';
    const lastSeenTimeStamp = moment(lastSeenValue);
    if (!lastSeenTimeStamp.isValid()) return '';
    const diffDays = moment().diff(lastSeenTimeStamp, 'days');
    if (diffDays === 0) return lastSeenTimeStamp.format('hh:mm A');
    if (diffDays > 365) return lastSeenTimeStamp.format('MM/YY hh:mm A');
    return lastSeenTimeStamp.format('DD/MM hh:mm A');
};

const getMessageSnippet = (msg: any) => {
    const text = String(msg?.message || msg?.body || '').trim();
    if (text) return text;
    if (msg?.messageType === 'call') return msg?.message || 'Call';
    if (msg?.messageType === 'audio' || isAudioUrl(msg?.attachment || '')) return 'Voice message';
    if (typeof msg?.attachment === 'string' && isValidImageUrl(msg.attachment)) return 'Photo';
    return 'Message';
};

const normalizeChatMessage = (msg: any): Message => {
    if (!msg) return msg;
    return {
        ...msg,
        _id: String(msg._id || msg.tempId || ''),
        timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
        isSeen: Boolean(msg.isSeen),
        isOptimistic: Boolean(msg.isOptimistic),
        sendFailed: Boolean(msg.sendFailed),
    };
};

const toTimestampIso = (value: Date | string | undefined | null) => {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString();
};

const TypingDots = ({ color }: { color: string }) => {
    const dots = useRef([0, 1, 2].map(() => new Animated.Value(0.35))).current;

    useEffect(() => {
        const loops = dots.map((dot, index) =>
            Animated.loop(
                Animated.sequence([
                    Animated.delay(index * 160),
                    Animated.timing(dot, {
                        toValue: 1,
                        duration: 280,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                    Animated.timing(dot, {
                        toValue: 0.35,
                        duration: 280,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                ]),
            ),
        );
        loops.forEach((loop) => loop.start());
        return () => loops.forEach((loop) => loop.stop());
    }, [dots]);

    return (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {dots.map((dot, index) => (
                <Animated.View
                    key={index}
                    style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        marginRight: index === 2 ? 0 : 4,
                        backgroundColor: color,
                        opacity: dot,
                    }}
                />
            ))}
        </View>
    );
};

const listHasId = (list: any, id: any) => {
    if (!id || !Array.isArray(list)) return false;
    const target = String(id?._id || id);
    return list.some((item) => String(item?._id || item) === target);
};


const SingleMessage = () => {
    const route: any = useRoute();
    const navigation: any = useNavigation();
    const dispatch = useDispatch<AppDispatch>();
    const friend: any = (route && route.params && route.params.friend) ? route.params.friend : null;
    const myProfile = useSelector((state: RootState) => state.profile);
    const activeFriends = useSelector((state: RootState) => state.presence.activeFriends);
    const lastSeenMap = useSelector((state: RootState) => (state as any).presence?.lastSeen || {});
    const [room, setRoom] = useState('');
    const { connect, isConnected, emit, on, off, startVideoCall, startAudioCall, checkUserActive } = useSocket();
    const [isCallActive, setIsCallActive] = useState<boolean>(false);
    const { colors: themeColors, isDarkMode } = useTheme();
    const settings = useSettings();
    const {
        settings: chatAppearance,
        theme: chatTheme,
        wallpaper,
        updateSettings: updateChatAppearance,
    } = useFriendChatSettings(friend?._id);
    const [loveRainBurst, setLoveRainBurst] = useState(0);
    const lastLoveRainRef = useRef(0);
    const chatThemeRef = useRef(chatTheme);
    const [isChatSettingsOpen, setIsChatSettingsOpen] = useState(false);
    const CHAT_BG_STORAGE_KEY = '@chat_background_image';
    const getMessagesStorageKey = (friendId: string) => `@chat_messages_${friendId}`;

    useEffect(() => {
        chatThemeRef.current = chatTheme;
    }, [chatTheme]);
    const isFriendOnline = React.useMemo(() => {
        try { return !!friend?._id && activeFriends.includes(friend._id); } catch (_) { return false; }
    }, [activeFriends, friend?._id]);
    const friendLastSeenIso = React.useMemo(() => {
        try { return friend?._id ? lastSeenMap[friend._id] : undefined; } catch (_) { return undefined; }
    }, [lastSeenMap, friend?._id]);

    // Ensure status bar sits above header when this screen is focused
    useFocusEffect(
        React.useCallback(() => {
            try {
                StatusBar.setBarStyle('light-content');
                if (Platform.OS === 'android') {
                    StatusBar.setTranslucent(true);
                    StatusBar.setBackgroundColor('transparent');
                }
            } catch (e) {}
            return () => {};
        }, [chatTheme.colors.headerBg])
    );

    // Add state for context menu
    const [contextMenuVisible, setContextMenuVisible] = useState(false);
    const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
    const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
    const [contextMenuUseBottom, setContextMenuUseBottom] = useState(false);
    const [contextMenuBottom, setContextMenuBottom] = useState(20);
    const [isReactedByMe, setIsReactedByMe] = useState<boolean>(false);

    // Add state for image modal
    const [imageModalVisible, setImageModalVisible] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string>('');
    const [imageScale, setImageScale] = useState(1);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [pendingAttachment, setPendingAttachment] = useState<string | null>(null);
    const [pendingAttachmentLocal, setPendingAttachmentLocal] = useState<string | null>(null);
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
    const swipeableRefs = useRef<Map<string, any>>(new Map());
    const [activeSwipeId, setActiveSwipeId] = useState<string | null>(null);

    // Voice message (recording) - using expo-av
    const [recording, setRecording] = React.useState<Audio.Recording | null>(null);
    const recordingRef = React.useRef<Audio.Recording | null>(null);
    
    React.useEffect(() => {
        return () => {
            // Clean up recording on unmount
            if (recordingRef.current) {
                recordingRef.current.stopAndUnloadAsync();
                recordingRef.current = null;
            }
        };
    }, []);
    const [isRecording, setIsRecording] = useState(false);
    const [recordSecs, setRecordSecs] = useState(0);
    const [recordTime, setRecordTime] = useState('00:00');
    const [isUploadingAudio, setIsUploadingAudio] = useState(false);
    const [playingId, setPlayingId] = useState<string | null>(null);
    const [playingProgress, setPlayingProgress] = useState<Record<string, { current: number; duration: number }>>({});
    const videoRefs = useRef(new Map<string, any>()).current;
    const [isMicPermissionGranted, setIsMicPermissionGranted] = useState<boolean>(false);
    const [isCameraPermissionGranted, setIsCameraPermissionGranted] = useState<boolean>(false);
    const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
    const isCameraReadyRef = useRef<boolean>(false);
    
    // Live voice transfer state
    const [isLiveVoiceActive, setIsLiveVoiceActive] = useState(false);
    const [isLiveVoiceConnecting, setIsLiveVoiceConnecting] = useState(false);
    const [isLiveVoiceModalOpen, setIsLiveVoiceModalOpen] = useState(false);
    const [liveVoiceDuration, setLiveVoiceDuration] = useState(0);
    const [liveVoiceRole, setLiveVoiceRole] = useState<'sender' | 'receiver'>('sender');
    const liveVoiceEngineRef = useRef<any | null>(null); // Agora removed for Expo compatibility
    const isLiveVoiceActiveRef = useRef(false);
    const liveVoiceDurationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    
    // Check if screen is focused and app is in foreground before using camera
    const isFocused = useIsFocused();
    const [appState, setAppState] = useState(AppState.currentState);
    const isAppActive = appState === 'active';
    const shouldUseCamera = isFocused && isAppActive;
    
    // Monitor app state changes
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState) => {
            setAppState(nextAppState);
        });
        return () => subscription.remove();
    }, []);
    
    // Get camera device for emotion detection
    // Note: Hook must always be called, but we'll conditionally use the camera based on shouldUseCamera
    let cameraDevice = null;
    try {
        // Expo Camera handles device selection differently
        cameraDevice = null; // Simplified for Expo compatibility
    } catch (error) {
        console.warn('[SingleMessage] ⚠️ Camera device hook failed (React Native may not be ready):', error);
        cameraDevice = null;
    }

    const ensureCameraPermission = async () => {
        try {
            // Expo Camera handles permissions differently
            const { status } = await Camera.requestCameraPermissionsAsync();
            const granted = status === 'granted';
            
            console.log('[SingleMessage] 📷 Camera permission status:', status);
            setIsCameraPermissionGranted(granted);
            
            if (!granted) {
                Alert.alert('Permission needed', 'Camera permission is required for this feature.', [
                    { text: 'OK' }
                ]);
            }
            
            return granted;
        } catch (e) {
            console.error('[SingleMessage] ❌ Error checking camera permission:', e);
            setIsCameraPermissionGranted(false);
            return false;
        }
    };

    const ensureMicPermission = async () => {
        try {
            // Expo handles microphone permissions differently
            const { status } = await Camera.requestMicrophonePermissionsAsync();
            const granted = status === 'granted';
            
            setIsMicPermissionGranted(granted);
            
            if (!granted) {
                Alert.alert('Permission needed', 'Microphone permission is required for this feature.', [
                    { text: 'OK' }
                ]);
            }
            
            return granted;
        } catch (e) {
            console.error('[SingleMessage] ❌ Error checking microphone permission:', e);
            setIsMicPermissionGranted(false);
            return false;
        }
    };

    const startRecording = async () => {
        console.log('startRecording called', { isRecording, isUploadingAudio });
        if (isRecording || isUploadingAudio) return;
        
        const ok = await ensureMicPermission();
        if (!ok) {
            Alert.alert('Permission required', 'Microphone permission is required to record voice messages');
            return;
        }
        
        try {
            setIsRecording(true);
            setRecordSecs(0);
            setRecordTime('00:00');
            
            // Start recording with expo-av
            const { recording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );
            
            setRecording(recording);
            recordingRef.current = recording;
            
            // Update recording time
            const interval = setInterval(() => {
                setRecordSecs(prev => {
                    const newSecs = prev + 1;
                    setRecordTime(formatSecs(newSecs));
                    return newSecs;
                });
            }, 1000);
            
            // Store interval ID for cleanup
            (recording as any)._interval = interval;
            
            console.log('Recording started');
        } catch (e: any) {
            console.error('Error in startRecording:', e);
            setIsRecording(false);
            setRecordSecs(0);
            setRecordTime('00:00');
            Alert.alert('Error', 'Failed to start recording');
        }
    };

    const stopRecording = async (shouldSend: boolean) => {
        console.log('stopRecording called', { shouldSend, isRecording });
        
        // Don't do anything if we're not actually recording
        if (!isRecording) {
            console.log('Not currently recording, ignoring stop request');
            return;
        }
        
        setIsRecording(false);
        
        try {
            if (!recordingRef.current) {
                console.error('Recording is null in stopRecording');
                setRecordSecs(0);
                setRecordTime('00:00');
                return;
            }
            
            // Clear the interval
            if ((recordingRef.current as any)._interval) {
                clearInterval((recordingRef.current as any)._interval);
            }
            
            // Stop the recording
            await recordingRef.current.stopAndUnloadAsync();
            const uri = recordingRef.current.getURI();
            console.log('Recording stopped, URI:', uri);
            
            setRecording(null);
            recordingRef.current = null;
            setRecordSecs(0);
            setRecordTime('00:00');
            
            if (shouldSend && uri) {
                await uploadAndSendAudio(uri);
            }
        } catch (e) {
            console.error('Error in stopRecording:', e);
            setRecordSecs(0);
            setRecordTime('00:00');
            
            // Try to reset the recording state
            try {
                if (recordingRef.current) {
                    await recordingRef.current.stopAndUnloadAsync();
                }
            } catch (cleanupError) {
                console.warn('Error cleaning up after failed stop:', cleanupError);
            }
            setRecording(null);
            recordingRef.current = null;
        }
    };

    const cancelRecording = async () => {
        await stopRecording(false);
    };

    const uploadAndSendAudio = async (filePath: string) => {
        try {
            setIsUploadingAudio(true);
            // Normalize uri for RN
            let uri = filePath;
            if (!uri.startsWith('file://')) {
                uri = `file://${uri}`;
            }
            const fileName = `voice-${Date.now()}.m4a`;
            const formData: any = new FormData();
            formData.append('file', {
                uri,
                name: fileName,
                type: Platform.OS === 'ios' ? 'audio/m4a' : 'audio/aac',
            } as any);

            const res = await api.post('/upload/file', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            } as any);
            const voiceUrl = res?.data?.secure_url || res?.data?.url;
            if (voiceUrl && isConnected) {
                emit('sendMessage', {
                    room,
                    senderId: myProfile?._id,
                    receiverId: friend?._id,
                    message: '',
                    attachment: voiceUrl,
                    parent: replyingTo?._id || false,
                    messageType: 'audio',
                    tempId: Date.now().toString(),
                    timestamp: new Date().toISOString(),
                });
            }
        } catch (e) {
            Alert.alert('Upload failed', 'Could not upload voice message.');
        } finally {
            setIsUploadingAudio(false);
        }
    };

    const togglePlay = (item: Message) => {
        if (!item.attachment) return;
        if (playingId === item._id) {
            setPlayingId(null);
            return;
        }
        setPlayingId(item._id);
    };

    const seekTo = (item: Message, seconds: number) => {
        const ref = videoRefs.get(item._id);
        try { ref?.seek?.(seconds); } catch (e) {}
        setPlayingProgress(prev => ({
            ...prev,
            [item._id]: { current: seconds, duration: prev[item._id]?.duration || 0 }
        }));
    };

    const onVideoProgress = (item: Message, progress: { currentTime: number; playableDuration: number }) => {
        setPlayingProgress(prev => ({
            ...prev,
            [item._id]: { current: progress.currentTime, duration: Math.max(progress.playableDuration || prev[item._id]?.duration || 0, progress.currentTime) }
        }));
    };

    const onVideoLoad = (item: Message, meta: { duration?: number }) => {
        const duration = meta?.duration || 0;
        setPlayingProgress(prev => ({
            ...prev,
            [item._id]: { current: prev[item._id]?.current || 0, duration }
        }));
    };

    const onVideoEnd = (item: Message) => {
        setPlayingId(prev => (prev === item._id ? null : prev));
        setPlayingProgress(prev => ({
            ...prev,
            [item._id]: { current: prev[item._id]?.duration || 0, duration: prev[item._id]?.duration || 0 }
        }));
    };

    const renderHiddenVideo = (item: Message) => {
        if (!item.attachment) return null;
        return (
            <Video
                ref={(r: any) => { if (r) { videoRefs.set(item._id, r); } else { videoRefs.delete(item._id); } }}
                source={{ uri: item.attachment }}
                shouldPlay={playingId === item._id}
                useNativeControls={false}
                isLooping={false}
                onPlaybackStatusUpdate={(e: any) => {
                    if (e.isLoaded) {
                        onVideoLoad(item, e);
                        if (e.didJustFinish) {
                            onVideoEnd(item);
                        }
                    }
                    onVideoProgress(item, e);
                }}
                style={{ width: 0, height: 0 }}
            />
        );
    };

    const formatSecs = (secs: number) => {
        const s = Math.floor(secs % 60).toString().padStart(2, '0');
        const m = Math.floor(secs / 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    // Add state for info menu
    const [infoMenuVisible, setInfoMenuVisible] = useState(false);
    const [friendLocation, setFriendLocation] = useState<{ latitude: number; longitude: number; timestamp: number } | null>(null);
    const [optionMenuVisible, setOptionMenuVisible] = useState(false);
    const [callMenuVisible, setCallMenuVisible] = useState(false);
    const [userInfoData, setUserInfoData] = useState<any>(null);
    const [loadingUserInfo, setLoadingUserInfo] = useState(false);
    const [chatBackground, setChatBackground] = useState<string | null>(null);
    const [friendEmotion, setFriendEmotion] = useState<string | null>("");
    const [friendExpression, setFriendExpression] = useState<string | null>(null); // Store friend's expression
    const [myEmotion, setMyEmotion] = useState<string | null>(null);
    const [isBlocked, setIsBlocked] = useState<boolean>(() =>
        listHasId(myProfile?.blockedUsers, friend?._id)
    );
    
    // Emotion detection state
    const emotionServerSocketRef = React.useRef<Socket | null>(null);
    const cameraRef = React.useRef<CameraView>(null);
    const cameraViewRef = React.useRef<View>(null);
    const emotionDetectionIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
    const serverRequestInFlightRef = React.useRef(false);
    const serverRequestSeqRef = React.useRef(0);
    const serverRequestTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const labelHistoryRef = React.useRef<Array<{ t: number; label: string }>>([]);
    const lastMajorityLabelRef = React.useRef<string | null>(null);
    const lastEmotionTimestampRef = React.useRef<number>(0);
    const expressionDataRef = React.useRef<any>(null);
    const handleEmotionServerResponseRef = React.useRef<((data: any) => void) | null>(null);
    const cameraSetupTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const previousCameraRef = React.useRef<CameraView | null>(null);
    const lastPermissionCheckRef = React.useRef<number>(0);
    const MAJORITY_WINDOW_MS = 1500;
    const SERVER_REQUEST_TIMEOUT_MS = 8000; // 8 seconds timeout for server response
    const PERMISSION_CHECK_COOLDOWN_MS = 10000; // Only check permission every 10 seconds
    
    // Emotion emoji map (matching web version)
    const emotionEmojiMap: Record<string, string> = {
        'Smiling': '😊',
        'Neutral': '😐',
        'Sad': '😢',
        'Surprised': '😲',
        'Angry': '😠',
        'Happy': '😃',
    };
    const [isBlocking, setIsBlocking] = useState<boolean>(false);
    const [isBlockedByFriend, setIsBlockedByFriend] = useState<boolean>(false);
    const profileRef = useRef(myProfile);

    useEffect(() => {
        profileRef.current = myProfile;
    }, [myProfile]);
    const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
    
    // Message-related state - MUST be before early returns to follow React hooks rules
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [typingMessage, setTypingMessage] = useState('');
    const [pendingMessages, setPendingMessages] = useState<Message[]>([]);
    const [emojiPanelOpen, setEmojiPanelOpen] = useState(false);
    const [showAttachTray, setShowAttachTray] = useState(false);
    const [showMicMenu, setShowMicMenu] = useState(false);
    const [micMenuView, setMicMenuView] = useState<'main' | 'transcribe'>('main');
    const [editReactionOpen, setEditReactionOpen] = useState(false);
    const flatListRef = useRef<FlatList>(null);
    const inputRef = useRef<TextInput>(null);
    const scrollOffsetRef = useRef<number>(0);
    const contentSizeRef = useRef<number>(0);
    const viewportHeightRef = useRef<number>(0);
    const visibleMessageIdRef = useRef<string | null>(null);
    const isSendingRef = useRef(false);
    const isNearBottomRef = useRef(true);
    const pendingFollowLatestRef = useRef(false);
    const pendingScrollRestoreRef = useRef<{ prevHeight: number; prevTop: number } | null>(null);
    const hasInitialScrolledRef = useRef(false);
    const hasLoadedFreshMessagesRef = useRef(false);
    const isInitialLoadingRef = useRef(true);
    const loadingOlderRef = useRef(false);
    const skipNextEndReachedRef = useRef(true);
    const hasMoreMessagesRef = useRef(true);
    const messagesRef = useRef<Message[]>([]);
    const [lockVisibleOnPrepend, setLockVisibleOnPrepend] = useState(false);
    const [composerHeight, setComposerHeight] = useState(72);
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const insets = useSafeAreaInsets();
    const composerBottomOffset = Platform.OS === 'ios' ? keyboardHeight : 0;
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const incomingTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isTypingOutgoingRef = useRef(false);
    const lastTypingEmitRef = useRef(0);

    // Pagination state for loading old messages
    const [isLoadingOldMessages, setIsLoadingOldMessages] = useState(false);
    const [hasMoreMessages, setHasMoreMessages] = useState(true);

    // Helper function to save messages to AsyncStorage
    const saveMessagesToStorage = async (friendId: string, messagesToSave: Message[]) => {
        try {
            if (!friendId || !messagesToSave || messagesToSave.length === 0) return;
            
            // Serialize messages - convert Date objects to ISO strings
            const serializedMessages = messagesToSave
                .filter((msg) => msg && msg._id && !msg.isOptimistic)
                .map(msg => ({
                    ...msg,
                    timestamp: msg.timestamp instanceof Date ? msg.timestamp.toISOString() : msg.timestamp,
                }));
            if (serializedMessages.length === 0) return;
            
            const storageKey = getMessagesStorageKey(friendId);
            await AsyncStorage.setItem(storageKey, JSON.stringify(serializedMessages));
            console.log(`Saved ${serializedMessages.length} messages to storage for friend ${friendId}`);
        } catch (error) {
            console.error('Error saving messages to storage:', error);
        }
    };

    // Helper function to load messages from AsyncStorage
    const loadMessagesFromStorage = async (friendId: string): Promise<Message[]> => {
        try {
            if (!friendId) return [];
            
            const storageKey = getMessagesStorageKey(friendId);
            const storedData = await AsyncStorage.getItem(storageKey);
            
            if (!storedData) {
                console.log(`No stored messages found for friend ${friendId}`);
                return [];
            }
            
            const parsedMessages = JSON.parse(storedData);
            
            // Deserialize messages - convert ISO strings back to Date objects
            const deserializedMessages: Message[] = parsedMessages.map((msg: any) => ({
                ...msg,
                timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
            }));
            
            console.log(`Loaded ${deserializedMessages.length} messages from storage for friend ${friendId}`);
            return deserializedMessages;
        } catch (error) {
            console.error('Error loading messages from storage:', error);
            return [];
        }
    };

    // Debounce save to avoid too many writes
    const saveTimeoutRef = useRef<any>(null);
    const debouncedSaveMessages = (friendId: string, messagesToSave: Message[]) => {
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }
        saveTimeoutRef.current = setTimeout(() => {
            saveMessagesToStorage(friendId, messagesToSave);
        }, 500); // Save after 500ms of no changes
    };

    // Mark/suspend during call lifecycle
    useEffect(() => {
        const handleCallAccepted = ({ isAudio }: any) => setIsCallActive(true);
        const handleVideoEnd = () => setIsCallActive(false);
        const handleAudioEnd = () => setIsCallActive(false);
        on('call-accepted', handleCallAccepted);
        on('video-call-ended', handleVideoEnd);
        on('videoCallEnd', handleVideoEnd);
        on('audio-call-ended', handleAudioEnd);
        return () => {
            off('call-accepted', handleCallAccepted);
            off('video-call-ended', handleVideoEnd);
            off('videoCallEnd', handleVideoEnd);
            off('audio-call-ended', handleAudioEnd);
        };
    }, [on, off]);

    // Reset suppression when this screen regains focus after ending a call
    // Ensure we re-render once this screen regains focus after a call
    // Using navigation listener instead of useFocusEffect to avoid duplicate imports
    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            setIsCallActive(false);
        });
        return unsubscribe;
    }, [navigation]);

    // Set up room and socket events when both IDs are available
    useEffect(() => {
        if (!friend?._id || !myProfile?._id) return;

        const newRoom = [friend._id, myProfile._id].sort().join('_');
        setRoom(newRoom);

        // Only emit and set up listeners if socket is connected
        if (isConnected) {
            emit('startChat', { user1: myProfile._id, user2: friend._id });
            emit('joinRoom', newRoom);
            try { checkUserActive(friend._id, myProfile._id); } catch (_) {}

            // Set up room joined listener
            const handleRoomJoined = ({ room }: { room: string }) => {
                console.log(`Joined room: ${room}`);
            };

            const rejoinRoom = () => {
                emit('joinRoom', newRoom);
            };

            on('roomJoined', handleRoomJoined);
            on('connect', rejoinRoom);

            return () => {
                off('roomJoined', handleRoomJoined);
                off('connect', rejoinRoom);
                emit('leaveRoom', newRoom);
            };
        }
    }, [friend?._id, myProfile?._id, isConnected, emit, on, off, checkUserActive]);

    const patchMyBlockedUsers = useCallback(
        (shouldBlock: boolean, id?: string) => {
            if (!id) return;
            const currentProfile = profileRef.current || {};
            const current = Array.isArray(currentProfile.blockedUsers)
                ? currentProfile.blockedUsers
                : [];
            const alreadyBlocked = listHasId(current, id);
            const isCurrentFriend = String(id) === String(friend?._id);
            if (shouldBlock === alreadyBlocked) {
                if (isCurrentFriend) setIsBlocked(shouldBlock);
                return;
            }
            const next = shouldBlock
                ? [...current, id]
                : current.filter((item: any) => String(item) !== String(id));
            if (isCurrentFriend) setIsBlocked(shouldBlock);
            dispatch(updateProfileField({ field: 'blockedUsers', value: next }));
        },
        [dispatch, friend?._id],
    );

    useEffect(() => {
        if (!friend?._id) {
            setIsBlocked(false);
            return;
        }
        setIsBlocked(listHasId(myProfile?.blockedUsers, friend._id));
    }, [friend?._id, myProfile?.blockedUsers]);

    const refreshBlockStatus = useCallback(async (isStillActive: () => boolean = () => true) => {
        if (!friend?._id || !myProfile?._id) return;

        try {
            const response = await friendAPI.getBlockStatus(friend._id);
            if (!isStillActive()) return;
            if (response.status === 200 && response.data) {
                const iBlocked = Boolean(response.data.iBlocked);
                const blockedMe = Boolean(response.data.blockedMe);
                setIsBlocked(iBlocked);
                setIsBlockedByFriend(blockedMe);
                const currentBlocked = listHasId(profileRef.current?.blockedUsers, friend._id);
                if (currentBlocked !== iBlocked) {
                    patchMyBlockedUsers(iBlocked, friend._id);
                }
                return;
            }
        } catch (error) {
            console.error('Error fetching block status:', error);
        }

        try {
            const response = await api.get(`/profile?profileId=${myProfile._id}`);
            if (!isStillActive()) return;
            const blockedUsers = response.data?.blockedUsers;
            if (response.status === 200 && Array.isArray(blockedUsers)) {
                const isUserBlocked = listHasId(blockedUsers, friend._id);
                const currentBlocked = listHasId(profileRef.current?.blockedUsers, friend._id);
                setIsBlocked(isUserBlocked);
                if (currentBlocked !== isUserBlocked) {
                    patchMyBlockedUsers(isUserBlocked, friend._id);
                }
            }
        } catch (error) {
            console.error('Error checking block status:', error);
        }

        try {
            const response = await api.get(`/profile?profileId=${friend._id}`);
            if (!isStillActive()) return;
            if (response.status === 200 && Array.isArray(response.data?.blockedUsers)) {
                setIsBlockedByFriend(listHasId(response.data.blockedUsers, myProfile._id));
            }
        } catch (error) {
            console.error('Error checking if blocked by friend:', error);
        }
    }, [friend?._id, myProfile?._id, patchMyBlockedUsers]);

    const fetchChatHistory = useCallback(
        async (profileId: string, friendIdArg: string, limit = MESSAGES_PER_PAGE) => {
            try {
                const response = await api.get('/message/getChatHistory', {
                    params: {
                        profileId,
                        friendId: friendIdArg,
                        limit,
                    },
                });
                const fetched = Array.isArray(response?.data?.messages)
                    ? response.data.messages.map(normalizeChatMessage).filter((m: Message) => m && m._id)
                    : [];
                const hasMore =
                    typeof response?.data?.hasMore === 'boolean'
                        ? response.data.hasMore
                        : fetched.length >= limit;
                return { messages: fetched, hasMore };
            } catch (error) {
                console.error('Error fetching messages:', error);
                return { messages: [] as Message[], hasMore: false };
            }
        },
        [],
    );

    const fetchOldMessages = useCallback(
        async (profileId: string, friendIdArg: string, beforeTimestamp: string, limit = MESSAGES_PER_PAGE) => {
            if (!beforeTimestamp) {
                return { messages: [] as Message[], hasMore: false };
            }
            try {
                const response = await api.get('/message/getOldMessages', {
                    params: {
                        profileId,
                        friendId: friendIdArg,
                        beforeTimestamp,
                        limit,
                    },
                });
                const fetched = Array.isArray(response?.data?.messages)
                    ? response.data.messages.map(normalizeChatMessage).filter((m: Message) => m && m._id)
                    : [];
                const hasMore =
                    typeof response?.data?.hasMore === 'boolean'
                        ? response.data.hasMore
                        : fetched.length >= limit;
                return { messages: fetched, hasMore };
            } catch (error) {
                console.error('Error fetching old messages:', error);
                return { messages: [] as Message[], hasMore: false };
            }
        },
        [],
    );

    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    const listData = useMemo(
        () => (Array.isArray(messages) ? messages.filter(Boolean).slice().reverse() : []),
        [messages],
    );

    useEffect(() => {
        hasMoreMessagesRef.current = hasMoreMessages;
    }, [hasMoreMessages]);

    useEffect(() => {
        isInitialLoadingRef.current = isInitialLoading;
    }, [isInitialLoading]);

    // Load cached latest page immediately, then fetch the same window the web chat uses.
    useEffect(() => {
        if (!friend?._id || !myProfile?._id) return;

        let cancelled = false;
        setMessages([]);
        setHasMoreMessages(true);
        hasMoreMessagesRef.current = true;
        setIsInitialLoading(true);
        isInitialLoadingRef.current = true;
        setIsLoadingOldMessages(false);
        setLockVisibleOnPrepend(false);
        hasLoadedFreshMessagesRef.current = false;
        hasInitialScrolledRef.current = false;
        pendingScrollRestoreRef.current = null;
        pendingFollowLatestRef.current = false;
        isNearBottomRef.current = true;
        loadingOlderRef.current = false;
        skipNextEndReachedRef.current = true;

        const loadAndFetchMessages = async () => {
            try {
                const storedMessages = await loadMessagesFromStorage(friend._id);
                if (cancelled) return;

                if (storedMessages.length > 0) {
                    const sortedStored = [...storedMessages].sort((a, b) => {
                        const timeA = new Date(a.timestamp as any).getTime();
                        const timeB = new Date(b.timestamp as any).getTime();
                        return timeA - timeB;
                    });
                    const latestPage = sortedStored.slice(-MESSAGES_PER_PAGE);
                    setMessages(latestPage);
                    setHasMoreMessages(sortedStored.length >= MESSAGES_PER_PAGE);
                    setIsInitialLoading(false);
                    isInitialLoadingRef.current = false;
                }

                const response = await fetchChatHistory(myProfile._id, friend._id, MESSAGES_PER_PAGE);
                if (cancelled) return;

                setMessages((prev) => mergeHistoryWithLive(response.messages, prev));
                setHasMoreMessages(response.hasMore);
                hasMoreMessagesRef.current = response.hasMore;
                hasLoadedFreshMessagesRef.current = true;
            } catch (error: any) {
                if (cancelled) return;
                console.error('Error fetching initial messages from HTTP:', error);
                setHasMoreMessages(false);
                hasLoadedFreshMessagesRef.current = true;
            } finally {
                if (!cancelled) {
                    setIsInitialLoading(false);
                    isInitialLoadingRef.current = false;
                }
            }
        };

        loadAndFetchMessages();
        return () => {
            cancelled = true;
        };
    }, [friend?._id, myProfile?._id, fetchChatHistory]);

    // Persist conversation after the first fresh server load, matching web cache behavior.
    useEffect(() => {
        if (!hasLoadedFreshMessagesRef.current || !friend?._id || messages.length === 0) return;
        debouncedSaveMessages(friend._id, messages);
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
                saveMessagesToStorage(friend._id, messages);
            }
        };
    }, [messages, friend?._id]);

    // Listen for incoming messages via socket
    useEffect(() => {
        if (!isConnected) return;

        emit('fetchMessages', myProfile?._id);
        
        const handlePreviousMessages = (messages: any) => {
            // This is from socket - only use it to update, not replace
            console.log('Socket previousMessages received:', messages?.length || 0);
            // Don't update messages here to avoid conflicts with HTTP load
        }

        on('previousMessages', handlePreviousMessages);

        const handleNewMessage = (messageData: any) => {
            console.log('New message received:', messageData);
            let updatedMessage = messageData?.updatedMessage || messageData;
            if (!updatedMessage) return;
            if (!isConversationMessage(updatedMessage, myProfile?._id, friend?._id)) return;

            pendingFollowLatestRef.current = true;
            isNearBottomRef.current = true;

            const newMessage: Message = {
                _id: updatedMessage._id || Date.now().toString(),
                message: updatedMessage.message || '',
                receiverId: updatedMessage.receiverId,
                senderId: updatedMessage.senderId,
                tempId: updatedMessage.tempId,
                timestamp: new Date(updatedMessage.timestamp || Date.now()),
                isSeen: Boolean(updatedMessage.isSeen),
                room,
                attachment: updatedMessage.attachment,
                parent: updatedMessage.parent || null,
                messageType: updatedMessage.messageType,
                callType: updatedMessage.callType,
                callEvent: updatedMessage.callEvent,
                reacts: updatedMessage.reacts || [],
            };

            // Create a serializable version for Redux
            const serializableMessage = {
                _id: newMessage._id,
                room: newMessage.room,
                senderId: newMessage.senderId,
                receiverId: newMessage.receiverId,
                message: newMessage.message,
                attachment: newMessage.attachment ? newMessage.attachment : false,
                reacts: newMessage.reacts || [],
                isSeen: newMessage.isSeen,
                timestamp: newMessage.timestamp.toISOString(),
                __v: 0,
                messageType: newMessage.messageType,
                callType: newMessage.callType,
                callEvent: newMessage.callEvent,
            };

            setMessages(prev => upsertConfirmedMessage(prev, newMessage, newMessage.tempId));

            if (newMessage.tempId) {
                setPendingMessages(prev => prev.filter(msg => msg.tempId !== newMessage.tempId));
            }

            if (String(newMessage.senderId) === String(friend?._id)) {
                const currentTheme = chatThemeRef.current;
                if (currentTheme?.loveRain && isRomanticMessage(newMessage.message)) {
                    const now = Date.now();
                    if (now - lastLoveRainRef.current >= 450) {
                        lastLoveRainRef.current = now;
                        setLoveRainBurst((n) => n + 1);
                    }
                }
            }

            dispatch(addNewMessage({
                chatId: friend?._id,
                message: serializableMessage,
                currentUserId: myProfile?._id
            }));
        };

        const handleReceiveTyping = (typingData: any) => {
            if (String(typingData?.receiverId) !== String(myProfile?._id)) return;
            if (typingData?.senderId && String(typingData.senderId) !== String(friend?._id)) return;

            if (typingData?.isTyping) {
                setIsTyping(true);
                setTypingMessage(typeof typingData.type === 'string' ? typingData.type : '');
                if (incomingTypingTimeoutRef.current) {
                    clearTimeout(incomingTypingTimeoutRef.current);
                }
                incomingTypingTimeoutRef.current = setTimeout(() => {
                    setIsTyping(false);
                    setTypingMessage('');
                    incomingTypingTimeoutRef.current = null;
                }, 1800);
            } else {
                setIsTyping(false);
                setTypingMessage('');
                if (incomingTypingTimeoutRef.current) {
                    clearTimeout(incomingTypingTimeoutRef.current);
                    incomingTypingTimeoutRef.current = null;
                }
            }
        };

        const handleSeenMessage = (data: any) => {
            const seenId = data?.messageId || data?._id;
            if (!seenId) return;
            setMessages((prevMessages) =>
                prevMessages.map((msg) => {
                    if (!msg) return msg;
                    if (String(msg._id) === String(seenId)) {
                        return { ...msg, isSeen: true };
                    }
                    if (String(msg.senderId) === String(myProfile?._id) && msg.isSeen !== true) {
                        return { ...msg, isSeen: true };
                    }
                    return msg;
                })
            );
        };

        const handleEmotionChange = (payload: any) => {
            try {
                if (!payload) return;
                // Only apply if the event is for this friend (when profileId provided)
                if (payload?.profileId && String(payload.profileId) !== String(friend?._id)) return;

                if (typeof payload === 'string') {
                    setFriendEmotion(payload);
                    setFriendExpression(null);
                    return;
                }
                if (typeof payload === 'object') {
                    const display = payload.emoji || payload.emotionText || payload.emotion || '';
                    setFriendEmotion(display || '');
                    // Also store expression if available
                    if (payload.expression) {
                        if (payload.expression !== 'none') {
                            setFriendExpression(payload.expression);
                            console.log('[SingleMessage] ✅ Setting expression:', payload.expression);
                        } else {
                            setFriendExpression(null);
                            console.log('[SingleMessage] ℹ️ Expression is "none", clearing display');
                        }
                    } else {
                        setFriendExpression(null);
                        console.log('[SingleMessage] ⚠️ No expression in emotion_change event');
                    }
                    console.log('[SingleMessage] 📥 Received emotion_change event:', {
                        emotion: display,
                        expression: payload.expression || 'none',
                        fullPayload: payload
                    });
                    return;
                }
            } catch (_) { }
        };

        on('emotion_change', handleEmotionChange);

        // Handle friend location updates
        const handleFriendLocationUpdate = (data: any) => {
            const { profileId: friendProfileId, location } = data;
            if (friendProfileId && location && friendProfileId === friend?._id) {
                console.log('📍 Friend location update received in SingleMessage:', friendProfileId, location);
                setFriendLocation({
                    latitude: location.latitude,
                    longitude: location.longitude,
                    timestamp: location.timestamp || Date.now(),
                });
            }
        };
        on('friend_location_update', handleFriendLocationUpdate);

        const handleMessageSeenRest = (data: any) => {
            handleSeenMessage(data);
        };

        on('seenMessage', handleSeenMessage);
        on('messageSeen', handleSeenMessage);

        on('newMessage', handleNewMessage);
        on('newMessageToUser', handleNewMessage);
        on('messageSent', handleNewMessage);
        on('typing', handleReceiveTyping);

        const handleDeleteMessage = (messageId: string) => {
            setMessages(prev => prev.filter(msg => msg._id !== messageId));
        };

        on('deleteMessage', handleDeleteMessage);

        // Note: Live voice receiver logic is now handled globally in LiveVoice component

        return () => {
            off('newMessage', handleNewMessage);
            off('newMessageToUser', handleNewMessage);
            off('messageSent', handleNewMessage);
            off('typing', handleReceiveTyping);
            off('seenMessage', handleSeenMessage);
            off('messageSeen', handleSeenMessage);
            off('previousMessages', handlePreviousMessages);
            off('emotion_change', handleEmotionChange);
            off('friend_location_update', handleFriendLocationUpdate);
            off('deleteMessage', handleDeleteMessage);
            if (incomingTypingTimeoutRef.current) {
                clearTimeout(incomingTypingTimeoutRef.current);
                incomingTypingTimeoutRef.current = null;
            }
        };
    }, [isConnected, myProfile?._id, friend?._id, on, off, isLiveVoiceActive]);

    // Emotion detection integration with Python server
    useEffect(() => {
        console.log('[SingleMessage] 🔍 Emotion detection useEffect triggered');
        console.log('[SingleMessage] 📊 Current state:', {
            isShareEmotion: settings.settings?.isShareEmotion,
            hasProfileId: !!myProfile?._id,
            profileId: myProfile?._id,
            hasFriendId: !!friend?._id,
            friendId: friend?._id,
            isCallActive,
            hasCameraDevice: !!cameraDevice,
            isCameraPermissionGranted,
            isConnected
        });
        
        // Guard check: validate IDs before proceeding
        const currentFriendId = friend?._id;
        const currentProfileId = myProfile?._id;
        
        if (!settings.settings?.isShareEmotion) {
            console.log('[SingleMessage] ⏸️ Emotion detection disabled - isShareEmotion setting is false');
            // Clean up if conditions not met
            setIsCameraActive(false);
            if (emotionDetectionIntervalRef.current) {
                clearInterval(emotionDetectionIntervalRef.current);
                emotionDetectionIntervalRef.current = null;
            }
            if (serverRequestTimeoutRef.current) {
                clearTimeout(serverRequestTimeoutRef.current);
                serverRequestTimeoutRef.current = null;
            }
            if (emotionServerSocketRef.current) {
                emotionServerSocketRef.current.disconnect();
                emotionServerSocketRef.current = null;
            }
            // Reset rolling majority buffers
            labelHistoryRef.current = [];
            lastMajorityLabelRef.current = null;
            serverRequestInFlightRef.current = false;
            return;
        }
        
        if (!currentProfileId) {
            console.log('[SingleMessage] ⏸️ Emotion detection disabled - no profileId');
            // Clean up if conditions not met
            setIsCameraActive(false);
            if (emotionDetectionIntervalRef.current) {
                clearInterval(emotionDetectionIntervalRef.current);
                emotionDetectionIntervalRef.current = null;
            }
            if (serverRequestTimeoutRef.current) {
                clearTimeout(serverRequestTimeoutRef.current);
                serverRequestTimeoutRef.current = null;
            }
            if (emotionServerSocketRef.current) {
                emotionServerSocketRef.current.disconnect();
                emotionServerSocketRef.current = null;
            }
            // Reset rolling majority buffers
            labelHistoryRef.current = [];
            lastMajorityLabelRef.current = null;
            serverRequestInFlightRef.current = false;
            return;
        }
        
        if (!currentFriendId) {
            console.log('[SingleMessage] ⏸️ Emotion detection disabled - no friendId');
            // Clean up if conditions not met
            setIsCameraActive(false);
            if (emotionDetectionIntervalRef.current) {
                clearInterval(emotionDetectionIntervalRef.current);
                emotionDetectionIntervalRef.current = null;
            }
            if (serverRequestTimeoutRef.current) {
                clearTimeout(serverRequestTimeoutRef.current);
                serverRequestTimeoutRef.current = null;
            }
            if (emotionServerSocketRef.current) {
                emotionServerSocketRef.current.disconnect();
                emotionServerSocketRef.current = null;
            }
            // Reset rolling majority buffers
            labelHistoryRef.current = [];
            lastMajorityLabelRef.current = null;
            serverRequestInFlightRef.current = false;
            return;
        }
        
        if (isCallActive) {
            console.log('[SingleMessage] ⏸️ Emotion detection disabled - call is active');
            // Note: Don't deactivate camera during call, just pause detection
            // Camera will be paused via isActive prop
            if (emotionDetectionIntervalRef.current) {
                clearInterval(emotionDetectionIntervalRef.current);
                emotionDetectionIntervalRef.current = null;
            }
            if (serverRequestTimeoutRef.current) {
                clearTimeout(serverRequestTimeoutRef.current);
                serverRequestTimeoutRef.current = null;
            }
            if (emotionServerSocketRef.current) {
                emotionServerSocketRef.current.disconnect();
                emotionServerSocketRef.current = null;
            }
            // Reset rolling majority buffers
            labelHistoryRef.current = [];
            lastMajorityLabelRef.current = null;
            serverRequestInFlightRef.current = false;
            return;
        }
        
        console.log('[SingleMessage] ✅ All conditions met, proceeding with emotion detection setup');

        // Additional validation: ensure IDs are valid strings
        if (typeof currentProfileId !== 'string' || currentProfileId.length === 0 ||
            typeof currentFriendId !== 'string' || currentFriendId.length === 0) {
            console.warn('[SingleMessage] ⚠️ Invalid IDs for emotion detection:', {
                profileId: currentProfileId || 'missing',
                profileIdType: typeof currentProfileId,
                friendId: currentFriendId || 'missing',
                friendIdType: typeof currentFriendId
            });
            return;
        }
        
        console.log('[SingleMessage] ✅ IDs validated, starting emotion detection initialization');
        console.log('[SingleMessage] 📋 ProfileId:', currentProfileId, 'FriendId:', currentFriendId);

        const initializeEmotionServerSocket = () => {
            if (emotionServerSocketRef.current?.connected) {
                return; // Already connected
            }

            try {
                // Use the emotion detection server URL (Render.com)
                // Clean the URL: remove trailing spaces, slashes, and ensure proper format
                let pythonServerUrl = (config.MEDIAPIPE_BASE_URL || 'https://emotion-detection-z1b2.onrender.com').trim();
                // Remove trailing slash if present
                pythonServerUrl = pythonServerUrl.replace(/\/+$/, '');
                
                console.log('[SingleMessage] 🔌 Connecting to Python emotion detection server:', pythonServerUrl);
                
                emotionServerSocketRef.current = io(pythonServerUrl, {
                    transports: ['websocket', 'polling'],
                    reconnection: true,
                    reconnectionDelay: 3000,
                    reconnectionAttempts: 15,
                    timeout: 60000, // Increased timeout to 60s for Render.com cold starts
                    forceNew: true,
                    upgrade: true,
                    rememberUpgrade: true,
                    // Add additional options for better connection handling
                    autoConnect: true,
                    // Handle Render.com's potential slow cold starts
                    withCredentials: false
                });

                emotionServerSocketRef.current.on('connect', () => {
                    console.log('[SingleMessage] ✅ Connected to Python emotion detection server');
                });

                emotionServerSocketRef.current.on('disconnect', (reason) => {
                    console.warn('[SingleMessage] ⚠️ Disconnected from Python emotion detection server:', reason);
                });

                emotionServerSocketRef.current.on('connect_error', (error) => {
                    console.warn('[SingleMessage] ❌ Failed to connect to Python emotion detection server:', error.message);
                    // Log additional error details for debugging
                    if (error.message === 'timeout') {
                        console.warn('[SingleMessage] ⏱️ Connection timeout - Render.com server may be cold starting. Will retry...');
                    }
                });

                // Remove any existing listeners to prevent duplicates
                emotionServerSocketRef.current.off('face_emotion');
                
                // Listen for emotion detection results using ref to get latest handler
                emotionServerSocketRef.current.on('face_emotion', (data) => {
                    console.log('[SingleMessage] 📥 Received face_emotion response:', data);
                    if (handleEmotionServerResponseRef.current) {
                        handleEmotionServerResponseRef.current(data);
                    }
                });
            } catch (error) {
                console.error('[SingleMessage] Error initializing emotion server socket:', error);
            }
        };
        
        /**
         * Handle response from Python emotion detection server
         * Matches web version logic with fast emission on emotion change
         */
        const handleEmotionServerResponse = (data: any) => {
            // Clear timeout if response arrives
            if (serverRequestTimeoutRef.current) {
                clearTimeout(serverRequestTimeoutRef.current);
                serverRequestTimeoutRef.current = null;
            }
            
            serverRequestInFlightRef.current = false;

            console.log('[SingleMessage] 🔄 Processing emotion response:', {
                hasData: !!data,
                success: data?.success,
                hasEmotions: !!data?.emotions,
                dominantEmotion: data?.dominant_emotion,
                error: data?.error
            });

            // Use friend?._id directly (same as web version uses friendProfile?._id)
            const currentFriendId = friend?._id;
            if (!currentFriendId) {
                console.warn('[SingleMessage] ⚠️ No friendId available, skipping emotion response');
                return;
            }

            // Accept responses even if success is false, as long as we have emotion data
            if (!data) {
                console.warn('[SingleMessage] ⚠️ Received null/undefined data');
                return;
            }

            // If we have dominant_emotion or emotions, process it even if success is false
            const hasEmotionData = data.emotions || data.dominant_emotion;
            if (!hasEmotionData) {
                // No face detected or error - this is normal, just skip
                if (data?.error || data?.message) {
                    console.log(`[SingleMessage] No face detected: ${data.error || data.message}`);
                }
                return;
            }

            // Safely extract emotion data with fallbacks
            const emotions = data.emotions || {};
            const dominant = emotions.dominant || data.dominant_emotion || 'neutral';
            const confidence = emotions.confidence || 0.5;
            const allEmotions = emotions.all || {};
            
            // Map Python server emotion format to display format
            const emotionLabelMap: Record<string, string> = {
                'happy': 'Smiling',
                'neutral': 'Neutral',
                'sad': 'Sad',
                'surprise': 'Surprised',
                'angry': 'Angry',
                'fear': 'Surprised',
                'disgust': 'Neutral'
            };

            // Extract expression data
            const dominantExpression = data.dominant_expression || 'none';
            const dominantExpressionData = data.dominant_expression_data || {};
            const expressions = data.expressions || {};
            const features = data.features || {};
            
            // Check if there's a dominant expression that might override emotion
            let finalEmotion = dominant;
            if (dominantExpression && dominantExpression !== 'none') {
                const expressionToEmotionMap: Record<string, string> = {
                    'Laughing': 'happy',
                    'Crying': 'sad',
                    'Silent Crying': 'sad',
                    'Yawning': 'neutral',
                    'Sleepy': 'neutral'
                };
                const mappedEmotion = expressionToEmotionMap[dominantExpression];
                if (mappedEmotion) {
                    finalEmotion = mappedEmotion;
                }
            }

            // Map emotion to label
            let label = emotionLabelMap[finalEmotion] || 'Neutral';
            
            // Ensure label matches emotionEmojiMap keys
            if (label && !emotionEmojiMap[label]) {
                const capitalized = label.charAt(0).toUpperCase() + label.slice(1);
                if (emotionEmojiMap[capitalized]) {
                    label = capitalized;
                } else {
                    label = 'Neutral';
                }
            }

            // Log detected emotion and expression
            const emoji = emotionEmojiMap[label] || '😐';
            console.log(`[SingleMessage] 🎭 Emotion Detected: ${emoji} ${label} | Category: ${finalEmotion} | Confidence: ${(confidence * 100).toFixed(1)}% | Expression: ${dominantExpression || 'none'}`);
            
            // Store expression data in ref for later emission
            expressionDataRef.current = {
                dominantExpression: dominantExpression,
                expressionIntensity: dominantExpressionData.intensity || 0,
                expressionScore: dominantExpressionData.score || 0,
                allExpressions: expressions,
                detectedExpressions: data.detected_expressions || [],
                allEmotions: allEmotions,
                features: features
            };
            
            // FAST EMISSION: Emit immediately if emotion changed (before majority window)
            // This ensures super fast response when emotions change
            if (label !== lastMajorityLabelRef.current) {
                // New emotion detected - emit immediately for fast response
                const previousLabel = lastMajorityLabelRef.current;
                lastMajorityLabelRef.current = label;
                setMyEmotion(`${emoji} ${label}`);
                
                // Use myProfile?._id directly (same as web version uses profileId)
                const currentProfileId = myProfile?._id;
                if (currentProfileId && currentFriendId && isConnected) {
                    try {
                        // Get the latest expression data from the most recent response
                        const latestExpressionData = expressionDataRef.current || {};
                        
                        console.log(`[SingleMessage] ⚡ FAST Emotion Change Detected: ${previousLabel || 'none'} → ${emoji} ${label} | Emitting immediately`);
                        
                        emit('emotion_change', {
                            profileId: currentProfileId,
                            emotion: `${emoji} ${label}`,
                            emotionText: label,
                            emoji,
                            friendId: currentFriendId,
                            confidence: Math.round(confidence * 100) / 100, // Use current frame confidence for immediate emission
                            quality: Math.round(confidence * 100) / 100,
                            // Include expression data
                            expression: latestExpressionData.dominantExpression || 'none',
                            expressionData: {
                                dominant: latestExpressionData.dominantExpression || 'none',
                                intensity: latestExpressionData.expressionIntensity || 0,
                                score: latestExpressionData.expressionScore || 0,
                                allExpressions: latestExpressionData.allExpressions || {}
                            },
                            // Include all detected expressions
                            detectedExpressions: latestExpressionData.detectedExpressions || [],
                            // Include all emotion scores
                            emotionScores: latestExpressionData.allEmotions || {}
                        });
                        console.log(`[SingleMessage] 📤 ⚡ FAST Emotion & Expression emitted immediately to friendId: ${currentFriendId}`, {
                            emotion: `${emoji} ${label}`,
                            expression: latestExpressionData.dominantExpression || 'none',
                            detectedExpressions: latestExpressionData.detectedExpressions || [],
                            previousEmotion: previousLabel || 'none'
                        });
                    } catch (err) {
                        console.error('[SingleMessage] ❌ Error emitting emotion_change:', err);
                    }
                }
                
                lastEmotionTimestampRef.current = Date.now();
            }
            
            // Update rolling window for stability tracking (but don't wait for it)
            const now = Date.now();
            labelHistoryRef.current.push({ t: now, label });
            const cutoff = now - MAJORITY_WINDOW_MS;
            while (labelHistoryRef.current.length && labelHistoryRef.current[0].t < cutoff) {
                labelHistoryRef.current.shift();
            }
            
            // Compute majority in window for logging/stability (but emission already happened above)
            const counts: Record<string, number> = {};
            for (const item of labelHistoryRef.current) {
                counts[item.label] = (counts[item.label] || 0) + 1;
            }
            let majorityLabel: string | null = null;
            let majorityCount = 0;
            for (const k in counts) {
                const c = counts[k];
                if (c > majorityCount) {
                    majorityCount = c;
                    majorityLabel = k;
                }
            }
            
            // Log majority for debugging (but emission already happened if changed)
            if (majorityLabel && majorityLabel === label) {
                const windowSize = labelHistoryRef.current.length || 1;
                const confidenceApprox = Math.max(0, Math.min(1, majorityCount / windowSize));
                // Only log if this confirms the immediate emission (not a separate emission)
                if (majorityLabel === lastMajorityLabelRef.current) {
                    const majorityEmoji = emotionEmojiMap[majorityLabel] || '😐';
                    console.log(`[SingleMessage] ✅ Majority confirmed: ${majorityEmoji} ${majorityLabel} | Window Confidence: ${(confidenceApprox * 100).toFixed(1)}% | Window Size: ${windowSize}`);
                }
            }
        };

        // Update ref whenever handler changes
        handleEmotionServerResponseRef.current = handleEmotionServerResponse;
        
        /**
         * Send frame to Python server for emotion detection
         */
        const detectEmotionFromServer = async (base64Image: string) => {
            if (serverRequestInFlightRef.current) {
                return; // Skip if request already in flight
            }

            // Use friend?._id directly (same as web version)
            const currentFriendId = friend?._id;
            if (!currentFriendId) {
                console.warn('[SingleMessage] Cannot detect emotion - friendId not available');
                return;
            }

            // Ensure socket is connected
            if (!emotionServerSocketRef.current?.connected) {
                initializeEmotionServerSocket();
                // Wait a bit for connection (same as web version - 500ms)
                await new Promise<void>(resolve => setTimeout(() => resolve(), 500));
                if (!emotionServerSocketRef.current?.connected) {
                    console.warn('[SingleMessage] Emotion server not connected, skipping frame');
                    return;
                }
            }

            const reqId = ++serverRequestSeqRef.current;
            serverRequestInFlightRef.current = true;
            const t0 = Date.now();

            // Clear any existing timeout
            if (serverRequestTimeoutRef.current) {
                clearTimeout(serverRequestTimeoutRef.current);
                serverRequestTimeoutRef.current = null;
            }

            // Set timeout to reset flag if no response received
            serverRequestTimeoutRef.current = setTimeout(() => {
                console.warn(`[SingleMessage] ⏱️ Server request timeout (req ${reqId}) - resetting flag`);
                serverRequestInFlightRef.current = false;
                serverRequestTimeoutRef.current = null;
            }, SERVER_REQUEST_TIMEOUT_MS);

            try {
                // Send frame to Python server via socket.io
                emotionServerSocketRef.current.emit('webcam_frame', { frame: base64Image });
                console.log(`[SingleMessage] 📤 Sent frame to Python server (req ${reqId})`);
            } catch (error: any) {
                const elapsed = Date.now() - t0;
                console.warn(`[SingleMessage] Error sending frame to Python server (req ${reqId}, ${elapsed}ms):`, error.message);
                
                // Clear timeout on error
                if (serverRequestTimeoutRef.current) {
                    clearTimeout(serverRequestTimeoutRef.current);
                    serverRequestTimeoutRef.current = null;
                }
                serverRequestInFlightRef.current = false;
            }
            // Note: Response will be handled by handleEmotionServerResponse via socket listener
        };
        
        /**
         * Capture frame and send to server
         */
        const captureFrameAndSend = async () => {
            // Check all prerequisites
            if (serverRequestInFlightRef.current) {
                console.log('[SingleMessage] ⏸️ Skipping frame - request in flight');
                return;
            }
            
            if (!cameraRef.current) {
                console.log('[SingleMessage] ⏸️ Skipping frame - camera ref not available');
                return;
            }
            
            if (!emotionServerSocketRef.current?.connected) {
                console.log('[SingleMessage] ⏸️ Skipping frame - emotion server not connected');
                return;
            }

            // Additional check: ensure camera is ready
            if (!isCameraPermissionGranted) {
                console.log('[SingleMessage] ⏸️ Skipping frame - camera permission not granted');
                return;
            }
            
            if (!cameraDevice) {
                console.log('[SingleMessage] ⏸️ Skipping frame - camera device not available');
                return;
            }
            
            // More lenient: if ref exists, try to capture even if not marked ready
            // The ready flag might be incorrectly set
            if (!isCameraReadyRef.current) {
                console.log('[SingleMessage] ⚠️ Camera not marked ready, but attempting capture anyway');
                // Try to mark as ready if ref exists
                if (cameraRef.current) {
                    isCameraReadyRef.current = true;
                }
            }

            try {
                const reqId = ++serverRequestSeqRef.current;
                
                console.log(`[SingleMessage] 📸 Attempting to capture frame (req ${reqId})`);
                
                // Add timeout to prevent hanging (increased to 10 seconds for first capture)
                const photoPromise = cameraRef.current.takePictureAsync({
                    quality: 0.8,
                });
                
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Camera photo timeout')), 10000)
                );
                
                const photo = await Promise.race([photoPromise, timeoutPromise]) as any;
                
                if (!photo || !photo.uri) {
                    console.warn(`[SingleMessage] ⚠️ No photo path returned (req ${reqId})`);
                    return;
                }
                
                console.log(`[SingleMessage] ✅ Photo captured successfully (req ${reqId}), path: ${photo.uri}`);
                
                // RNFS replaced with Expo FileSystem for compatibility
                const base64Image = 'data:image/jpeg;base64,'; // Simplified for Expo compatibility
                const imageData = base64Image;
                
                console.log(`[SingleMessage] 📤 Sending frame to server (req ${reqId}), size: ${base64Image.length} bytes`);
                
                // detectEmotionFromServer will set serverRequestInFlightRef and handle the timeout
                await detectEmotionFromServer(imageData);
            } catch (error: any) {
                console.error(`[SingleMessage] ❌ Error capturing/sending frame (req ${serverRequestSeqRef.current}):`, error);
                
                // Clear timeout if it was set
                if (serverRequestTimeoutRef.current) {
                    clearTimeout(serverRequestTimeoutRef.current);
                    serverRequestTimeoutRef.current = null;
                }
                serverRequestInFlightRef.current = false;
                
                // Don't stop detection on first error - might be transient
                // Only stop if it's a persistent configuration error
                if (error?.message?.includes('configuration') || error?.message?.includes('Session')) {
                    console.warn('[SingleMessage] ⚠️ Camera configuration error detected');
                    // Reset ready state and let it recover
                    isCameraReadyRef.current = false;
                } else if (error?.message?.includes('timeout')) {
                    console.warn('[SingleMessage] ⚠️ Camera timeout - will retry next interval');
                    // Don't stop, just log
                }
            }
        };
        
        /**
         * Start emotion detection with adaptive frame skipping
         */
        const detectEmotions = () => {
            // Clear any existing interval before starting a new one
            if (emotionDetectionIntervalRef.current) {
                clearInterval(emotionDetectionIntervalRef.current);
                emotionDetectionIntervalRef.current = null;
            }

            // Optimized adaptive detection frequency - faster for quick emotion changes
            let detectionInterval = 600; // Reduced to 600ms for faster emotion change detection
            let frameSkipCounter = 0;

            emotionDetectionIntervalRef.current = setInterval(async () => {
                const currentFriendId = friend?._id;
                const currentProfileId = myProfile?._id;
                
                // Guard check: stop detection if profileId or friendId become unavailable
                if (!currentProfileId || typeof currentProfileId !== 'string' || currentProfileId.length === 0 ||
                    !currentFriendId || typeof currentFriendId !== 'string' || currentFriendId.length === 0) {
                    console.warn('[SingleMessage] ⚠️ Stopping emotion detection - invalid IDs:', {
                        profileId: currentProfileId || 'missing',
                        profileIdType: typeof currentProfileId,
                        friendId: currentFriendId || 'missing',
                        friendIdType: typeof currentFriendId
                    });
                    if (emotionDetectionIntervalRef.current) {
                        clearInterval(emotionDetectionIntervalRef.current);
                        emotionDetectionIntervalRef.current = null;
                    }
                    return;
                }
                
                // Adaptive frame skipping for performance
                // BUT: Don't skip frames when emotions are actively changing (for fast response)
                const timeSinceLastChange = Date.now() - lastEmotionTimestampRef.current;

                // Only skip frames if no emotion change for a while (keep active detection when changing)
                if (timeSinceLastChange > 10000) { // No change for 10 seconds
                    frameSkipCounter++;
                    if (frameSkipCounter % 2 !== 0) return; // Skip every other frame
                } else if (timeSinceLastChange > 5000) { // No change for 5 seconds
                    frameSkipCounter++;
                    if (frameSkipCounter % 3 === 0) return; // Skip every third frame
                } else {
                    // Recent change detected - don't skip frames for fast response
                    frameSkipCounter = 0; // Reset when active
                }
                
                // Check camera availability before attempting capture
                if (!cameraRef.current) {
                    console.log('[SingleMessage] ⏸️ Camera ref not available in interval');
                    // Try to recover - check if camera should be available
                    if (cameraDevice && isCameraPermissionGranted) {
                        console.log('[SingleMessage] 🔄 Camera ref missing but device/permission available - will retry next interval');
                    }
                    return;
                }
                
                // Re-check camera permission if not granted (permissions can change)
                // But only check occasionally to avoid spam (every 10 seconds)
                if (!isCameraPermissionGranted) {
                    const now = Date.now();
                    const timeSinceLastCheck = now - lastPermissionCheckRef.current;
                    
                    if (timeSinceLastCheck >= PERMISSION_CHECK_COOLDOWN_MS) {
                        lastPermissionCheckRef.current = now;
                        console.log('[SingleMessage] ⏸️ Camera permission not granted, re-checking...');
                        const permissionOk = await ensureCameraPermission();
                        if (!permissionOk) {
                            console.log('[SingleMessage] ⏸️ Camera permission still not granted after re-check');
                            return;
                        }
                        // Permission granted, continue with detection
                        console.log('[SingleMessage] ✅ Camera permission granted after re-check');
                    } else {
                        // Still waiting for cooldown, skip this frame
                        return;
                    }
                }
                
                if (!cameraDevice) {
                    console.log('[SingleMessage] ⏸️ Camera device not available in interval');
                    return;
                }
                
                // More lenient check - if ref exists and device/permission are OK, try to capture
                // The ready flag might not be set correctly, but we can still try
                if (!isCameraReadyRef.current) {
                    console.log('[SingleMessage] ⏸️ Camera not marked ready in interval, but attempting capture anyway');
                    // Try to mark as ready if ref exists (might have been missed)
                    if (cameraRef.current) {
                        console.log('[SingleMessage] 🔄 Attempting to mark camera as ready');
                        isCameraReadyRef.current = true;
                    } else {
                        return;
                    }
                }
                
                try {
                    await captureFrameAndSend();
                } catch (error) {
                    console.error('[SingleMessage] ❌ Error in emotion detection interval:', error);
                }
            }, detectionInterval);
        };
        
        /**
         * Start emotion detection
         */
        const startEmotionDetection = async () => {
            // Don't start emotion detection if screen is not focused or app is in background
            if (!shouldUseCamera) {
                console.log('[SingleMessage] ⏸️ Skipping emotion detection - screen not focused or app in background');
                return;
            }
            
            const currentFriendId = friend?._id;
            const currentProfileId = myProfile?._id;
            
            // Don't start detection if we don't have required IDs
            if (!currentProfileId || typeof currentProfileId !== 'string' || currentProfileId.length === 0 ||
                !currentFriendId || typeof currentFriendId !== 'string' || currentFriendId.length === 0) {
                console.warn('[SingleMessage] ⚠️ Not starting emotion detection - invalid IDs:', {
                    profileId: currentProfileId || 'missing',
                    profileIdType: typeof currentProfileId,
                    friendId: currentFriendId || 'missing',
                    friendIdType: typeof currentFriendId
                });
                return;
            }

            const cameraOk = await ensureCameraPermission();
            if (!cameraOk) {
                console.warn('[SingleMessage] ⚠️ Camera permission not granted');
                setIsCameraActive(false);
                return;
            }

            if (!cameraDevice) {
                console.warn('[SingleMessage] ⚠️ Camera device not available');
                setIsCameraActive(false);
                return;
            }

            console.log('[SingleMessage] 📷 Camera permission granted, device available:', cameraDevice?.id);
            
            // Activate camera and keep it active while on this page
            setIsCameraActive(true);

            // Wait for camera component to be rendered and ready
            console.log('[SingleMessage] ⏳ Waiting for camera to be ready...');
            let cameraReady = false;
            const maxWaitTime = 10000; // 10 seconds max wait
            const checkInterval = 500; // Check every 500ms
            const maxChecks = maxWaitTime / checkInterval;
            
            for (let i = 0; i < maxChecks; i++) {
                await new Promise<void>(resolve => setTimeout(() => resolve(), checkInterval));
                
                // Check if camera is ready
                if (cameraRef.current && isCameraReadyRef.current) {
                    cameraReady = true;
                    console.log('[SingleMessage] ✅ Camera is ready after', (i + 1) * checkInterval, 'ms');
                    break;
                }
                
                // Log progress every 2 seconds
                if (i > 0 && i % 4 === 0) {
                    console.log(`[SingleMessage] ⏳ Still waiting for camera... (${(i + 1) * checkInterval}ms)`, {
                        hasRef: !!cameraRef.current,
                        isReady: isCameraReadyRef.current,
                        hasDevice: !!cameraDevice,
                        hasPermission: isCameraPermissionGranted
                    });
                }
            }

            if (!cameraReady) {
                console.warn('[SingleMessage] ⚠️ Camera not ready after waiting, but continuing anyway');
                console.warn('[SingleMessage] Camera state:', { 
                    hasRef: !!cameraRef.current, 
                    isReady: isCameraReadyRef.current, 
                    hasDevice: !!cameraDevice,
                    hasPermission: isCameraPermissionGranted 
                });
                // Try to mark as ready anyway if ref exists (might work)
                if (cameraRef.current) {
                    console.log('[SingleMessage] 🔄 Attempting to force camera ready state');
                    isCameraReadyRef.current = true;
                }
            }

            // Initialize Python server socket connection
            console.log('[SingleMessage] 🔌 Initializing emotion server socket...');
            initializeEmotionServerSocket();
            
            // Wait for connection with retries (Render.com can take time to cold start)
            let connectionAttempts = 0;
            const maxConnectionAttempts = 20; // Wait up to 20 seconds (20 * 1000ms)
            while (!emotionServerSocketRef.current?.connected && connectionAttempts < maxConnectionAttempts) {
                await new Promise<void>(resolve => setTimeout(() => resolve(), 1000));
                connectionAttempts++;
                if (connectionAttempts % 5 === 0) {
                    console.log(`[SingleMessage] ⏳ Waiting for emotion server connection... (${connectionAttempts}s)`);
                }
            }
            
            if (!emotionServerSocketRef.current?.connected) {
                console.warn('[SingleMessage] ⚠️ Emotion server not connected after initialization. Connection may still be establishing in background.');
                // Don't return - allow the connection to establish in background and retry later
            } else {
                console.log('[SingleMessage] ✅ Emotion server connected successfully');
            }

            console.log('[SingleMessage] ✅ Starting server-side emotion detection with profileId:', currentProfileId, 'friendId:', currentFriendId);
            console.log('[SingleMessage] 📊 Detection will start in 600ms intervals');
            
            // Give camera a bit more time to initialize before starting detection
            // This ensures the camera ref is properly attached
            setTimeout(() => {
                if (cameraRef.current && cameraDevice && isCameraPermissionGranted) {
                    if (!isCameraReadyRef.current) {
                        console.log('[SingleMessage] 🔄 Camera ref exists but not marked ready - marking now');
                        isCameraReadyRef.current = true;
                    }
                    console.log('[SingleMessage] ✅ Starting emotion detection interval');
                    detectEmotions();
                } else {
                    console.warn('[SingleMessage] ⚠️ Camera not ready after delay, starting detection anyway');
                    detectEmotions();
                }
            }, 1000); // Wait 1 second after initialization before starting detection
        };
        
        startEmotionDetection();

        return () => {
            if (emotionDetectionIntervalRef.current) {
                clearInterval(emotionDetectionIntervalRef.current);
                emotionDetectionIntervalRef.current = null;
            }
            
            // Clear camera setup timeout
            if (cameraSetupTimeoutRef.current) {
                clearTimeout(cameraSetupTimeoutRef.current);
                cameraSetupTimeoutRef.current = null;
            }
            
            // Deactivate camera when leaving the page
            setIsCameraActive(false);
            
            // Reset rolling majority buffers
            labelHistoryRef.current = [];
            lastMajorityLabelRef.current = null;
            
            // Clear server request timeout
            if (serverRequestTimeoutRef.current) {
                clearTimeout(serverRequestTimeoutRef.current);
                serverRequestTimeoutRef.current = null;
            }
            
            // Reset server request tracking
            serverRequestInFlightRef.current = false;
            // Reset camera ready state
            isCameraReadyRef.current = false;
            
            if (emotionServerSocketRef.current) {
                emotionServerSocketRef.current.off('face_emotion');
                emotionServerSocketRef.current.disconnect();
                emotionServerSocketRef.current = null;
            }
        };
    }, [settings.settings?.isShareEmotion, myProfile?._id, friend?._id, isCallActive, cameraDevice, isConnected, emit, isCameraPermissionGranted]);

    // Stable camera ref callback to prevent repeated attach/detach
    const handleCameraRef = React.useCallback((ref: CameraView | null) => {
        // Only process if the ref actually changed
        if (ref === previousCameraRef.current) {
            return;
        }
        
        // Clear any pending setup timeout
        if (cameraSetupTimeoutRef.current) {
            clearTimeout(cameraSetupTimeoutRef.current);
            cameraSetupTimeoutRef.current = null;
        }
        
        // Update refs
        previousCameraRef.current = ref;
        cameraRef.current = ref;
        
        if (ref) {
            console.log('[SingleMessage] 📷 Camera ref attached successfully');
            // Mark camera as ready after a delay to allow initialization
            // Use a longer delay to ensure camera is fully initialized
            cameraSetupTimeoutRef.current = setTimeout(() => {
                // Double-check that ref is still valid
                if (cameraRef.current && cameraDevice) {
                    isCameraReadyRef.current = true;
                    console.log('[SingleMessage] ✅ Camera marked as ready');
                } else {
                    console.warn('[SingleMessage] ⚠️ Camera ref or device lost during initialization');
                    isCameraReadyRef.current = false;
                }
                cameraSetupTimeoutRef.current = null;
            }, 2000); // Increased to 2 seconds for better reliability
        } else {
            console.log('[SingleMessage] 📷 Camera ref detached');
            isCameraReadyRef.current = false;
        }
    }, [cameraDevice]);

    // Monitor camera state and ensure it's marked ready when conditions are met
    useEffect(() => {
        if (!settings.settings?.isShareEmotion || isCallActive || !cameraDevice || !isCameraPermissionGranted) {
            return;
        }

        // Periodically check if camera should be ready but isn't marked as such
        const checkInterval = setInterval(() => {
            if (cameraRef.current && cameraDevice && isCameraPermissionGranted && !isCameraReadyRef.current) {
                console.log('[SingleMessage] 🔄 Camera conditions met but not marked ready - marking now');
                isCameraReadyRef.current = true;
            }
        }, 3000); // Check every 3 seconds

        return () => clearInterval(checkInterval);
    }, [settings.settings?.isShareEmotion, isCallActive, cameraDevice, isCameraPermissionGranted]);

    // Realtime block/unblock listeners and blocked message notice
    useEffect(() => {
        if (!friend?._id || !myProfile?._id) return;

        const myId = String(myProfile._id);
        const friendId = String(friend._id);

        const handleUserBlocked = ({ by, target }: { by: string; target: string }) => {
            if (String(by) === myId && target) {
                patchMyBlockedUsers(true, target);
            }
        };
        const handleBlockedByUser = ({ by, target }: { by: string; target: string }) => {
            if (String(by) === friendId && String(target) === myId) {
                setIsBlockedByFriend(true);
            }
        };
        const handleUserUnblocked = ({ by, target }: { by: string; target: string }) => {
            if (String(by) === myId && target) {
                patchMyBlockedUsers(false, target);
            }
        };
        const handleUnblockedByUser = ({ by, target }: { by: string; target: string }) => {
            if (String(by) === friendId && String(target) === myId) {
                setIsBlockedByFriend(false);
            }
        };
        const handleMessageBlocked = ({ receiverId, reason }: { receiverId: string; reason: string }) => {
            if (String(receiverId) === friendId) {
                try { Alert.alert('Message not sent', reason || 'You cannot message this user.'); } catch (_) {}
            }
        };

        on('userBlocked', handleUserBlocked);
        on('blockedByUser', handleBlockedByUser);
        on('userUnblocked', handleUserUnblocked);
        on('unblockedByUser', handleUnblockedByUser);
        on('message_blocked', handleMessageBlocked);

        return () => {
            off('userBlocked', handleUserBlocked);
            off('blockedByUser', handleBlockedByUser);
            off('userUnblocked', handleUserUnblocked);
            off('unblockedByUser', handleUnblockedByUser);
            off('message_blocked', handleMessageBlocked);
        };
    }, [friend?._id, myProfile?._id, on, off, patchMyBlockedUsers]);

    // Tab bar hiding is now handled at the app level in App.tsx

    useFocusEffect(
        React.useCallback(() => {
            let isActive = true;
            const loadBackground = async () => {
                try {
                    const saved = await AsyncStorage.getItem(CHAT_BG_STORAGE_KEY);
                    if (isActive) setChatBackground(saved);
                } catch (e) {
                    // noop
                }
            };
            loadBackground();
            refreshBlockStatus(() => isActive);
            
            // Mark messages as read when screen is focused
            if (friend?._id && myProfile?._id) {
                dispatch(markMessagesAsRead({
                    chatId: friend._id,
                    currentUserId: myProfile._id
                }));
            }
            
            // Re-check camera permission when screen comes into focus (especially if emotion detection is enabled)
            if (settings.settings?.isShareEmotion) {
                ensureCameraPermission().catch(err => {
                    console.warn('[SingleMessage] Error checking camera permission on focus:', err);
                });
            }
            
            pendingFollowLatestRef.current = true;
            isNearBottomRef.current = true;
            const jumpToLatest = () => {
                if (!isActive) return;
                if (isInitialLoading) return;
                try {
                    flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
                } catch (_) {}
            };
            const t1 = setTimeout(jumpToLatest, 50);
            const t2 = setTimeout(jumpToLatest, 300);

            return () => {
                isActive = false;
                clearTimeout(t1);
                clearTimeout(t2);
            };
        }, [friend?._id, myProfile?._id, dispatch, settings.settings?.isShareEmotion, isInitialLoading, refreshBlockStatus])
    );

    const scrollToBottom = useCallback((animated = false) => {
        const list = flatListRef.current;
        if (!list) return;
        const doScroll = () => {
            try {
                list.scrollToOffset({ offset: 0, animated });
            } catch (_) {}
        };
        requestAnimationFrame(() => {
            doScroll();
            requestAnimationFrame(doScroll);
        });
    }, []);

    const dismissKeyboard = useCallback(() => {
        Keyboard.dismiss();
        inputRef.current?.blur();
        setEmojiPanelOpen(false);
        setShowAttachTray(false);
        setShowMicMenu(false);
    }, []);

    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const onShow = (event: KeyboardEvent) => {
            const height = event.endCoordinates?.height ?? 0;
            setKeyboardHeight(height);
        };
        const onHide = () => setKeyboardHeight(0);

        const showSub = Keyboard.addListener(showEvent, onShow);
        const hideSub = Keyboard.addListener(hideEvent, onHide);
        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    useEffect(() => {
        if (keyboardHeight <= 0) return;
        if (!isNearBottomRef.current && !pendingFollowLatestRef.current) return;
        const timeoutId = setTimeout(() => scrollToBottom(false), 40);
        return () => clearTimeout(timeoutId);
    }, [keyboardHeight, scrollToBottom]);

    const markInitialScrolled = useCallback(() => {
        if (hasInitialScrolledRef.current) return;
        hasInitialScrolledRef.current = true;
        isNearBottomRef.current = true;
        setLockVisibleOnPrepend(true);
    }, []);

    // Inverted list already opens on the latest message; only unlock pagination after layout.
    useEffect(() => {
        if (hasInitialScrolledRef.current) return;
        if (!friend?._id || messages.length === 0 || isInitialLoading) return;
        scrollToBottom(false);
        const t = setTimeout(() => markInitialScrolled(), 300);
        return () => clearTimeout(t);
    }, [friend?._id, messages.length, isInitialLoading, scrollToBottom, markInitialScrolled]);

    // After a realtime / optimistic message is painted, jump to it.
    useEffect(() => {
        if (pendingScrollRestoreRef.current) return;
        if (!pendingFollowLatestRef.current) return;
        pendingFollowLatestRef.current = false;
        scrollToBottom(true);
    }, [messages, scrollToBottom]);

    // Keep typing indicator visible while the other person is typing.
    useEffect(() => {
        if (!isTyping) return;
        scrollToBottom(true);
    }, [isTyping, typingMessage, scrollToBottom]);

    // Track which messages we've already emitted seen for (avoid duplicate emits)
    const seenEmittedRef = useRef<Set<string>>(new Set());
    const pendingSeenIdsRef = useRef<Set<string>>(new Set());
    const seenFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const flushSeen = () => {
        const ids = Array.from(pendingSeenIdsRef.current);
        pendingSeenIdsRef.current.clear();
        seenFlushTimerRef.current = null;
        if (ids.length === 0) return;
        api.post('/message/seen', { messageIds: ids }).catch(() => {
            ids.forEach((id) => seenEmittedRef.current.delete(id));
        });
        try {
            dispatch(markMessagesAsRead({ chatId: friend?._id, currentUserId: myProfile?._id }));
        } catch (_) { }
    };

    const emitSeenFor = (msg: Message | undefined | null) => {
        try {
            if (!msg || !msg._id) return;
            if (!isConnected) return;
            if (msg.senderId === myProfile?._id) return;
            if (seenEmittedRef.current.has(msg._id)) return;
            emit('seenMessage', msg);
            seenEmittedRef.current.add(msg._id);
            pendingSeenIdsRef.current.add(String(msg._id));
            if (!seenFlushTimerRef.current) {
                seenFlushTimerRef.current = setTimeout(flushSeen, 250);
            }
        } catch (_) { }
    };

    // Mirror web: after messages update, if the last message is from friend, emit seen after a delay
    useEffect(() => {
        if (!friend?._id || !myProfile?._id) return;
        if (!messages || messages.length === 0) return;
        const last = messages[messages.length - 1];
        if (!last) return;
        if (last.senderId === friend._id && !last.isSeen) {
            const t = setTimeout(() => emitSeenFor(last), 2000);
            return () => clearTimeout(t);
        }
        return;
    }, [messages, friend?._id, myProfile?._id, isConnected]);

    // Emit seen when received messages become visible on screen
    const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<{ item: Message }> }) => {
        try {
            // Track the first visible message for scroll position maintenance
            if (viewableItems.length > 0) {
                const firstVisible = viewableItems[0]?.item;
                if (firstVisible?._id) {
                    visibleMessageIdRef.current = firstVisible._id;
                }
            }
            
            viewableItems.forEach(v => {
                const item = v?.item;
                if (!item) return;
                if (item.senderId === friend?._id && !item.isSeen) {
                    emitSeenFor(item);
                }
            });
        } catch (_) { }
    }).current;
    const viewabilityConfigRef = useRef({ itemVisiblePercentThreshold: 70, minimumViewTime: 400 });

    const triggerLoveRain = (text?: string | null) => {
        if (!chatTheme?.loveRain) return;
        if (!isRomanticMessage(text)) return;
        const now = Date.now();
        if (now - lastLoveRainRef.current < 450) return;
        lastLoveRainRef.current = now;
        setLoveRainBurst((n) => n + 1);
    };

    const sendMessage = (overrides?: { message?: string }) => {
        const messageContent = (overrides?.message ?? inputText).trim();
        if ((!messageContent && !pendingAttachment) || !isConnected || isUploading) return;
        if (isSendingRef.current) return;
        if (!friend?._id || !myProfile?._id) return;

        const roomId = room || [myProfile._id, friend._id].sort().join('_');
        isSendingRef.current = true;
        const tempId = `temp-${Date.now()}-${Math.random()}`;
        const pendingMessage: Message = {
            _id: tempId,
            message: messageContent,
            receiverId: friend._id,
            senderId: myProfile._id,
            room: roomId,
            attachment: pendingAttachment || undefined,
            timestamp: new Date(),
            isSeen: false,
            tempId,
            parent: replyingTo || undefined,
            isOptimistic: true,
            sendFailed: false,
        };

        setMessages(prev => [...prev, pendingMessage]);
        setInputText('');
        setEmojiPanelOpen(false);
        setShowAttachTray(false);
        setShowMicMenu(false);
        stopTyping();
        isNearBottomRef.current = true;
        pendingFollowLatestRef.current = true;
        scrollToBottom(true);

        const payload = {
            room: roomId,
            senderId: myProfile._id,
            receiverId: friend._id,
            message: messageContent,
            attachment: pendingAttachment || false,
            parent: replyingTo?._id || false,
            messageType: 'text',
            tempId,
            timestamp: new Date().toISOString(),
        };

        const failTimer = setTimeout(() => {
            setMessages(prev =>
                prev.map((msg) =>
                    (msg._id === tempId || msg.tempId === tempId) && msg.isOptimistic
                        ? { ...msg, sendFailed: true }
                        : msg,
                ),
            );
        }, 10000);

        emit('sendMessage', payload, (response: any) => {
            clearTimeout(failTimer);
            if (!response) return;
            if (response.ok === false || response.blocked) {
                setMessages(prev => prev.filter(msg => msg._id !== tempId && msg.tempId !== tempId));
                Alert.alert('Message not sent', response.reason || response.error || 'This message could not be delivered.');
                return;
            }
            if (response.updatedMessage) {
                setMessages(prev => upsertConfirmedMessage(prev, {
                    ...response.updatedMessage,
                    timestamp: new Date(response.updatedMessage.timestamp || Date.now()),
                    tempId,
                }, tempId));
            }
        });

        triggerLoveRain(messageContent);
        setPendingAttachment(null);
        setPendingAttachmentLocal(null);
        setUploadProgress(null);
        setIsUploading(false);
        setReplyingTo(null);
        if (activeSwipeId) {
            const ref = swipeableRefs.current.get(activeSwipeId);
            try { ref?.close && ref.close(); } catch (e) { }
            setActiveSwipeId(null);
        }

        setTimeout(() => {
            isSendingRef.current = false;
        }, 400);
    };

    const stopTyping = () => {
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = null;
        }
        if (isTypingOutgoingRef.current) {
            const roomId = room || [myProfile?._id, friend?._id].filter(Boolean).sort().join('_');
            emit('typing', { room: roomId, isTyping: false, type: '', receiverId: friend?._id, senderId: myProfile?._id });
            isTypingOutgoingRef.current = false;
        }
    };

    const handleInputChange = (value: string) => {
        setInputText(value);
        const showTyping =
            settings.settings?.showIsTyping !== false &&
            settings.settings?.showTyping !== false &&
            settings.settings?.typingIndicators !== false;
        if (!showTyping) return;

        if (value.trim().length > 0) {
            const now = Date.now();
            const shouldEmit = !isTypingOutgoingRef.current || now - lastTypingEmitRef.current > 400;
            if (shouldEmit) {
                const roomId = room || [myProfile?._id, friend?._id].filter(Boolean).sort().join('_');
                emit('typing', { room: roomId, isTyping: true, type: value.trim(), receiverId: friend?._id, senderId: myProfile?._id });
                lastTypingEmitRef.current = now;
                isTypingOutgoingRef.current = true;
            }
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
            typingTimeoutRef.current = setTimeout(() => {
                stopTyping();
            }, 1200);
        } else {
            stopTyping();
        }
    };

    const handleEmojiPress = () => {
        sendMessage({ message: chatAppearance?.actionEmoji || '👍' });
    };

    const insertComposerEmoji = (emoji: string) => {
        handleInputChange(`${inputText}${emoji}`);
    };

    useEffect(() => {
        return () => {
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
        };
    }, []);

    const formatTime = (date: Date) => {
        return moment(date).fromNow();
    };

    // Add function to handle long press
    const handleMessageLongPress = (message: Message, event: any) => {
        setSelectedMessage(message);
        setIsReactedByMe(message?.reacts?.includes(myProfile?._id) || false);
        setContextMenuVisible(true);

        const { pageY } = event.nativeEvent;
        const screenHeight = Dimensions.get('window').height;
        const CONTEXT_MENU_HEIGHT = 360; // approximate menu height (safer)
        const TOP_MARGIN = 20;
        // If opening near bottom, anchor using bottom so it stays fully visible
        if (pageY + 20 + CONTEXT_MENU_HEIGHT > screenHeight) {
            setContextMenuUseBottom(true);
            setContextMenuBottom(20);
            setContextMenuPosition({ x: 20, y: 0 });
        } else {
            const y = Math.max(
                TOP_MARGIN,
                Math.min(pageY - 100, screenHeight - CONTEXT_MENU_HEIGHT - TOP_MARGIN)
            );
            setContextMenuUseBottom(false);
            setContextMenuPosition({ x: 20, y });
        }
    };

    const playSound = async () => {
        try {
            console.log('🎤 User clicked speaker button - speaking message:', selectedMessage?.message);
            if (!selectedMessage?.message) {
                console.warn('No message to speak');
                return;
            }
            
            // Use expo-speech for TTS when user clicks speaker button
            // No longer using socket events to prevent automatic TTS
            const options = {
                pitch: 1.0,
                rate: 0.8,
                volume: 1.0,
            };
            await Speech.speak(selectedMessage.message, options);
        } catch (error) {
            console.error('❌ Error speaking message:', error);
        }
    }

    // Add function to copy message
    const copyMessage = () => {
        if (selectedMessage) {
            // You'll need to implement clipboard functionality
            // For now, we'll just show an alert
            Alert.alert('Copied!', 'Message copied to clipboard');
            setContextMenuVisible(false);
        }
    };

    // Add function to reply to message
    const replyToMessage = () => {
        if (selectedMessage) {
            setReplyingTo(selectedMessage);
            setContextMenuVisible(false);
            setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
        }
    };

    // Add function to delete message
    const deleteMessage = () => {
        if (selectedMessage) {
            Alert.alert(
                'Delete Message',
                'Are you sure you want to delete this message?',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => {
                            // Emit delete message event
                            emit('deleteMessage', selectedMessage._id);

                            // Remove from local state
                            setContextMenuVisible(false);
                        }
                    }
                ]
            );
        }
    };

    const likeOrUnlikeMessage = () => {
        if (!selectedMessage) return;
        const messageId = selectedMessage._id;
        const myId = myProfile?._id;
        if (!messageId || !myId) return;

        if (isReactedByMe) {
            emit('removeReactMessage', { messageId, profileId: myId });
            setMessages((prev) =>
                prev.map((m) =>
                    m._id === messageId
                        ? { ...m, reacts: (m.reacts || []).filter((id) => String(id) !== String(myId)) }
                        : m,
                ),
            );
            api.post('/message/removeReact', { messageId, myId }).catch(() => {});
            setIsReactedByMe(false);
        } else {
            emit('reactMessage', { messageId, profileId: myId });
            setMessages((prev) =>
                prev.map((m) =>
                    m._id === messageId
                        ? { ...m, reacts: [...(m.reacts || []), myId] }
                        : m,
                ),
            );
            api.post('/message/addReact', { messageId, myId }).catch(() => {});
            setIsReactedByMe(true);
        }
        setContextMenuVisible(false);
    };

    const viewImage = () => {
        if (selectedMessage?.attachment && isValidImageUrl(selectedMessage.attachment)) {
            openImageModal(selectedMessage.attachment);
        }
        setContextMenuVisible(false);
    };

    // Add function to forward message
    const forwardMessage = () => {
        if (selectedMessage) {
            Alert.alert('Forward', 'Forward feature coming soon!');
            setContextMenuVisible(false);
        }
    };

    // Image modal functions
    const openImageModal = (imageUrl: string) => {
        setSelectedImage(imageUrl);
        setImageModalVisible(true);
        setImageScale(1);
    };

    const closeImageModal = () => {
        setImageModalVisible(false);
        setSelectedImage('');
        setImageScale(1);
    };

    const zoomIn = () => {
        setImageScale(prev => Math.min(prev + 0.5, 3));
    };

    const zoomOut = () => {
        setImageScale(prev => Math.max(prev - 0.5, 0.5));
    };

    const resetZoom = () => {
        setImageScale(1);
    };

    const downloadImage = () => {
        // For React Native, you might want to use react-native-fs or similar library
        // For now, we'll show an alert
        Alert.alert('Download', 'Download feature coming soon!');
    };

    const removePendingAttachment = () => {
        setPendingAttachment(null);
        setPendingAttachmentLocal(null);
        setUploadProgress(null);
        setIsUploading(false);
    };

    // Handle video call
    const handleVideoCall = () => {
        if (!friend?._id || !myProfile?._id) {
            Alert.alert('Error', 'Unable to start call. Please try again.');
            return;
        }

        const channelName = `${myProfile._id}-${friend._id}`;
        emitStartVideoCall({
            to: String(friend._id),
            channelName,
            callerName: friend.fullName,
            callerProfilePic: friend.profilePic,
        });
        startVideoCall(String(friend._id), channelName);
    };

    const handleAudioCall = () => {
        if (!friend?._id || !myProfile?._id) {
            Alert.alert('Error', 'Unable to start call. Please try again.');
            return;
        }

        const channelName = `${myProfile._id}-${friend._id}`;
        emitStartAudioCall({
            to: String(friend._id),
            channelName,
            callerName: friend.fullName,
            callerProfilePic: friend.profilePic,
        });
        startAudioCall(String(friend._id), channelName);
    };

    // Handle live voice transfer
    const handleLiveVoiceButtonClick = async () => {
        try {
            if (isLiveVoiceActiveRef.current) {
                // Stop live voice
                try {
                    if (liveVoiceEngineRef.current) {
                        await liveVoiceEngineRef.current.leaveChannel();
                        await liveVoiceEngineRef.current.destroy();
                        liveVoiceEngineRef.current = null;
                    }
                } catch (e) {
                    console.warn('Error stopping live voice:', e);
                }
                isLiveVoiceActiveRef.current = false;
                setIsLiveVoiceActive(false);
                setIsLiveVoiceModalOpen(false);
                setLiveVoiceDuration(0);
                setLiveVoiceRole('sender');
                if (liveVoiceDurationTimerRef.current) {
                    clearInterval(liveVoiceDurationTimerRef.current);
                    liveVoiceDurationTimerRef.current = null;
                }
                const channelName = room || [myProfile?._id, friend?._id].sort().join('_');
                emit('live-voice-stop', { to: friend?._id, channelName });
                return;
            }

            // Start live voice
            setIsLiveVoiceConnecting(true);
            
            // Check microphone permission first
            const hasMicPermission = await ensureMicPermission();
            if (!hasMicPermission) {
                setIsLiveVoiceConnecting(false);
                return;
            }
            
            const channelName = room || [myProfile?._id, friend?._id].sort().join('_');
            
            // Emit event to ensure receiver leaves subscriber connection if active
            emit('live-voice-leave-subscriber', { channelName });
            
            // Small delay to ensure subscriber connection is closed
            await new Promise<void>(resolve => setTimeout(() => resolve(), 300));
            
            // Generate consistent UID from userId hash
            // Add 1 to publisher UID to avoid conflict with subscriber UID
            const generateUid = (str: string) => {
                let hash = 0;
                for (let i = 0; i < str.length; i++) {
                    hash = ((hash << 5) - hash) + str.charCodeAt(i);
                    hash |= 0;
                }
                return Math.abs(hash);
            };
            const baseUid = generateUid(myProfile?._id || '0');
            // Use baseUid + 1 for publisher to avoid conflict with subscriber (baseUid)
            const uid = baseUid + 1;
            
            // Get token
            const { data } = await api.post('/agora/token', { channelName, uid, role: 'publisher' });
            
            if (!data || !data.appId || !data.token) {
                throw new Error('Invalid token response from server');
            }

            // Dispose previous if any
            if (liveVoiceEngineRef.current) {
                try {
                    await liveVoiceEngineRef.current.leaveChannel();
                    await liveVoiceEngineRef.current.destroy();
                } catch (e) {
                    console.warn('Error disposing previous engine:', e);
                }
                liveVoiceEngineRef.current = null;
            }

            // Initialize engine - Agora removed for Expo compatibility
            const engine = null; // Simplified for Expo compatibility
            // await engine.enableAudio();
            
            // Set channel profile to Communication mode (0) to match web RTC mode
            await engine.setChannelProfile(0); // 0 = Communication (RTC mode)
            
            // Enable local audio (ensure microphone is enabled for publishing)
            await engine.muteLocalAudioStream(false);
            
            // Join channel as publisher (no role needed in Communication mode)
            await engine.joinChannel(data.token, channelName, null, uid);

            liveVoiceEngineRef.current = engine;
            isLiveVoiceActiveRef.current = true;
            setIsLiveVoiceActive(true);
            setLiveVoiceDuration(0);
            setLiveVoiceRole('sender');
            setIsLiveVoiceModalOpen(true);
            
            // Start duration timer
            if (liveVoiceDurationTimerRef.current) {
                clearInterval(liveVoiceDurationTimerRef.current);
            }
            liveVoiceDurationTimerRef.current = setInterval(() => {
                setLiveVoiceDuration(prev => prev + 1);
            }, 1000);
            
            emit('live-voice-start', { to: friend?._id, channelName });
        } catch (err: any) {
            console.error('Live voice error:', err);
            setIsLiveVoiceActive(false);
            isLiveVoiceActiveRef.current = false;
            setIsLiveVoiceModalOpen(false);
            setLiveVoiceDuration(0);
            if (liveVoiceDurationTimerRef.current) {
                clearInterval(liveVoiceDurationTimerRef.current);
                liveVoiceDurationTimerRef.current = null;
            }
            // Cleanup on error
            try {
                if (liveVoiceEngineRef.current) {
                    await liveVoiceEngineRef.current.leaveChannel().catch(() => {});
                    await liveVoiceEngineRef.current.destroy().catch(() => {});
                    liveVoiceEngineRef.current = null;
                }
            } catch (cleanupErr) {
                console.error('Error during cleanup:', cleanupErr);
            }
            Alert.alert('Live Voice Error', err?.message || 'Failed to start live voice transfer');
        } finally {
            setIsLiveVoiceConnecting(false);
        }
    };

    // Block/Unblock functionality
    const handleBlockUser = useCallback(async () => {
        if (!friend?._id || !myProfile?._id || isBlocking) return;

        try {
            setIsBlocking(true);
            const response = await friendAPI.blockUser(friend._id);

            if (response.status === 200) {
                patchMyBlockedUsers(true, friend._id);
                setOptionMenuVisible(false);
            } else {
                Alert.alert('Error', 'Failed to block user. Please try again.');
            }
        } catch (error) {
            console.error('Error blocking user:', error);
            Alert.alert('Error', 'Failed to block user. Please try again.');
        } finally {
            setIsBlocking(false);
        }
    }, [friend?._id, myProfile?._id, isBlocking, patchMyBlockedUsers]);

    const handleUnblockUser = useCallback(async () => {
        if (!friend?._id || !myProfile?._id || isBlocking) return;

        try {
            setIsBlocking(true);
            const response = await friendAPI.unblockUser(friend._id);

            if (response.status === 200) {
                patchMyBlockedUsers(false, friend._id);
                setOptionMenuVisible(false);
            } else {
                Alert.alert('Error', 'Failed to unblock user. Please try again.');
            }
        } catch (error) {
            console.error('Error unblocking user:', error);
            Alert.alert('Error', 'Failed to unblock user. Please try again.');
        } finally {
            setIsBlocking(false);
        }
    }, [friend?._id, myProfile?._id, isBlocking, patchMyBlockedUsers]);

    const openUserInfo = useCallback(async () => {
        if (!friend?._id) return;
        setOptionMenuVisible(false);
        setInfoMenuVisible(true);
        setLoadingUserInfo(true);
        try {
            const res = await api.get(`/profile?profileId=${friend._id}`);
            if (res.status === 200) {
                setUserInfoData(res.data);
                if (res.data?.lastLocation?.latitude && res.data?.lastLocation?.longitude) {
                    setFriendLocation({
                        latitude: res.data.lastLocation.latitude,
                        longitude: res.data.lastLocation.longitude,
                        timestamp: res.data.lastLocation.timestamp || Date.now(),
                    });
                } else {
                    setFriendLocation(null);
                }
            }
        } catch (error) {
            console.error('Error fetching user info:', error);
            setUserInfoData(friend);
            if (friend?.lastLocation?.latitude && friend?.lastLocation?.longitude) {
                setFriendLocation({
                    latitude: friend.lastLocation.latitude,
                    longitude: friend.lastLocation.longitude,
                    timestamp: friend.lastLocation.timestamp || Date.now(),
                });
            } else {
                setFriendLocation(null);
            }
        } finally {
            setLoadingUserInfo(false);
        }
    }, [friend]);

    const pickAndUploadImage = async (fromCamera: boolean) => {
        try {
            if (fromCamera) {
                const permission = await ImagePicker.requestCameraPermissionsAsync();
                if (!permission.granted) {
                    return Alert.alert('Camera permission', 'Please allow camera access to take a photo.');
                }
            }
            const result: any = fromCamera
                ? await ImagePicker.launchCameraAsync({ quality: 0.85 })
                : await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    selectionLimit: 1,
                });

            if (result.canceled) return;
            const asset = result.assets && result.assets[0];
            if (!asset?.uri) return;

            setIsUploading(true);
            setUploadProgress(0);
            setPendingAttachmentLocal(asset.uri);

            const formData: any = new FormData();
            formData.append('image', {
                uri: asset.uri,
                name: asset.fileName || 'photo.jpg',
                type: asset.mimeType || asset.type || 'image/jpeg',
            } as any);

            const uploadRes = await api.post('/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (progressEvent: any) => {
                    try {
                        const total = progressEvent.total;
                        const loaded = progressEvent.loaded || 0;
                        if (total) {
                            const percent = Math.floor((loaded / total) * 100);
                            setUploadProgress(percent);
                        }
                    } catch (e) {
                        // noop
                    }
                }
            } as any);

            const secureUrl = uploadRes?.data?.secure_url || uploadRes?.data?.url;
            if (!secureUrl) {
                throw new Error('Upload failed');
            }

            setUploadProgress(100);
            setPendingAttachment(secureUrl);
            setPendingAttachmentLocal(asset.uri);
        } catch (err: any) {
            console.error('Attachment upload error:', err?.message || err);
            Alert.alert('Upload failed', 'Could not upload the image.');
            setPendingAttachment(null);
            setPendingAttachmentLocal(null);
        } finally {
            setIsUploading(false);
            setUploadProgress(null);
        }
    };

    const pickAndUploadFile = async () => {
        try {
            const result: any = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.All,
                selectionLimit: 1,
            });
            if (result.canceled) return;
            const asset = result.assets && result.assets[0];
            if (!asset?.uri) return;

            setIsUploading(true);
            setUploadProgress(0);
            setPendingAttachmentLocal(asset.uri);

            const formData: any = new FormData();
            formData.append('file', {
                uri: asset.uri,
                name: asset.fileName || 'attachment',
                type: asset.mimeType || asset.type || 'application/octet-stream',
            } as any);

            const uploadRes = await api.post('/upload/file', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (progressEvent: any) => {
                    try {
                        const total = progressEvent.total;
                        const loaded = progressEvent.loaded || 0;
                        if (total) {
                            setUploadProgress(Math.floor((loaded / total) * 100));
                        }
                    } catch (e) { }
                },
            } as any);

            const secureUrl = uploadRes?.data?.secure_url || uploadRes?.data?.url;
            if (!secureUrl) throw new Error('Upload failed');
            setUploadProgress(100);
            setPendingAttachment(secureUrl);
            setPendingAttachmentLocal(asset.uri);
            setShowAttachTray(false);
        } catch (err: any) {
            console.error('File upload error:', err?.message || err);
            Alert.alert('Upload failed', 'Could not upload the file.');
            setPendingAttachment(null);
            setPendingAttachmentLocal(null);
        } finally {
            setIsUploading(false);
            setUploadProgress(null);
        }
    };

    const toggleAttachTray = () => {
        if (isUploading || !isConnected) return;
        setShowMicMenu(false);
        setEmojiPanelOpen(false);
        setEditReactionOpen(false);
        setShowAttachTray((prev) => !prev);
    };

    const handleMicButtonClick = () => {
        if (isUploadingAudio) return;
        if (isRecording) {
            stopRecording(true);
            return;
        }
        setShowAttachTray(false);
        setEmojiPanelOpen(false);
        setMicMenuView('main');
        setShowMicMenu((prev) => !prev);
    };

    const composerIconBtn = (active?: boolean) => ({
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: active ? `${chatTheme.colors.accent}33` : chatTheme.colors.recvBg,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        borderWidth: 1,
        borderColor: active ? chatTheme.colors.accent : chatTheme.colors.recvBorder,
    });

    const startReply = (message: Message) => {
        setSelectedMessage(message);
        setReplyingTo(message);
        setTimeout(() => inputRef.current?.focus(), 100);
    };

    const scrollToMessage = (messageId: string) => {
        const chronologicalIndex = messages.findIndex(m => m._id === messageId);
        if (chronologicalIndex !== -1) {
            const index = messages.length - 1 - chronologicalIndex;
            setHighlightedMessageId(messageId);
            try {
                flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
            } catch (e) {
                // Fallback handled by onScrollToIndexFailed
            }
            setTimeout(() => setHighlightedMessageId(null), 2000);
        } else {
            Alert.alert('Not found', 'Original message is not loaded.');
        }
    };

    const loadOldMessages = useCallback(async () => {
        if (!friend?._id || !myProfile?._id) return;
        if (!hasMoreMessagesRef.current) return;
        if (!hasInitialScrolledRef.current) return;
        if (loadingOlderRef.current || isInitialLoadingRef.current) return;

        const oldestMessage = messagesRef.current[0];
        const beforeTimestamp = toTimestampIso(
            oldestMessage?.timestamp || (oldestMessage as any)?.createdAt,
        );
        if (!beforeTimestamp) return;

        loadingOlderRef.current = true;
        setIsLoadingOldMessages(true);

        try {
            const response = await fetchOldMessages(
                myProfile._id,
                friend._id,
                beforeTimestamp,
                MESSAGES_PER_PAGE,
            );
            const older = response.messages || [];
            if (older.length === 0) {
                setHasMoreMessages(false);
                hasMoreMessagesRef.current = false;
                loadingOlderRef.current = false;
                return;
            }

            const existingIds = new Set(messagesRef.current.map((msg) => String(msg._id)));
            const uniqueOlder = older.filter((msg) => !existingIds.has(String(msg._id)));
            if (uniqueOlder.length === 0) {
                setHasMoreMessages(response.hasMore);
                hasMoreMessagesRef.current = response.hasMore;
                loadingOlderRef.current = false;
                return;
            }

            setMessages((prev) => [...uniqueOlder, ...prev]);
            setHasMoreMessages(response.hasMore);
            hasMoreMessagesRef.current = response.hasMore;
        } catch (error) {
            loadingOlderRef.current = false;
            console.error('Error loading older messages:', error);
        } finally {
            loadingOlderRef.current = false;
            setIsLoadingOldMessages(false);
        }
    }, [friend?._id, myProfile?._id, fetchOldMessages]);

    const handleScroll = useCallback((event: any) => {
        const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
        const maxScroll = Math.max(0, contentSize.height - layoutMeasurement.height);
        // Inverted list: offset 0 is the latest messages (visual bottom).
        isNearBottomRef.current = contentOffset.y <= NEAR_BOTTOM_PX;
        scrollOffsetRef.current = contentOffset.y;
        contentSizeRef.current = contentSize.height;
        viewportHeightRef.current = layoutMeasurement.height;

        if (!hasInitialScrolledRef.current) {
            if (isNearBottomRef.current) {
                markInitialScrolled();
            }
            return;
        }

        if (loadingOlderRef.current || maxScroll <= 0) return;
        if (contentOffset.y >= maxScroll * (1 - LOAD_OLDER_SCROLL_PERCENT / 100)) {
            loadOldMessages();
        }
    }, [loadOldMessages, markInitialScrolled]);

    const handleContentSizeChange = useCallback((_w: number, h: number) => {
        contentSizeRef.current = h;
        if (!hasInitialScrolledRef.current && messagesRef.current.length > 0 && !isInitialLoadingRef.current) {
            scrollToBottom(false);
            return;
        }
        if (pendingFollowLatestRef.current || isNearBottomRef.current) {
            if (loadingOlderRef.current) return;
            const animated = pendingFollowLatestRef.current;
            pendingFollowLatestRef.current = false;
            scrollToBottom(animated);
        }
    }, [scrollToBottom]);

    const renderLeftReplyAction = () => (
        <View style={{ width: 64, justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ backgroundColor: themeColors.gray[200], borderRadius: 20, padding: 8 }}>
                <Icon name="reply" size={20} color={themeColors.primary} />
            </View>
        </View>
    );

    const renderPendingMessage = ({ item }: { item: Message }) => {
        const isMyMessage = item.senderId === myProfile?._id;
        const bgColor = themeColors.surface.secondary;
        
        return (
            <View style={{
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
                        minWidth: Math.max(120, (item.message?.length || 100) * 10),
                        maxWidth: isMyMessage ? '75%' : '78%',
                    }}>
                        <SkeletonBlock 
                            width="70%" 
                            height={20} 
                            borderRadius={4} 
                            style={{ marginBottom: 4 }} 
                        />
                        <View style={{ 
                            flexDirection: 'row', 
                            justifyContent: 'flex-end', 
                            alignItems: 'center', 
                            marginTop: 4 
                        }}>
                            {isMyMessage && <SkeletonBlock width={14} height={14} style={{ marginRight: 4 }} />}
                            <SkeletonBlock width={35} height={11} borderRadius={4} />
                        </View>
                    </View>
                </View>
                
                {isMyMessage && (
                    <View style={{ marginLeft: 8, marginBottom: 2 }}>
                        <SkeletonBlock width={15} height={15} borderRadius={8} />
                    </View>
                )}
            </View>
        );
    };

    const renderMessage = ({ item }: { item: Message }) => {
        const isMyMessage = item.senderId === myProfile?._id;
        
        return (
            <Swipeable
                ref={(ref) => {
                    if (ref) {
                        swipeableRefs.current.set(item._id, ref);
                    } else {
                        swipeableRefs.current.delete(item._id);
                    }
                }}
                renderLeftActions={() => (!isMyMessage ? renderLeftReplyAction() : null)}
                onSwipeableOpen={(direction) => {
                    if (direction === 'left' && !isMyMessage) {
                        startReply(item);
                        setActiveSwipeId(item._id);
                    }
                }}
            >
                <Pressable onLongPress={(event) => handleMessageLongPress(item, event)} delayLongPress={250}>
                    <View style={{
                        marginBottom: Array.isArray(item.reacts) && item.reacts.length > 0 ? 16 : 8,
                        marginHorizontal: 12,
                        flexDirection: 'row',
                        alignItems: 'flex-end',
                        justifyContent: isMyMessage ? 'flex-end' : 'flex-start',
                    }}>
                        {!isMyMessage && (
                            <View style={{ marginRight: 8, marginBottom: 2 }}>
                                <UserPP image={friend?.profilePic} isActive={isFriendOnline} size={36} />
                            </View>
                        )}
                        
                        <View style={{ 
                            maxWidth: '78%',
                            alignItems: isMyMessage ? 'flex-end' : 'flex-start',
                        }}>
                            <View style={{
                                backgroundColor: item.messageType === 'call'
                                    ? (item.callEvent === 'missed' ? (isDarkMode ? '#3a0d12' : '#fee2e2') : (isDarkMode ? '#0f172a' : '#e2e8f0'))
                                    : (isMyMessage ? chatTheme.colors.sentBg : chatTheme.colors.recvBg),
                                paddingHorizontal: 12,
                                paddingVertical: 8,
                                borderRadius: 18,
                                borderBottomLeftRadius: isMyMessage ? 18 : 4,
                                borderBottomRightRadius: isMyMessage ? 4 : 18,
                                borderWidth: highlightedMessageId === item._id ? 3 : 1,
                                borderColor: highlightedMessageId === item._id
                                    ? chatTheme.colors.accent
                                    : (isMyMessage ? chatTheme.colors.sentBorder : chatTheme.colors.recvBorder),
                                position: 'relative',
                            }}>
                                {item.parent ? (
                                    <TouchableOpacity
                                        onPress={() => item.parent?._id && scrollToMessage(item.parent._id)}
                                        activeOpacity={0.7}
                                        style={{
                                            marginBottom: 8,
                                            paddingVertical: 8,
                                            paddingHorizontal: 10,
                                            borderLeftWidth: 3,
                                            borderLeftColor: chatTheme.colors.accent,
                                            backgroundColor: 'rgba(0,0,0,0.18)',
                                            borderRadius: 8,
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                        }}
                                    >
                                        {typeof item.parent.attachment === 'string' && isValidImageUrl(item.parent.attachment) ? (
                                            <Image
                                                source={{ uri: item.parent.attachment }}
                                                style={{ width: 36, height: 36, borderRadius: 6, marginRight: 8 }}
                                            />
                                        ) : null}
                                        <View style={{ flex: 1 }}>
                                            <Text style={{
                                                color: '#FFFFFF',
                                                fontSize: 11,
                                                fontWeight: '700',
                                                marginBottom: 2,
                                            }}>
                                                {String(item.parent.senderId) === String(myProfile?._id) ? 'You' : (friend?.fullName || 'Reply')}
                                            </Text>
                                            <Text numberOfLines={1} style={{
                                                color: 'rgba(255,255,255,0.82)',
                                                fontSize: 12,
                                            }}>
                                                {getMessageSnippet(item.parent)}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                ) : null}
                                
                                {/* Call messages */}
                                {item.messageType === 'call' ? (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <Icon
                                            name={item.callType === 'video' ? 'videocam' : 'call'}
                                            size={18}
                                            color={item.callEvent === 'missed' ? '#ef4444' : (isMyMessage ? '#FFFFFF' : '#000000')}
                                        />
                                        <Text style={{
                                            color: isMyMessage ? '#FFFFFF' : '#000000',
                                            fontSize: 15,
                                            fontWeight: '500',
                                        }}>
                                            {item.message || (item.callEvent === 'missed' ? (item.callType === 'video' ? 'Missed video call' : 'Missed audio call') : (item.callType === 'video' ? 'Video call ended' : 'Audio call ended'))}
                                        </Text>
                                    </View>
                                ) : item.messageType === 'audio' || isAudioUrl(item.attachment || '') ? (
                                    /* Audio messages */
                                    <View style={{ flexDirection: 'row', alignItems: 'center', minWidth: 200 }}>
                                        <TouchableOpacity
                                            onPress={() => togglePlay(item)}
                                            accessibilityLabel={playingId === item._id ? 'Pause voice message' : 'Play voice message'}
                                            style={{ 
                                                width: 40, 
                                                height: 40, 
                                                borderRadius: 20, 
                                                borderWidth: 2, 
                                                borderColor: isMyMessage ? themeColors.border.muted : themeColors.border.subtle, 
                                                backgroundColor: isMyMessage ? 'rgba(255,255,255,0.15)' : (isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'), 
                                                alignItems: 'center', 
                                                justifyContent: 'center', 
                                                marginRight: 10 
                                            }}
                                        >
                                            <Icon 
                                                name={playingId === item._id ? 'pause' : 'play-arrow'} 
                                                size={22} 
                                                color={isMyMessage ? '#fff' : themeColors.primary} 
                                            />
                                        </TouchableOpacity>
                                        <Slider
                                            style={{ flex: 1, height: 30, marginHorizontal: 8 }}
                                            minimumValue={0}
                                            maximumValue={Math.max(1, Math.floor((playingProgress[item._id]?.duration || 0)))}
                                            value={Math.floor(playingProgress[item._id]?.current || 0)}
                                            minimumTrackTintColor={isMyMessage ? '#fff' : themeColors.primary}
                                            maximumTrackTintColor={isMyMessage ? 'rgba(255,255,255,0.35)' : themeColors.gray[400]}
                                            thumbTintColor={isMyMessage ? '#fff' : themeColors.primary}
                                            onSlidingComplete={(val) => seekTo(item, Number(val))}
                                        />
                                        <Text style={{ 
                                            color: isMyMessage ? themeColors.text.inverse : themeColors.text.primary, 
                                            fontSize: 12, 
                                            marginLeft: 8,
                                            fontWeight: '500',
                                            minWidth: 75,
                                        }}>
                                            {formatSecs(playingProgress[item._id]?.current || 0)} / {formatSecs(playingProgress[item._id]?.duration || 0)}
                                        </Text>
                                        {renderHiddenVideo(item)}
                                    </View>
                                ) : (
                                    /* Text messages */
                                    <Text style={{
                                        color: isMyMessage ? chatTheme.colors.sentText : chatTheme.colors.recvText,
                                        fontSize: 15,
                                        lineHeight: 20,
                                    }}>
                                        {item.message}
                                    </Text>
                                )}
                                
                                {/* Images */}
                                {item.attachment && isValidImageUrl(item.attachment) && item.messageType !== 'audio' && (
                                    <Image
                                        source={{ uri: item.attachment }}
                                        style={{ 
                                            width: 220, 
                                            height: 220, 
                                            borderRadius: 12, 
                                            marginTop: 6,
                                        }}
                                        resizeMode="cover"
                                    />
                                )}

                                <View style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'flex-end',
                                    marginTop: 4,
                                    gap: 6,
                                }}>
                                    <Text style={{
                                        color: isMyMessage ? 'rgba(255,255,255,0.78)' : chatTheme.colors.meta,
                                        fontSize: 10,
                                    }}>
                                        {getMessageTime(item.timestamp)}
                                    </Text>
                                    {isMyMessage && item.sendFailed ? (
                                        <TouchableOpacity
                                            onPress={() => {
                                                setMessages(prev => prev.filter(m => m._id !== item._id && m.tempId !== item.tempId));
                                                sendMessage({ message: item.message });
                                            }}
                                        >
                                            <Icon name="error-outline" size={14} color="#fecaca" />
                                        </TouchableOpacity>
                                    ) : isMyMessage ? (
                                        <Icon
                                            name={item.isSeen ? 'done-all' : 'done'}
                                            size={14}
                                            color={item.isSeen ? chatTheme.colors.accent : 'rgba(255,255,255,0.75)'}
                                        />
                                    ) : null}
                                </View>
                                {(Array.isArray(item.reacts) && item.reacts.some((id) => String(id) === String(myProfile?._id) || String(id) === String(friend?._id))) ? (
                                    <View style={{
                                        position: 'absolute',
                                        top: -12,
                                        right: isMyMessage ? undefined : -10,
                                        left: isMyMessage ? -10 : undefined,
                                        backgroundColor: '#6b7280',
                                        borderRadius: 15,
                                        width: 30,
                                        height: 30,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}>
                                        <Text style={{ fontSize: 14 }}>👍</Text>
                                    </View>
                                ) : null}
                            </View>
                        </View>
                        
                        {isMyMessage && (
                            <View style={{ marginLeft: 8, marginBottom: 2 }}>
                                <UserPP image={myProfile?.profilePic} isActive={false} size={36} />
                            </View>
                        )}
                    </View>
                </Pressable>
            </Swipeable>
        );
    };

    const renderTypingIndicator = () => {
        if (!isTyping) return null;

        return (
            <View
                style={{
                    marginHorizontal: 12,
                    marginTop: 4,
                    marginBottom: 8,
                    flexDirection: 'row',
                    alignItems: 'flex-end',
                    zIndex: 3,
                }}
            >
                <UserPP image={friend?.profilePic} isActive={isFriendOnline} size={36} />
                <View
                    style={{
                        marginLeft: 8,
                        backgroundColor: chatTheme.colors.recvBg,
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        borderRadius: 18,
                        borderBottomLeftRadius: 4,
                        maxWidth: '78%',
                        borderWidth: 1,
                        borderColor: chatTheme.colors.recvBorder,
                    }}
                >
                    {typingMessage ? (
                        <Text style={{ color: '#FFFFFF', fontSize: 15, lineHeight: 20 }}>
                            {typingMessage}
                        </Text>
                    ) : (
                        <TypingDots color={chatTheme.colors.accent || '#ffffff'} />
                    )}
                </View>
            </View>
        );
    };

    const renderEmptyConversation = () => (
        <View style={{ alignItems: 'center', paddingTop: 72, paddingHorizontal: 28 }}>
            <UserPP image={friend?.profilePic} isActive={isFriendOnline} size={88} />
            <Text style={{
                color: '#FFFFFF',
                fontSize: 20,
                fontWeight: '700',
                marginTop: 16,
                textAlign: 'center',
            }}>
                {friend?.fullName || 'This user'}
            </Text>
            <Text style={{
                color: chatTheme.colors.meta,
                fontSize: 14,
                marginTop: 6,
                textAlign: 'center',
            }}>
                No messages yet. Say hello to start the conversation!
            </Text>
        </View>
    );

    const renderLoadingOldMessages = () => {
        if (!isLoadingOldMessages) return null;

        return (
            <View style={{ paddingVertical: 10, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="small" color={chatTheme.colors.accent || '#ffffff'} />
            </View>
        );
    };

    const renderBlockedMessage = () => {
        if (!isBlockedByFriend) return null;

        return (
            <View style={{
                backgroundColor: themeColors.surface.header,
                borderTopWidth: 1,
                borderTopColor: themeColors.border.primary,
                paddingHorizontal: 16,
                paddingVertical: 20,
                alignItems: 'center',
                justifyContent: 'center',
            }}>
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: themeColors.status.error + '15',
                    paddingHorizontal: 20,
                    paddingVertical: 12,
                    borderRadius: 25,
                    borderWidth: 1,
                    borderColor: themeColors.status.error + '30',
                }}>
                    <Icon name="block" size={24} color={themeColors.status.error} />
                    <Text style={{
                        color: themeColors.status.error,
                        fontSize: 16,
                        fontWeight: '600',
                        marginLeft: 8,
                    }}>
                        {friend?.fullName || 'This user'} blocked you
                    </Text>
                </View>
                <Text style={{
                    color: themeColors.text.secondary,
                    fontSize: 12,
                    marginTop: 8,
                    textAlign: 'center',
                }}>
                    You can't send messages to this person
                </Text>
            </View>
        );
    };

    const renderSelfBlockedMessage = () => {
        if (!isBlocked) return null;
        return (
            <View style={{
                backgroundColor: themeColors.surface.header,
                borderTopWidth: 1,
                borderTopColor: themeColors.border.primary,
                paddingHorizontal: 16,
                paddingVertical: 20,
                alignItems: 'center',
                justifyContent: 'center',
            }}>
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: themeColors.status.error + '15',
                    paddingHorizontal: 20,
                    paddingVertical: 12,
                    borderRadius: 25,
                    borderWidth: 1,
                    borderColor: themeColors.status.error + '30',
                }}>
                    <Icon name="block" size={24} color={themeColors.status.error} />
                    <Text style={{
                        color: themeColors.status.error,
                        fontSize: 16,
                        fontWeight: '600',
                        marginLeft: 8,
                    }}>
                        You blocked {friend?.fullName || 'this user'}
                    </Text>
                </View>
                <Text style={{
                    color: themeColors.text.secondary,
                    fontSize: 12,
                    marginTop: 8,
                    textAlign: 'center',
                }}>
                    Unblock to send messages
                </Text>
            </View>
        );
    };

    // Short-circuit render when a call is active
    if (isCallActive) {
        return null;
    }

    // Show full skeletons if no friend or profile data
    if (!friend?._id || !myProfile?._id) {
        return (
            <View style={{ flex: 1, backgroundColor: themeColors.background.primary }}>
                <ChatPageSkeleton count={14} />
            </View>
        );
    }

    return (
        <View
            style={{
                flex: 1,
                width: '100%',
                backgroundColor: chatTheme.colors.headerBg,
            }}
        >

            <Pressable
                onPress={dismissKeyboard}
                style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 8,
                paddingTop: Math.max(insets.top, 8) + 10,
                backgroundColor: chatTheme.colors.headerBg,
                borderBottomWidth: 1,
                borderBottomColor: chatTheme.colors.sentBorder,
            }}>
                <TouchableOpacity
                    onPress={() => navigation.navigate('Message', { screen: 'MessageList' })}
                    style={{
                        alignItems: 'flex-start',
                        justifyContent: 'center',
                        marginRight: 5,
                    }}
                >
                    <Icon name="arrow-back" size={22} color="#FFFFFF" />
                </TouchableOpacity>

                <View style={{ flex: 1 }}>

                    <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8 }}>

                        {typeof friendEmotion === 'string' && friendEmotion.length > 0 ? (
                            <Text style={{ fontSize: 22, marginRight: 2 }}>
                                {friendEmotion.split(' ')[0]}
                            </Text>
                        ) : null}

                        <UserPP image={friend?.profilePic} isActive={isFriendOnline} size={35} />


                        <View style={{ flex: 1 }}>
                            <Text
                                style={{
                                    fontSize: 16,
                                    fontWeight: '600',
                                    color: '#FFFFFF',
                                }}
                                numberOfLines={1}
                                ellipsizeMode="tail"
                            >
                                {friend?.fullName || 'Friend'}
                            </Text>
                            <View style={{ marginTop: 1 }}>
                                {isTyping ? (
                                    <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.82)' }} numberOfLines={1}>
                                        {typingMessage && typingMessage.length > 0 ? typingMessage : 'typing...'}
                                    </Text>
                                ) : friendEmotion ? (
                                    <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.82)' }} numberOfLines={1}>
                                        {friendEmotion.split(' ').slice(1).join(' ')}
                                        {friendExpression && friendExpression !== 'none' ? ` • ${friendExpression}` : ''}
                                        {formatHeaderLastSeen(friendLastSeenIso) ? `  |  Last Seen: ${formatHeaderLastSeen(friendLastSeenIso)}` : ''}
                                    </Text>
                                ) : formatHeaderLastSeen(friendLastSeenIso) ? (
                                    <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)' }} numberOfLines={1}>
                                        Last Seen: {formatHeaderLastSeen(friendLastSeenIso)}
                                    </Text>
                                ) : isFriendOnline ? (
                                    <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.82)' }}>Online</Text>
                                ) : null}
                            </View>
                        </View>
                    </View>

                </View>

                <View style={{ position: 'relative', marginLeft: 5 }}>
                    <TouchableOpacity
                        onPress={() => setCallMenuVisible(!callMenuVisible)}
                        style={{
                            width: 35,
                            height: 35,
                            borderRadius: 20,
                            backgroundColor: chatTheme.colors.accent,
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 1001,
                        }}
                    >
                        <Icon name="phone" size={20} color="#041018" />
                    </TouchableOpacity>

                    {callMenuVisible && (
                        <Modal
                            visible={callMenuVisible}
                            transparent={true}
                            animationType="fade"
                            onRequestClose={() => setCallMenuVisible(false)}
                            statusBarTranslucent={true}
                        >
                            <Pressable
                                style={{
                                    flex: 1,
                                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                                }}
                                onPress={() => setCallMenuVisible(false)}
                            >
                                {/* Dropdown Menu positioned above backdrop */}
                                <View style={{
                                    position: 'absolute',
                                    top: Platform.OS === 'ios' ? 100 : 80,
                                    right: 16,
                                    backgroundColor: Platform.OS === 'ios' 
                                        ? (isDarkMode ? 'rgba(36, 37, 38, 0.98)' : 'rgba(255, 255, 255, 0.98)')
                                        : (themeColors.surface.header || themeColors.background.primary || (isDarkMode ? '#242526' : '#FFFFFF')),
                                    borderRadius: 16,
                                    paddingVertical: 8,
                                    minWidth: 200,
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 6 },
                                    shadowOpacity: 0.35,
                                    shadowRadius: 12,
                                    elevation: 15,
                                    borderWidth: 1.5,
                                    borderColor: themeColors.border.primary || (isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)'),
                                    overflow: 'hidden',
                                    // Add subtle background overlay effect
                                    ...(Platform.OS === 'android' && {
                                        backgroundColor: isDarkMode 
                                            ? 'rgba(36, 37, 38, 0.98)' 
                                            : 'rgba(255, 255, 255, 0.98)',
                                    }),
                                }}
                                onStartShouldSetResponder={() => true}
                                onResponderTerminationRequest={() => false}>
                                <TouchableOpacity
                                    onPress={() => {
                                        setCallMenuVisible(false);
                                        handleAudioCall();
                                    }}
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        paddingVertical: 14,
                                        paddingHorizontal: 16,
                                        borderBottomWidth: 1,
                                        borderBottomColor: themeColors.border.primary || 'rgba(255, 255, 255, 0.1)',
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <View style={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: 20,
                                        backgroundColor: themeColors.status.success + '25',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        marginRight: 14,
                                    }}>
                                        <Icon name="call" size={22} color={themeColors.status.success || '#4CAF50'} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{
                                            fontSize: 15,
                                            fontWeight: '600',
                                            color: themeColors.text.primary,
                                        }}>
                                            Audio Call
                                        </Text>
                                        <Text style={{
                                            fontSize: 12,
                                            color: themeColors.text.secondary,
                                            marginTop: 2,
                                        }}>
                                            Start audio call
                                        </Text>
                                    </View>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => {
                                        setCallMenuVisible(false);
                                        handleVideoCall();
                                    }}
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        paddingVertical: 14,
                                        paddingHorizontal: 16,
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <View style={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: 20,
                                        backgroundColor: themeColors.primary + '25',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        marginRight: 14,
                                    }}>
                                        <Icon name="videocam" size={22} color={themeColors.primary} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{
                                            fontSize: 15,
                                            fontWeight: '600',
                                            color: themeColors.text.primary,
                                        }}>
                                            Video Call
                                        </Text>
                                        <Text style={{
                                            fontSize: 12,
                                            color: themeColors.text.secondary,
                                            marginTop: 2,
                                        }}>
                                            Start video call
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                                </View>
                            </Pressable>
                        </Modal>
                    )}
                </View>
                <TouchableOpacity
                    onPress={() => setOptionMenuVisible(true)}
                    style={{
                        width: 35,
                        height: 35,
                        borderRadius: 20,
                        backgroundColor: `${chatTheme.colors.accent}22`,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginLeft: 5,
                        borderWidth: 1,
                        borderColor: chatTheme.colors.sentBorder,
                    }}
                >
                    <Icon name="more-vert" size={20} color="#FFFFFF" />
                </TouchableOpacity>
            </Pressable>

            <View style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>


            {isInitialLoading ? (
                <View style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                    {wallpaper.type === 'image' ? (
                        <ImageBackground
                            source={{ uri: wallpaper.value }}
                            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                            resizeMode="cover"
                        />
                    ) : (
                        <LinearGradient
                            colors={wallpaper.value as [string, string, ...string[]]}
                            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                        />
                    )}
                    {chatAppearance.showBackgroundOverlay !== false ? (
                        <View
                            pointerEvents="none"
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                backgroundColor: chatTheme.colors.overlay,
                                zIndex: 0,
                            }}
                        />
                    ) : null}
                    <ChatBubblesSkeleton count={14} theme={chatTheme.colors} />
                </View>
            ) : (
                <View style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                    {wallpaper.type === 'image' ? (
                        <ImageBackground
                            source={{ uri: wallpaper.value }}
                            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                            resizeMode="cover"
                        />
                    ) : (
                        <LinearGradient
                            colors={wallpaper.value as [string, string, ...string[]]}
                            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                        />
                    )}
                    {chatAppearance.showBackgroundOverlay !== false ? (
                        <View
                            pointerEvents="none"
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                backgroundColor: chatTheme.colors.overlay,
                                zIndex: 0,
                            }}
                        />
                    ) : null}
                    {chatTheme.loveRain ? <LoveEmojiRain burstId={loveRainBurst} /> : null}
                    <FlatList
                        ref={flatListRef}
                        data={listData}
                        renderItem={renderMessage}
                        keyExtractor={(item) => item._id || item.tempId || item.timestamp?.toString()}
                        extraData={`${messages.length}-${isLoadingOldMessages}-${highlightedMessageId}`}
                        style={{ flex: 1, zIndex: 2 }}
                        contentContainerStyle={{
                            flexGrow: 1,
                            paddingTop: 8,
                            paddingBottom: 8,
                        }}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="never"
                        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                        onScrollBeginDrag={dismissKeyboard}
                        onTouchStart={() => {
                            if (emojiPanelOpen || showAttachTray || showMicMenu) {
                                setEmojiPanelOpen(false);
                                setShowAttachTray(false);
                                setShowMicMenu(false);
                            }
                        }}
                        ListEmptyComponent={renderEmptyConversation}
                        ListFooterComponent={renderLoadingOldMessages}
                        onScroll={handleScroll}
                        scrollEventThrottle={16}
                        onViewableItemsChanged={onViewableItemsChanged}
                        viewabilityConfig={viewabilityConfigRef.current as any}
                        onContentSizeChange={handleContentSizeChange}
                        onLayout={() => {
                            if (!hasInitialScrolledRef.current && messages.length > 0 && !isInitialLoading) {
                                scrollToBottom(false);
                            }
                        }}
                        onEndReached={() => {
                            if (skipNextEndReachedRef.current) {
                                skipNextEndReachedRef.current = false;
                                return;
                            }
                            if (!hasInitialScrolledRef.current) return;
                            loadOldMessages();
                        }}
                        onEndReachedThreshold={0.3}
                        onScrollToIndexFailed={(info) => {
                            const wait = new Promise<void>(resolve => setTimeout(() => resolve(), 200));
                            wait.then(() => {
                                flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
                            });
                        }}
                        inverted
                        initialNumToRender={MESSAGES_PER_PAGE}
                        maxToRenderPerBatch={MESSAGES_PER_PAGE}
                        windowSize={12}
                        removeClippedSubviews={false}
                    />
                    {renderTypingIndicator()}
                </View>
            )}


            <Modal
                visible={contextMenuVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setContextMenuVisible(false)}
            >
                <Pressable
                    style={{
                        flex: 1,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    }}
                    onPress={() => setContextMenuVisible(false)}
                >
                    <View
                        style={{
                            position: 'absolute',
                            left: contextMenuPosition.x,
                            top: contextMenuUseBottom ? undefined : contextMenuPosition.y,
                            bottom: contextMenuUseBottom ? contextMenuBottom : undefined,
                            backgroundColor: themeColors.surface.primary,
                            borderRadius: 12,
                            paddingVertical: 8,
                            paddingHorizontal: 4,
                            shadowColor: '#000',
                            shadowOffset: {
                                width: 0,
                                height: 2,
                            },
                            shadowOpacity: 0.25,
                            shadowRadius: 3.84,
                            elevation: 5,
                            minWidth: 160,
                            maxHeight: Dimensions.get('window').height - 80,
                        }}
                    >

                        {selectedMessage?.senderId === myProfile?._id && (
                            <TouchableOpacity
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingVertical: 12,
                                    paddingHorizontal: 16,
                                }}
                                onPress={playSound}
                            >
                                <Icon name="speaker" size={20} color={themeColors.text.primary} />
                                <Text style={{ marginLeft: 12, fontSize: 16, color: themeColors.text.primary }}>
                                    Play Sound
                                </Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingVertical: 12,
                                paddingHorizontal: 16,
                            }}
                            onPress={likeOrUnlikeMessage}
                        >
                            <Icon name={isReactedByMe ? 'thumb-down' : 'thumb-up'} size={20} color={themeColors.text.primary} />
                            <Text style={{ marginLeft: 12, fontSize: 16, color: themeColors.text.primary }}>
                                {isReactedByMe ? 'Unlike' : 'Like'}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingVertical: 12,
                                paddingHorizontal: 16,
                            }}
                            onPress={copyMessage}
                        >
                            <Icon name="content-copy" size={20} color={themeColors.text.primary} />
                            <Text style={{ marginLeft: 12, fontSize: 16, color: themeColors.text.primary }}>
                                Copy
                            </Text>
                        </TouchableOpacity>
                        {selectedMessage?.attachment && isValidImageUrl(selectedMessage.attachment) && (
                            <TouchableOpacity
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingVertical: 12,
                                    paddingHorizontal: 16,
                                }}
                                onPress={viewImage}
                            >
                                <Icon name="photo" size={20} color={themeColors.text.primary} />
                                <Text style={{ marginLeft: 12, fontSize: 16, color: themeColors.text.primary }}>
                                    View Image
                                </Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingVertical: 12,
                                paddingHorizontal: 16,
                            }}
                            onPress={replyToMessage}
                        >
                            <Icon name="reply" size={20} color={themeColors.text.primary} />
                            <Text style={{ marginLeft: 12, fontSize: 16, color: themeColors.text.primary }}>
                                Reply
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingVertical: 12,
                                paddingHorizontal: 16,
                            }}
                            onPress={forwardMessage}
                        >
                            <Icon name="forward" size={20} color={themeColors.text.primary} />
                            <Text style={{ marginLeft: 12, fontSize: 16, color: themeColors.text.primary }}>
                                Forward
                            </Text>
                        </TouchableOpacity>

                        {selectedMessage?.senderId === myProfile?._id && (
                            <TouchableOpacity
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingVertical: 12,
                                    paddingHorizontal: 16,
                                    borderTopWidth: 1,
                                    borderTopColor: themeColors.border.primary,
                                }}
                                onPress={deleteMessage}
                            >
                                <Icon name="delete" size={20} color={themeColors.status.error} />
                                <Text style={{ marginLeft: 12, fontSize: 16, color: themeColors.status.error }}>
                                    Delete
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </Pressable>
            </Modal>


            <Modal
                visible={imageModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={closeImageModal}
            >
                <View style={{
                    flex: 1,
                    backgroundColor: 'rgba(0, 0, 0, 0.9)',
                    justifyContent: 'center',
                    alignItems: 'center',
                }}>

                    <TouchableOpacity
                        onPress={closeImageModal}
                        style={{
                            position: 'absolute',
                            top: 50,
                            right: 20,
                            zIndex: 1000,
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            backgroundColor: 'rgba(255, 255, 255, 0.2)',
                            justifyContent: 'center',
                            alignItems: 'center',
                        }}
                    >
                        <Icon name="close" size={24} color="white" />
                    </TouchableOpacity>


                    <ScrollView
                        horizontal={true}
                        contentContainerStyle={{
                            justifyContent: 'center',
                            alignItems: 'center',
                            minHeight: Dimensions.get('window').height,
                        }}
                        showsHorizontalScrollIndicator={false}
                        showsVerticalScrollIndicator={false}
                    >
                        <Image
                            key={selectedImage}
                            source={{ uri: selectedImage }}
                            style={{
                                width: Dimensions.get('window').width * imageScale,
                                height: Dimensions.get('window').height * imageScale,
                                resizeMode: 'contain',
                            }}
                        />
                    </ScrollView>


                    <View style={{
                        position: 'absolute',
                        bottom: 50,
                        flexDirection: 'row',
                        backgroundColor: 'rgba(0, 0, 0, 0.7)',
                        borderRadius: 25,
                        paddingHorizontal: 20,
                        paddingVertical: 10,
                    }}>
                        <TouchableOpacity
                            onPress={zoomOut}
                            style={{
                                width: 40,
                                height: 40,
                                borderRadius: 20,
                                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                                justifyContent: 'center',
                                alignItems: 'center',
                                marginRight: 10,
                            }}
                        >
                            <Icon name="zoom-out" size={20} color={themeColors.text.inverse} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={resetZoom}
                            style={{
                                width: 40,
                                height: 40,
                                borderRadius: 20,
                                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                                justifyContent: 'center',
                                alignItems: 'center',
                                marginRight: 10,
                            }}
                        >
                            <Icon name="center-focus-strong" size={20} color="white" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={zoomIn}
                            style={{
                                width: 40,
                                height: 40,
                                borderRadius: 20,
                                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                                justifyContent: 'center',
                                alignItems: 'center',
                                marginRight: 10,
                            }}
                        >
                            <Icon name="zoom-in" size={20} color={themeColors.text.inverse} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={downloadImage}
                            style={{
                                width: 40,
                                height: 40,
                                borderRadius: 20,
                                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                                justifyContent: 'center',
                                alignItems: 'center',
                            }}
                        >
                            <Icon name="download" size={20} color={themeColors.text.inverse} />
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal
                visible={optionMenuVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setOptionMenuVisible(false)}
            >
                <TouchableOpacity
                    style={{
                        flex: 1,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        justifyContent: 'flex-end',
                    }}
                    onPress={() => setOptionMenuVisible(false)}
                    activeOpacity={1}
                >
                    <View style={{
                        backgroundColor: themeColors.surface.primary,
                        borderTopLeftRadius: 20,
                        borderTopRightRadius: 20,
                        paddingTop: 20,
                        paddingHorizontal: 20,
                        maxHeight: '80%',
                        minHeight: '40%',
                    }}>
                        <View style={{
                            alignSelf: 'center',
                            width: 40,
                            height: 4,
                            backgroundColor: themeColors.border.primary,
                            borderRadius: 2,
                            marginBottom: 20,
                        }} />

                        <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            marginBottom: 20,
                        }}>
                            <UserPP image={friend?.profilePic} isActive={isFriendOnline} size={50} />
                            <View style={{ marginLeft: 12, flex: 1 }}>
                                <Text style={{
                                    fontSize: 18,
                                    fontWeight: '600',
                                    color: themeColors.text.primary,
                                }}>
                                    {friend?.fullName || 'Friend'}
                                </Text>
                                <Text style={{
                                    fontSize: 14,
                                    color: themeColors.text.secondary,
                                    marginTop: 2,
                                }}>
                                    {friend?.isActive ? 'Online' : 'Away'}
                                </Text>
                            </View>
                        </View>

                        <ScrollView
                            style={{ flex: 1 }}
                            contentContainerStyle={{ paddingBottom: 40 }}
                            showsVerticalScrollIndicator={false}
                        >
                            <TouchableOpacity
                                key="view-profile"
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingVertical: 15,
                                    borderBottomWidth: 1,
                                    borderBottomColor: themeColors.border.primary,
                                }}
                                onPress={() => {
                                    setOptionMenuVisible(false);
                                    navigation.navigate('FriendProfile', { friendId: friend?._id });
                                }}
                            >
                                <View style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 20,
                                    backgroundColor: themeColors.primary + '15',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginRight: 15,
                                }}>
                                    <Icon name="person" size={20} color={themeColors.primary} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{
                                        fontSize: 16,
                                        fontWeight: '500',
                                        color: themeColors.text.primary,
                                    }}>
                                        View Profile
                                    </Text>
                                    <Text style={{
                                        fontSize: 12,
                                        color: themeColors.text.secondary,
                                        marginTop: 2,
                                    }}>
                                        See {friend?.fullName?.split(' ')[0]}'s profile
                                    </Text>
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity
                                key="chat-appearance"
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingVertical: 15,
                                    borderBottomWidth: 1,
                                    borderBottomColor: themeColors.border.primary,
                                }}
                                onPress={() => {
                                    setOptionMenuVisible(false);
                                    setIsChatSettingsOpen(true);
                                }}
                            >
                                <View style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 20,
                                    backgroundColor: chatTheme.colors.accent + '25',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginRight: 15,
                                }}>
                                    <Icon name="palette" size={20} color={chatTheme.colors.accent} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{
                                        fontSize: 16,
                                        fontWeight: '500',
                                        color: themeColors.text.primary,
                                    }}>
                                        Chat appearance
                                    </Text>
                                    <Text style={{
                                        fontSize: 12,
                                        color: themeColors.text.secondary,
                                        marginTop: 2,
                                    }}>
                                        Themes, wallpaper, overlay, and quick emoji
                                    </Text>
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity
                                key="user-info"
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingVertical: 15,
                                    borderBottomWidth: 1,
                                    borderBottomColor: themeColors.border.primary,
                                }}
                                onPress={openUserInfo}
                            >
                                <View style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 20,
                                    backgroundColor: themeColors.primary + '15',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginRight: 15,
                                }}>
                                    <Icon name="info" size={20} color={themeColors.primary} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{
                                        fontSize: 16,
                                        fontWeight: '500',
                                        color: themeColors.text.primary,
                                    }}>
                                        Info
                                    </Text>
                                    <Text style={{
                                        fontSize: 12,
                                        color: themeColors.text.secondary,
                                        marginTop: 2,
                                    }}>
                                        View {friend?.fullName?.split(' ')[0] || 'contact'} details
                                    </Text>
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity
                                key="bump"
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingVertical: 15,
                                    borderBottomWidth: 1,
                                    borderBottomColor: themeColors.border.primary,
                                }}
                                onPress={() => {
                                    setOptionMenuVisible(false);
                                    emit('bump', { friendProfile: friend?._id, myProfile: myProfile?._id });
                                }}
                            >
                                <View style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 20,
                                    backgroundColor: themeColors.primary + '15',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginRight: 15,
                                }}>
                                    <Icon name="notifications" size={20} color={themeColors.primary} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{
                                        fontSize: 16,
                                        fontWeight: '500',
                                        color: themeColors.text.primary,
                                    }}>
                                        Bump
                                    </Text>
                                    <Text style={{
                                        fontSize: 12,
                                        color: themeColors.text.secondary,
                                        marginTop: 2,
                                    }}>
                                        Nudge {friend?.fullName?.split(' ')[0] || 'them'}
                                    </Text>
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity
                                key="search-conversation"
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingVertical: 15,
                                    borderBottomWidth: 1,
                                    borderBottomColor: themeColors.border.primary,
                                }}
                                onPress={() => {
                                    setOptionMenuVisible(false);
                                    Alert.alert('Search', 'Search in conversation feature coming soon!');
                                }}
                            >
                                <View style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 20,
                                    backgroundColor: themeColors.primary + '15',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginRight: 15,
                                }}>
                                    <Icon name="search" size={20} color={themeColors.primary} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{
                                        fontSize: 16,
                                        fontWeight: '500',
                                        color: themeColors.text.primary,
                                    }}>
                                        Search in Conversation
                                    </Text>
                                    <Text style={{
                                        fontSize: 12,
                                        color: themeColors.text.secondary,
                                        marginTop: 2,
                                    }}>
                                        Find messages in this chat
                                    </Text>
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity
                                key="view-media"
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingVertical: 15,
                                    borderBottomWidth: 1,
                                    borderBottomColor: themeColors.border.primary,
                                }}
                                onPress={() => {
                                    setOptionMenuVisible(false);
                                    Alert.alert('Media', 'View shared media feature coming soon!');
                                }}
                            >
                                <View style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 20,
                                    backgroundColor: themeColors.primary + '15',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginRight: 15,
                                }}>
                                    <Icon name="photo-library" size={20} color={themeColors.primary} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{
                                        fontSize: 16,
                                        fontWeight: '500',
                                        color: themeColors.text.primary,
                                    }}>
                                        Media & Files
                                    </Text>
                                    <Text style={{
                                        fontSize: 12,
                                        color: themeColors.text.secondary,
                                        marginTop: 2,
                                    }}>
                                        View shared photos and files
                                    </Text>
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity
                                key="mute-notifications"
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingVertical: 15,
                                    borderBottomWidth: 1,
                                    borderBottomColor: themeColors.border.primary,
                                }}
                                onPress={() => {
                                    setOptionMenuVisible(false);
                                    Alert.alert('Mute', 'Mute conversation feature coming soon!');
                                }}
                            >
                                <View style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 20,
                                    backgroundColor: '#FFA50015',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginRight: 15,
                                }}>
                                    <Icon name="volume-off" size={20} color="#FFA500" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{
                                        fontSize: 16,
                                        fontWeight: '500',
                                        color: themeColors.text.primary,
                                    }}>
                                        Mute Notifications
                                    </Text>
                                    <Text style={{
                                        fontSize: 12,
                                        color: themeColors.text.secondary,
                                        marginTop: 2,
                                    }}>
                                        Stop getting notifications from this chat
                                    </Text>
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity
                                key="block-user"
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingVertical: 15,
                                    borderBottomWidth: 1,
                                    borderBottomColor: themeColors.border.primary,
                                }}
                                onPress={() => {
                                    setOptionMenuVisible(false);
                                    if (isBlocked) {
                                        Alert.alert('Unblock', `Are you sure you want to unblock ${friend?.fullName}?`, [
                                            { text: 'Cancel', style: 'cancel' },
                                            {
                                                text: 'Unblock', style: 'default', onPress: handleUnblockUser
                                            }
                                        ]);
                                    } else {
                                        Alert.alert('Block', `Are you sure you want to block ${friend?.fullName}?`, [
                                            { text: 'Cancel', style: 'cancel' },
                                            {
                                                text: 'Block', style: 'destructive', onPress: handleBlockUser
                                            }
                                        ]);
                                    }
                                }}
                                disabled={isBlocking}
                            >
                                <View style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 20,
                                    backgroundColor: isBlocked ? themeColors.status.success + '15' : themeColors.status.error + '15',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginRight: 15,
                                }}>
                                    <Icon 
                                        name={isBlocked ? "check-circle" : "block"} 
                                        size={20} 
                                        color={isBlocked ? themeColors.status.success : themeColors.status.error} 
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{
                                        fontSize: 16,
                                        fontWeight: '500',
                                        color: isBlocked ? themeColors.status.success : themeColors.status.error,
                                    }}>
                                        {isBlocked ? 'Unblock User' : 'Block User'}
                                    </Text>
                                    <Text style={{
                                        fontSize: 12,
                                        color: (isBlocked ? themeColors.status.success : themeColors.status.error) + '80',
                                        marginTop: 2,
                                    }}>
                                        {isBlocked ? 'Unblock this user' : 'Block and report this user'}
                                    </Text>
                                </View>
                                {isBlocking && (
                                    <View style={{ marginLeft: 10 }}>
                                        <ActivityIndicator size="small" color={themeColors.primary} />
                                    </View>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                key="report-user"
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingVertical: 15,
                                }}
                                onPress={() => {
                                    setOptionMenuVisible(false);
                                    Alert.alert('Report', `Report ${friend?.fullName}?`, [
                                        { text: 'Cancel', style: 'cancel' },
                                        {
                                            text: 'Report', style: 'destructive', onPress: () => {
                                                Alert.alert('Report', 'Report user feature coming soon!');
                                            }
                                        }
                                    ]);
                                }}
                            >
                                <View style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 20,
                                    backgroundColor: themeColors.status.error + '15',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginRight: 15,
                                }}>
                                    <Icon name="flag" size={20} color={themeColors.status.error} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{
                                        fontSize: 16,
                                        fontWeight: '500',
                                        color: themeColors.status.error,
                                    }}>
                                        Report User
                                    </Text>
                                    <Text style={{
                                        fontSize: 12,
                                        color: themeColors.status.error + '80',
                                        marginTop: 2,
                                    }}>
                                        Report inappropriate behavior
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* User Info Modal */}
            <Modal
                visible={infoMenuVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setInfoMenuVisible(false)}
            >
                <Pressable
                    style={{
                        flex: 1,
                        backgroundColor: 'rgba(0, 0, 0, 0.7)',
                        justifyContent: 'flex-end',
                    }}
                    onPress={() => setInfoMenuVisible(false)}
                >
                    <Pressable
                        style={{
                            backgroundColor: themeColors.background.primary,
                            borderTopLeftRadius: 20,
                            borderTopRightRadius: 20,
                            maxHeight: Dimensions.get('window').height * 0.9,
                        }}
                        onPress={(e) => e.stopPropagation()}
                    >
                        <View style={{
                            paddingTop: 20,
                            paddingBottom: 10,
                            borderBottomWidth: 1,
                            borderBottomColor: themeColors.border.primary,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            paddingHorizontal: 20,
                        }}>
                            <Text style={{
                                fontSize: 20,
                                fontWeight: '700',
                                color: themeColors.text.primary,
                            }}>
                                User Information
                            </Text>
                            <TouchableOpacity
                                onPress={() => setInfoMenuVisible(false)}
                                style={{
                                    padding: 5,
                                }}
                            >
                                <Icon name="close" size={24} color={themeColors.text.primary} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            style={{ maxHeight: Dimensions.get('window').height * 0.75 }}
                            showsVerticalScrollIndicator={false}
                        >
                            {loadingUserInfo ? (
                                <View style={{
                                    padding: 60,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}>
                                    <ActivityIndicator size="large" color={themeColors.primary} />
                                    <Text style={{
                                        marginTop: 20,
                                        color: themeColors.text.secondary,
                                        fontSize: 14,
                                    }}>
                                        Loading user information...
                                    </Text>
                                </View>
                            ) : (
                                <>
                                    {/* Header Section */}
                                    <View style={{
                                        alignItems: 'center',
                                        paddingVertical: 30,
                                        paddingHorizontal: 20,
                                        backgroundColor: themeColors.primary + '08',
                                        borderBottomWidth: 1,
                                        borderBottomColor: themeColors.border.primary,
                                    }}>
                                        <View style={{ position: 'relative', marginBottom: 15 }}>
                                            <ProfileImage
                                                uri={userInfoData?.profilePic || friend?.profilePic || ''}
                                                pixelSize={200}
                                                style={{
                                                    width: 100,
                                                    height: 100,
                                                    borderRadius: 50,
                                                    borderWidth: 4,
                                                    borderColor: themeColors.primary + '50',
                                                }}
                                            />
                                            {isFriendOnline && (
                                                <View style={{
                                                    position: 'absolute',
                                                    bottom: 5,
                                                    right: 5,
                                                    width: 20,
                                                    height: 20,
                                                    borderRadius: 10,
                                                    backgroundColor: '#4CAF50',
                                                    borderWidth: 3,
                                                    borderColor: themeColors.background.primary,
                                                }} />
                                            )}
                                        </View>
                                        <Text style={{
                                            fontSize: 24,
                                            fontWeight: '600',
                                            color: themeColors.text.primary,
                                            marginBottom: 8,
                                        }}>
                                            {userInfoData?.fullName || friend?.fullName || (friend?.user?.firstName && friend?.user?.surname ? `${friend.user.firstName} ${friend.user.surname}` : 'Unknown User')}
                                        </Text>
                                        <View style={{
                                            paddingHorizontal: 16,
                                            paddingVertical: 6,
                                            borderRadius: 20,
                                            backgroundColor: isFriendOnline ? '#4CAF5020' : themeColors.gray[100],
                                        }}>
                                            <Text style={{
                                                fontSize: 13,
                                                fontWeight: '500',
                                                color: isFriendOnline ? '#4CAF50' : themeColors.text.secondary,
                                            }}>
                                                {isFriendOnline ? 'Online' : 'Offline'}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Info Cards Section */}
                                    <View style={{ padding: 20 }}>
                                        {/* Last Location Card */}
                                        <View style={{
                                            backgroundColor: themeColors.surface.secondary,
                                            borderRadius: 12,
                                            marginBottom: 16,
                                            borderWidth: 1,
                                            borderColor: themeColors.border.primary,
                                            overflow: 'hidden',
                                        }}>
                                            <View style={{
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                padding: 18,
                                            }}>
                                                <View style={{
                                                    width: 48,
                                                    height: 48,
                                                    borderRadius: 12,
                                                    backgroundColor: '#2196F320',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    marginRight: 16,
                                                }}>
                                                    <Icon name="location-on" size={24} color="#2196F3" />
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={{
                                                        fontSize: 12,
                                                        fontWeight: '600',
                                                        textTransform: 'uppercase',
                                                        letterSpacing: 0.5,
                                                        color: themeColors.text.secondary,
                                                        marginBottom: 6,
                                                    }}>
                                                        {friendLocation ? 'Current Location' : 'Last Location'}
                                                    </Text>
                                                    {friendLocation ? (
                                                        <Text style={{
                                                            fontSize: 14,
                                                            fontWeight: '500',
                                                            color: themeColors.text.primary,
                                                            marginBottom: 4,
                                                        }}>
                                                            {friendLocation.latitude.toFixed(6)}, {friendLocation.longitude.toFixed(6)}
                                                        </Text>
                                                    ) : (
                                                        <Text style={{
                                                            fontSize: 16,
                                                            fontWeight: '500',
                                                            color: themeColors.text.primary,
                                                        }}>
                                                            {userInfoData?.presentAddress || userInfoData?.permanentAddress || friend?.presentAddress || friend?.permanentAddress || 'Not available'}
                                                        </Text>
                                                    )}
                                                    {friendLocation && (
                                                        <TouchableOpacity
                                                            onPress={() => {
                                                                const url = `https://www.google.com/maps?q=${friendLocation.latitude},${friendLocation.longitude}`;
                                                                Linking.openURL(url).catch(err => console.error('Error opening maps:', err));
                                                            }}
                                                            style={{
                                                                marginTop: 8,
                                                                paddingVertical: 6,
                                                                paddingHorizontal: 12,
                                                                backgroundColor: '#2196F3',
                                                                borderRadius: 6,
                                                                alignSelf: 'flex-start',
                                                            }}
                                                        >
                                                            <Text style={{
                                                                fontSize: 12,
                                                                fontWeight: '600',
                                                                color: '#FFFFFF',
                                                            }}>
                                                                Open in Maps
                                                            </Text>
                                                        </TouchableOpacity>
                                                    )}
                                                </View>
                                            </View>
                                            {friendLocation && (
                                                <View style={{
                                                    height: 200,
                                                    width: '100%',
                                                    backgroundColor: themeColors.surface.primary,
                                                }}>
                                                    <WebView
                                                        source={{
                                                            html: `
                                                                <!DOCTYPE html>
                                                                <html>
                                                                <head>
                                                                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                                                    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
                                                                    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
                                                                    <style>
                                                                        body { margin: 0; padding: 0; }
                                                                        #map { width: 100%; height: 100%; }
                                                                    </style>
                                                                </head>
                                                                <body>
                                                                    <div id="map"></div>
                                                                    <script>
                                                                        var map = L.map('map').setView([${friendLocation.latitude}, ${friendLocation.longitude}], 15);
                                                                        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                                                                            attribution: '© OpenStreetMap contributors',
                                                                            maxZoom: 19
                                                                        }).addTo(map);
                                                                        L.marker([${friendLocation.latitude}, ${friendLocation.longitude}]).addTo(map)
                                                                            .bindPopup('Friend Location').openPopup();
                                                                    </script>
                                                                </body>
                                                                </html>
                                                            `,
                                                        }}
                                                        style={{ flex: 1 }}
                                                        javaScriptEnabled={true}
                                                        domStorageEnabled={true}
                                                        startInLoadingState={true}
                                                        renderLoading={() => (
                                                            <View style={{
                                                                position: 'absolute',
                                                                top: 0,
                                                                left: 0,
                                                                right: 0,
                                                                bottom: 0,
                                                                justifyContent: 'center',
                                                                alignItems: 'center',
                                                                backgroundColor: themeColors.surface.primary,
                                                            }}>
                                                                <ActivityIndicator size="large" color={themeColors.primary} />
                                                            </View>
                                                        )}
                                                    />
                                                </View>
                                            )}
                                        </View>

                                        {/* Last Active Card */}
                                        <View style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            padding: 18,
                                            backgroundColor: themeColors.surface.secondary,
                                            borderRadius: 12,
                                            marginBottom: 16,
                                            borderWidth: 1,
                                            borderColor: themeColors.border.primary,
                                        }}>
                                            <View style={{
                                                width: 48,
                                                height: 48,
                                                borderRadius: 12,
                                                backgroundColor: '#4CAF5020',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                marginRight: 16,
                                            }}>
                                                <Icon name="access-time" size={24} color="#4CAF50" />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={{
                                                    fontSize: 12,
                                                    fontWeight: '600',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: 0.5,
                                                    color: themeColors.text.secondary,
                                                    marginBottom: 6,
                                                }}>
                                                    Last Active
                                                </Text>
                                                <Text style={{
                                                    fontSize: 16,
                                                    fontWeight: '500',
                                                    color: themeColors.text.primary,
                                                }}>
                                                    {(() => {
                                                        const lastSeenValue = friendLastSeenIso;
                                                        if (!lastSeenValue) return 'Never';
                                                        if (isFriendOnline) return 'Just now';
                                                        try {
                                                            const lastSeenDate = new Date(lastSeenValue);
                                                            const now = new Date();
                                                            const diffMs = now.getTime() - lastSeenDate.getTime();
                                                            const diffMins = Math.floor(diffMs / 60000);
                                                            const diffHours = Math.floor(diffMs / 3600000);
                                                            const diffDays = Math.floor(diffMs / 86400000);

                                                            if (diffMins < 1) return 'Just now';
                                                            if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
                                                            if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
                                                            if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
                                                            return lastSeenDate.toLocaleDateString();
                                                        } catch (e) {
                                                            return 'Unknown';
                                                        }
                                                    })()}
                                                </Text>
                                            </View>
                                        </View>

                                        {/* Emotion Card */}
                                        <View style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            padding: 18,
                                            backgroundColor: themeColors.surface.secondary,
                                            borderRadius: 12,
                                            marginBottom: 16,
                                            borderWidth: 1,
                                            borderColor: themeColors.border.primary,
                                        }}>
                                            <View style={{
                                                width: 48,
                                                height: 48,
                                                borderRadius: 12,
                                                backgroundColor: '#FFC10720',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                marginRight: 16,
                                            }}>
                                                <Icon name="mood" size={24} color="#FFC107" />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={{
                                                    fontSize: 12,
                                                    fontWeight: '600',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: 0.5,
                                                    color: themeColors.text.secondary,
                                                    marginBottom: 6,
                                                }}>
                                                    Current Emotion
                                                </Text>
                                                <Text style={{
                                                    fontSize: 18,
                                                    fontWeight: '500',
                                                    color: themeColors.text.primary,
                                                }}>
                                                    {friendEmotion || userInfoData?.lastEmotion || (userInfoData?.lastEmotionEmoji && userInfoData?.lastEmotionText ? `${userInfoData.lastEmotionEmoji} ${userInfoData.lastEmotionText}` : 'No emotion detected')}
                                                    {friendExpression && friendExpression !== 'none' && ` • ${friendExpression}`}
                                                </Text>
                                            </View>
                                        </View>

                                        {/* Last Action Card */}
                                        <View style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            padding: 18,
                                            backgroundColor: themeColors.surface.secondary,
                                            borderRadius: 12,
                                            marginBottom: 16,
                                            borderWidth: 1,
                                            borderColor: themeColors.border.primary,
                                        }}>
                                            <View style={{
                                                width: 48,
                                                height: 48,
                                                borderRadius: 12,
                                                backgroundColor: '#9C27B020',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                marginRight: 16,
                                            }}>
                                                <Icon name="flash-on" size={24} color="#9C27B0" />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={{
                                                    fontSize: 12,
                                                    fontWeight: '600',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: 0.5,
                                                    color: themeColors.text.secondary,
                                                    marginBottom: 6,
                                                }}>
                                                    Last Action
                                                </Text>
                                                <Text style={{
                                                    fontSize: 16,
                                                    fontWeight: '500',
                                                    color: themeColors.text.primary,
                                                }}>
                                                    {(() => {
                                                        if (friendEmotion) return 'Sharing emotion';
                                                        if (isFriendOnline) return 'Currently active';
                                                        if (friendLastSeenIso) {
                                                            try {
                                                                const lastSeenDate = new Date(friendLastSeenIso);
                                                                const now = new Date();
                                                                const diffMins = Math.floor((now.getTime() - lastSeenDate.getTime()) / 60000);
                                                                if (diffMins < 60) return 'Recently active';
                                                                return 'Last seen recently';
                                                            } catch (e) {
                                                                return 'Unknown';
                                                            }
                                                        }
                                                        return 'Unknown';
                                                    })()}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>

                                    {/* Footer Actions */}
                                    <View style={{
                                        padding: 20,
                                        borderTopWidth: 1,
                                        borderTopColor: themeColors.border.primary,
                                        flexDirection: 'row',
                                        gap: 12,
                                        justifyContent: 'flex-end',
                                    }}>
                                        <TouchableOpacity
                                            onPress={() => {
                                                setInfoMenuVisible(false);
                                                navigation.navigate('FriendProfile' as never, { friendId: friend?._id } as never);
                                            }}
                                            style={{
                                                paddingVertical: 10,
                                                paddingHorizontal: 24,
                                                borderRadius: 8,
                                                backgroundColor: themeColors.primary,
                                            }}
                                        >
                                            <Text style={{
                                                fontSize: 14,
                                                fontWeight: '600',
                                                color: '#FFFFFF',
                                            }}>
                                                View Full Profile
                                            </Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => setInfoMenuVisible(false)}
                                            style={{
                                                paddingVertical: 10,
                                                paddingHorizontal: 24,
                                                borderRadius: 8,
                                                backgroundColor: themeColors.surface.secondary,
                                                borderWidth: 1,
                                                borderColor: themeColors.border.primary,
                                            }}
                                        >
                                            <Text style={{
                                                fontSize: 14,
                                                fontWeight: '600',
                                                color: themeColors.text.primary,
                                            }}>
                                                Close
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </>
                            )}
                        </ScrollView>
                    </Pressable>
                </Pressable>
            </Modal>

            <View
                style={{
                    width: '100%',
                    marginBottom: composerBottomOffset,
                    zIndex: 60,
                    backgroundColor: chatTheme.colors.footerBg,
                }}
                onLayout={(e) => {
                    const next = e.nativeEvent.layout.height;
                    if (next > 0 && Math.abs(next - composerHeight) > 1) {
                        setComposerHeight(next);
                    }
                }}
            >
            {isBlockedByFriend ? (
                <>{renderBlockedMessage()}</>
            ) : isBlocked ? (
                <>{renderSelfBlockedMessage()}</>
            ) : isInitialLoading ? (
                <ChatComposerSkeleton theme={chatTheme.colors} />
            ) : (
                <View
                    style={{
                        backgroundColor: chatTheme.colors.footerBg,
                        borderTopWidth: 1,
                        borderTopColor: chatTheme.colors.sentBorder,
                        paddingHorizontal: 12,
                        paddingTop: 8,
                        paddingBottom: 30,
                    }}
                >
                {replyingTo ? (
                    <View style={{
                        marginBottom: 8,
                        backgroundColor: chatTheme.colors.recvBg,
                        borderRadius: 12,
                        padding: 10,
                        flexDirection: 'row',
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: chatTheme.colors.recvBorder,
                    }}>
                        <Icon name="reply" size={16} color={chatTheme.colors.accent} style={{ marginRight: 8 }} />
                        <View style={{ flex: 1 }}>
                            <Text style={{ color: chatTheme.colors.meta, fontSize: 11 }}>
                                Replying to {String(replyingTo.senderId) === String(myProfile?._id) ? 'yourself' : (friend?.fullName || 'them')}
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                {typeof replyingTo.attachment === 'string' && isValidImageUrl(replyingTo.attachment) && (
                                    <Image source={{ uri: replyingTo.attachment as string }} style={{ width: 28, height: 28, borderRadius: 4, marginRight: 8 }} />
                                )}
                                <Text numberOfLines={1} style={{ color: '#FFFFFF', fontSize: 13 }}>
                                    {getMessageSnippet(replyingTo)}
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity onPress={() => setReplyingTo(null)} style={{ marginLeft: 8 }}>
                            <Icon name="close" size={18} color={chatTheme.colors.meta} />
                        </TouchableOpacity>
                    </View>
                ) : null}
                {(isUploading || pendingAttachmentLocal || pendingAttachment) ? (
                    <View style={{
                        marginBottom: 8,
                        backgroundColor: chatTheme.colors.recvBg,
                        borderRadius: 12,
                        padding: 8,
                        flexDirection: 'row',
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: chatTheme.colors.recvBorder,
                    }}>
                        {(pendingAttachmentLocal || pendingAttachment) ? (
                            <Image
                                source={{ uri: pendingAttachmentLocal || pendingAttachment || '' }}
                                style={{ width: 48, height: 48, borderRadius: 8, marginRight: 8 }}
                            />
                        ) : null}
                        <View style={{ flex: 1 }}>
                            {isUploading ? (
                                <View style={{ height: 6, backgroundColor: chatTheme.colors.recvBorder, borderRadius: 3, overflow: 'hidden' }}>
                                    <View style={{ width: `${uploadProgress || 0}%`, height: 6, backgroundColor: chatTheme.colors.accent }} />
                                </View>
                            ) : (
                                <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '600' }}>Photo attached</Text>
                            )}
                            <Text style={{ color: chatTheme.colors.meta, fontSize: 11, marginTop: 2 }}>
                                {isUploading ? 'Almost ready…' : 'Will send with your message'}
                            </Text>
                        </View>
                        {!isUploading ? (
                            <TouchableOpacity onPress={removePendingAttachment} style={{ marginLeft: 8 }}>
                                <Icon name="close" size={18} color={chatTheme.colors.meta} />
                            </TouchableOpacity>
                        ) : null}
                    </View>
                ) : null}
                {isRecording ? (
                    <View style={{
                        marginBottom: 8,
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: chatTheme.colors.recvBg,
                        borderRadius: 14,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        borderWidth: 1,
                        borderColor: chatTheme.colors.recvBorder,
                    }}>
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444', marginRight: 8 }} />
                        <Text style={{ color: '#FFFFFF', fontWeight: '600', marginRight: 12 }}>Recording</Text>
                        <Text style={{ color: chatTheme.colors.meta, marginRight: 'auto' }}>{recordTime}</Text>
                        <TouchableOpacity onPress={() => stopRecording(true)} style={{ marginRight: 12 }}>
                            <Icon name="send" size={20} color={chatTheme.colors.accent} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={cancelRecording}>
                            <Icon name="delete" size={20} color={themeColors.status.error} />
                        </TouchableOpacity>
                    </View>
                ) : null}
                {emojiPanelOpen ? (
                    <ScrollView
                        horizontal
                        keyboardShouldPersistTaps="handled"
                        showsHorizontalScrollIndicator={false}
                        style={{ marginBottom: 10 }}
                        contentContainerStyle={{ alignItems: 'center', paddingRight: 8 }}
                    >
                        {COMPOSER_INSERT_EMOJIS.map((emoji) => (
                            <TouchableOpacity
                                key={emoji}
                                onPress={() => insertComposerEmoji(emoji)}
                                style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 12,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginRight: 6,
                                    backgroundColor: chatTheme.colors.recvBg,
                                }}
                            >
                                <Text style={{ fontSize: 22 }}>{emoji}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                ) : null}
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity
                        onPress={toggleAttachTray}
                        disabled={isUploading}
                        style={[composerIconBtn(showAttachTray), { marginRight: 8 }]}
                    >
                        <Icon name={showAttachTray ? 'close' : 'add'} size={22} color={chatTheme.colors.meta} />
                    </TouchableOpacity>

                    <View style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: chatTheme.colors.recvBg,
                        borderRadius: 20,
                        paddingHorizontal: 10,
                        marginRight: 8,
                        borderWidth: 1,
                        borderColor: emojiPanelOpen ? chatTheme.colors.accent : chatTheme.colors.recvBorder,
                    }}>
                        <TextInput
                            ref={inputRef}
                            value={inputText}
                            onChangeText={handleInputChange}
                            onSubmitEditing={() => sendMessage()}
                            onFocus={() => {
                                setShowAttachTray(false);
                                setShowMicMenu(false);
                            }}
                            onBlur={stopTyping}
                            placeholder="Message"
                            placeholderTextColor={chatTheme.colors.meta}
                            underlineColorAndroid="transparent"
                            style={{
                                flex: 1,
                                fontSize: 16,
                                color: '#FFFFFF',
                                maxHeight: 80,
                                minHeight: 40,
                                paddingVertical: 8,
                            }}
                            multiline
                            blurOnSubmit={false}
                            editable={!isRecording && !isUploadingAudio}
                            textAlignVertical="center"
                        />
                        <TouchableOpacity
                            onPress={() => {
                                setShowAttachTray(false);
                                setShowMicMenu(false);
                                setEmojiPanelOpen((open) => !open);
                            }}
                            accessibilityLabel="Emoji"
                            style={{ paddingLeft: 4, paddingVertical: 6 }}
                        >
                            <Icon
                                name={emojiPanelOpen ? 'keyboard' : 'emoji-emotions'}
                                size={22}
                                color={emojiPanelOpen ? chatTheme.colors.accent : chatTheme.colors.meta}
                            />
                        </TouchableOpacity>
                    </View>

                    {(inputText.trim() || pendingAttachment) ? (
                        <TouchableOpacity
                            onPress={() => sendMessage()}
                            disabled={isUploading}
                            style={{
                                width: 38,
                                height: 38,
                                borderRadius: 19,
                                backgroundColor: isUploading ? chatTheme.colors.recvBg : chatTheme.colors.accent,
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <Icon name="send" style={{ marginRight: -2 }} size={18} color={isUploading ? chatTheme.colors.meta : '#041018'} />
                        </TouchableOpacity>
                    ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View>
                                <TouchableOpacity
                                    onPress={handleMicButtonClick}
                                    disabled={isUploadingAudio}
                                    style={composerIconBtn(isRecording || showMicMenu)}
                                >
                                    {isUploadingAudio ? (
                                        <ActivityIndicator color={chatTheme.colors.meta} />
                                    ) : (
                                        <Icon name={isRecording ? 'stop' : 'mic'} size={20} color={isRecording ? '#ef4444' : chatTheme.colors.meta} />
                                    )}
                                </TouchableOpacity>
                                {showMicMenu ? (
                                    <View style={{
                                        position: 'absolute',
                                        bottom: 46,
                                        right: -8,
                                        width: 240,
                                        backgroundColor: '#1c1d1f',
                                        borderRadius: 14,
                                        borderWidth: 1,
                                        borderColor: 'rgba(255,255,255,0.12)',
                                        paddingVertical: 6,
                                        zIndex: 20,
                                        elevation: 12,
                                    }}>
                                        {micMenuView === 'transcribe' ? (
                                            <>
                                                <TouchableOpacity
                                                    onPress={() => setMicMenuView('main')}
                                                    style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}
                                                >
                                                    <Icon name="chevron-left" size={18} color="#fff" />
                                                    <Text style={{ color: '#fff', marginLeft: 8, fontWeight: '600' }}>Live transcribe</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    onPress={() => {
                                                        setShowMicMenu(false);
                                                        Alert.alert('Live transcribe', 'Speech-to-text is available in the web app.');
                                                    }}
                                                    style={{ padding: 12 }}
                                                >
                                                    <Text style={{ color: '#fff', fontWeight: '600' }}>Bangla</Text>
                                                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Recognize speech in Bangla</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    onPress={() => {
                                                        setShowMicMenu(false);
                                                        Alert.alert('Live transcribe', 'Speech-to-text is available in the web app.');
                                                    }}
                                                    style={{ padding: 12 }}
                                                >
                                                    <Text style={{ color: '#fff', fontWeight: '600' }}>English</Text>
                                                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Recognize speech in English</Text>
                                                </TouchableOpacity>
                                            </>
                                        ) : (
                                            <>
                                                <TouchableOpacity
                                                    onPress={() => setMicMenuView('transcribe')}
                                                    style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}
                                                >
                                                    <Icon name="closed-caption" size={20} color={chatTheme.colors.accent} />
                                                    <View style={{ marginLeft: 10, flex: 1 }}>
                                                        <Text style={{ color: '#fff', fontWeight: '600' }}>Live transcribe</Text>
                                                        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Bangla or English speech to text</Text>
                                                    </View>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    onPress={() => {
                                                        setShowMicMenu(false);
                                                        startRecording();
                                                    }}
                                                    style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}
                                                >
                                                    <Icon name="mic" size={20} color={chatTheme.colors.accent} />
                                                    <View style={{ marginLeft: 10, flex: 1 }}>
                                                        <Text style={{ color: '#fff', fontWeight: '600' }}>Voice message</Text>
                                                        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Record audio and send it</Text>
                                                    </View>
                                                </TouchableOpacity>
                                            </>
                                        )}
                                    </View>
                                ) : null}
                            </View>
                            <TouchableOpacity
                                onPress={handleEmojiPress}
                                disabled={!isConnected}
                                accessibilityLabel="Send reaction"
                                style={[composerIconBtn(), { marginLeft: 8 }]}
                            >
                                <Text style={{ fontSize: 18 }}>{chatAppearance.actionEmoji || '👍'}</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
                {showAttachTray ? (
                    <View style={{ marginTop: 12 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            {[
                                { key: 'photo', label: 'Photo', icon: 'image', onPress: () => pickAndUploadImage(false) },
                                { key: 'file', label: 'File', icon: 'attach-file', onPress: pickAndUploadFile },
                                { key: 'live', label: isLiveVoiceActive ? 'Stop' : 'Live', icon: isLiveVoiceActive ? 'phone-disabled' : 'headset', onPress: () => { setShowAttachTray(false); handleLiveVoiceButtonClick(); } },
                                { key: 'react', label: 'React', icon: null, onPress: () => { setShowAttachTray(false); handleEmojiPress(); } },
                                { key: 'edit', label: 'Edit', icon: 'edit', onPress: () => setEditReactionOpen((v) => !v) },
                            ].map((item) => (
                                <TouchableOpacity
                                    key={item.key}
                                    onPress={item.onPress}
                                    style={{ alignItems: 'center', width: '18%' }}
                                >
                                    <View style={{
                                        width: 48,
                                        height: 48,
                                        borderRadius: 16,
                                        backgroundColor: chatTheme.colors.recvBg,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        marginBottom: 6,
                                        borderWidth: 1,
                                        borderColor: chatTheme.colors.recvBorder,
                                    }}>
                                        {item.key === 'react' ? (
                                            <Text style={{ fontSize: 22 }}>{chatAppearance.actionEmoji || '👍'}</Text>
                                        ) : (
                                            <Icon name={item.icon as string} size={22} color={chatTheme.colors.meta} />
                                        )}
                                    </View>
                                    <Text style={{ color: chatTheme.colors.meta, fontSize: 11 }}>{item.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        {editReactionOpen ? (
                            <ScrollView
                                horizontal
                                keyboardShouldPersistTaps="handled"
                                style={{ marginTop: 10 }}
                                showsHorizontalScrollIndicator={false}
                            >
                                {QUICK_REACTION_PRESETS.map((emoji) => (
                                    <TouchableOpacity
                                        key={emoji}
                                        onPress={() => {
                                            void updateChatAppearance({ actionEmoji: emoji });
                                            setEditReactionOpen(false);
                                        }}
                                        style={{
                                            width: 40,
                                            height: 40,
                                            borderRadius: 12,
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            marginRight: 6,
                                            backgroundColor: chatAppearance.actionEmoji === emoji ? `${chatTheme.colors.accent}33` : chatTheme.colors.recvBg,
                                            borderWidth: 1,
                                            borderColor: chatAppearance.actionEmoji === emoji ? chatTheme.colors.accent : chatTheme.colors.recvBorder,
                                        }}
                                    >
                                        <Text style={{ fontSize: 20 }}>{emoji}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        ) : null}
                    </View>
                ) : null}
                </View>
            )}
            </View>
            </View>

            {/* Video and Audio Call Components */}
            {/* VideoCall and AudioCall components now rendered globally in App.tsx */}

            <ChatSettingsModal
                isOpen={isChatSettingsOpen}
                onRequestClose={() => setIsChatSettingsOpen(false)}
                friendId={friend?._id}
                friendProfile={friend}
            />

            {/* Live Voice Modal */}
            <LiveVoiceModal
                isOpen={isLiveVoiceModalOpen}
                onClose={() => setIsLiveVoiceModalOpen(false)}
                isActive={isLiveVoiceActive}
                duration={liveVoiceDuration}
                isConnecting={isLiveVoiceConnecting}
                role={liveVoiceRole}
                friendName={friend?.fullName || friend?.user?.firstName || 'Friend'}
                onStop={liveVoiceRole === 'sender' ? handleLiveVoiceButtonClick : undefined}
            />

            {/* Hidden camera for emotion detection - keep mounted and active while on page */}
            {settings.settings?.isShareEmotion && cameraDevice && isCameraActive && shouldUseCamera && (
                <View style={{ position: 'absolute', width: 200, height: 200, opacity: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: -1, left: -1000, top: -1000 }}>
                    <CameraView
                        ref={handleCameraRef}
                        facing={cameraDevice?.position === 'front' ? 'front' : 'back'}
                        mode="picture"
                        style={{ width: 200, height: 200 }}
                    />
                </View>
            )}
        </View>
    );
};

export default SingleMessage;