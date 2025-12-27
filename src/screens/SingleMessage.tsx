import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
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
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Swipeable } from 'react-native-gesture-handler';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Slider from '@react-native-community/slider';
import { check, request, PERMISSIONS, RESULTS, openSettings } from 'react-native-permissions';
import Video from 'react-native-video';
import AudioRecorderPlayerModule from 'react-native-audio-recorder-player';
import { useTheme } from '../contexts/ThemeContext';
import { ChatHeaderSkeleton, ChatBubblesSkeleton } from '../components/skeleton/ChatSkeleton';
import { SkeletonBlock } from '../components/skeleton/Skeleton';
import UserPP from '../components/UserPP';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import { markMessagesAsRead, addNewMessage, updateUnreadMessageCount } from '../reducers/chatReducer';
import { useSocket } from '../contexts/SocketContext';
import moment from 'moment';
import { launchImageLibrary } from 'react-native-image-picker';
import api, { friendAPI } from '../lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { backgroundTtsService } from '../lib/backgroundTtsService';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import { useSettings } from '../contexts/SettingsContext';
import { io, Socket } from 'socket.io-client';
import config from '../lib/config';
import RtcEngine from 'react-native-agora';
import LiveVoiceModal from '../components/LiveVoiceModal';
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
}

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
    const CHAT_BG_STORAGE_KEY = '@chat_background_image';
    const getMessagesStorageKey = (friendId: string) => `@chat_messages_${friendId}`;

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
                StatusBar.setBarStyle(isDarkMode ? 'light-content' : 'dark-content');
                if (Platform.OS === 'android') {
                    StatusBar.setTranslucent(false);
                    StatusBar.setBackgroundColor(themeColors.background.primary);
                }
            } catch (e) {}
            return () => {};
        }, [isDarkMode, themeColors.background.primary])
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

    // Voice message (recording) - use instance directly
    const audioRecorderPlayerRef = React.useRef<any>(null);
    
    React.useEffect(() => {
        // The library exports the class itself, we need to instantiate it
        try {
            // Try multiple ways to get the constructor
            let AudioRecorderPlayerClass: any = null;
            
            // Check if it's already a constructor
            if (typeof AudioRecorderPlayerModule === 'function') {
                AudioRecorderPlayerClass = AudioRecorderPlayerModule;
            } 
            // Check if it has a default export
            else if (typeof (AudioRecorderPlayerModule as any).default === 'function') {
                AudioRecorderPlayerClass = (AudioRecorderPlayerModule as any).default;
            }
            // Try accessing constructor or __proto__
            else {
                const moduleAsAny = AudioRecorderPlayerModule as any;
                if (typeof moduleAsAny.constructor === 'function') {
                    AudioRecorderPlayerClass = moduleAsAny.constructor;
                } else {
                    AudioRecorderPlayerClass = Object.getPrototypeOf(AudioRecorderPlayerModule).constructor;
                }
            }
            
            if (!AudioRecorderPlayerClass) {
                throw new Error('Could not find AudioRecorderPlayer constructor');
            }
            
            audioRecorderPlayerRef.current = new AudioRecorderPlayerClass();
            console.log('AudioRecorderPlayer initialized successfully');
        } catch (e) {
            console.error('Error initializing AudioRecorderPlayer:', e);
            audioRecorderPlayerRef.current = null;
        }
        
        return () => {
            try {
                if (audioRecorderPlayerRef.current) {
                    // Clean up any active recording or playback
                    if (typeof audioRecorderPlayerRef.current.removeRecordBackListener === 'function') {
                        audioRecorderPlayerRef.current.removeRecordBackListener();
                    }
                    if (typeof audioRecorderPlayerRef.current.removePlayBackListener === 'function') {
                        audioRecorderPlayerRef.current.removePlayBackListener();
                    }
                    // Try to stop recorder if still active
                    if (isRecording && typeof audioRecorderPlayerRef.current.stopRecorder === 'function') {
                        audioRecorderPlayerRef.current.stopRecorder().catch(() => {});
                    }
                }
            } catch (e) {
                console.error('Error cleaning up AudioRecorderPlayer:', e);
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
    const liveVoiceEngineRef = useRef<RtcEngine | null>(null);
    const isLiveVoiceActiveRef = useRef(false);
    const liveVoiceDurationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    
    // Get camera device for emotion detection
    const cameraDevice = useCameraDevice('front');

    const ensureCameraPermission = async () => {
        try {
            let permission: any;
            if (Platform.OS === 'android') {
                permission = PERMISSIONS.ANDROID.CAMERA;
            } else if (Platform.OS === 'ios') {
                permission = PERMISSIONS.IOS.CAMERA;
            }
            if (!permission) {
                // If no permission system, assume granted
                setIsCameraPermissionGranted(true);
                return true;
            }
            
            let result = await check(permission);
            console.log('[SingleMessage] 📷 Camera permission check result:', result);
            
            if (result === RESULTS.GRANTED) {
                setIsCameraPermissionGranted(true);
                return true;
            }
            
            if (result === RESULTS.DENIED) {
                console.log('[SingleMessage] 📷 Camera permission denied, requesting...');
                result = await request(permission);
                console.log('[SingleMessage] 📷 Camera permission request result:', result);
                
                if (result === RESULTS.GRANTED) {
                    setIsCameraPermissionGranted(true);
                    return true;
                }
            }
            
            if (result === RESULTS.BLOCKED) {
                console.warn('[SingleMessage] 📷 Camera permission is blocked, user needs to enable in Settings');
                setIsCameraPermissionGranted(false);
                Alert.alert('Permission needed', 'Please enable camera permission in Settings.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Open Settings', onPress: () => openSettings() }
                ]);
            } else {
                // UNAVAILABLE or other status
                console.warn('[SingleMessage] 📷 Camera permission unavailable or not granted:', result);
                setIsCameraPermissionGranted(false);
            }
            
            return false;
        } catch (e) {
            console.error('[SingleMessage] ❌ Error checking camera permission:', e);
            setIsCameraPermissionGranted(false);
            return false;
        }
    };

    const ensureMicPermission = async () => {
        try {
            let permission: any;
            if (Platform.OS === 'android') {
                permission = PERMISSIONS.ANDROID.RECORD_AUDIO;
            } else if (Platform.OS === 'ios') {
                permission = PERMISSIONS.IOS.MICROPHONE;
            }
            if (!permission) return true;
            let result = await check(permission);
            if (result === RESULTS.DENIED) {
                result = await request(permission);
            }
            if (result === RESULTS.GRANTED) {
                setIsMicPermissionGranted(true);
                return true;
            }
            if (result === RESULTS.BLOCKED) {
                Alert.alert('Permission needed', 'Please enable microphone permission in Settings.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Open Settings', onPress: () => openSettings() }
                ]);
            }
            return false;
        } catch (e) {
            return false;
        }
    };

    const startRecording = async () => {
        console.log('startRecording called', { isRecording, isUploadingAudio, hasRecorder: !!audioRecorderPlayerRef.current });
        if (isRecording || isUploadingAudio) return;
        
        const ok = await ensureMicPermission();
        if (!ok) {
            console.log('Microphone permission not granted');
            return;
        }
        
        try {
            // Always create a fresh instance to avoid Android MediaRecorder state issues
            try {
                // Clean up old instance if it exists
                if (audioRecorderPlayerRef.current) {
                    try {
                        audioRecorderPlayerRef.current.removeRecordBackListener();
                    } catch (e) {
                        // Ignore errors when removing non-existent listener
                    }
                }
                
                // Try to create a new instance - try different ways
                let AudioRecorderPlayerClass;
                if (typeof AudioRecorderPlayerModule === 'function') {
                    AudioRecorderPlayerClass = AudioRecorderPlayerModule;
                } else if (typeof (AudioRecorderPlayerModule as any).default === 'function') {
                    AudioRecorderPlayerClass = (AudioRecorderPlayerModule as any).default;
                } else if (typeof (AudioRecorderPlayerModule as any).constructor === 'function') {
                    AudioRecorderPlayerClass = (AudioRecorderPlayerModule as any).constructor;
                } else {
                    AudioRecorderPlayerClass = Object.getPrototypeOf(AudioRecorderPlayerModule).constructor;
                }
                
                audioRecorderPlayerRef.current = new AudioRecorderPlayerClass();
                console.log('Recorder initialized for new recording');
            } catch (reinitError) {
                console.error('Error initializing recorder:', reinitError);
                Alert.alert('Voice recording unavailable', 'Recorder not initialized. Please restart the app.');
                return;
            }
            
            // Create a unique file path to avoid conflicts
            const path = Platform.select({ 
                ios: `voice_${Date.now()}.m4a`, 
                android: undefined // Let the library handle the path on Android
            });
            
            console.log('Starting recording with path:', path);
            const uri = await audioRecorderPlayerRef.current.startRecorder(path);
            console.log('Recording started, URI:', uri);
            
            setIsRecording(true);
            setRecordSecs(0);
            setRecordTime('00:00');
            
            audioRecorderPlayerRef.current.addRecordBackListener((e: any) => {
                const secs = Math.floor(e.currentPosition / 1000);
                setRecordSecs(secs);
                setRecordTime(formatSecs(secs));
            });
        } catch (e: any) {
            console.error('Error in startRecording:', e);
            setIsRecording(false);
            setRecordSecs(0);
            setRecordTime('00:00');
            
            // Try to clean up any partial recording
            try {
                if (audioRecorderPlayerRef.current) {
                    audioRecorderPlayerRef.current.removeRecordBackListener();
                }
            } catch (cleanupError) {
                console.warn('Error cleaning up after failed start:', cleanupError);
            }
            
            Alert.alert('Recording failed', e?.message || 'Could not start recording. Please try again.');
        }
    };

    const stopRecording = async (shouldSend: boolean) => {
        console.log('stopRecording called', { shouldSend, isRecording });
        
        // Don't do anything if we're not actually recording
        if (!isRecording) {
            console.log('Not currently recording, ignoring stop request');
            return;
        }
        
        // Mark as not recording immediately to prevent duplicate calls
        setIsRecording(false);
        
        try {
            if (!audioRecorderPlayerRef.current) {
                console.error('AudioRecorderPlayer is null in stopRecording');
                setRecordSecs(0);
                setRecordTime('00:00');
                return;
            }
            
            // First, remove the listener to prevent any callbacks
            try {
                audioRecorderPlayerRef.current.removeRecordBackListener();
            } catch (e) {
                console.warn('Error removing record back listener:', e);
            }
            
            // Stop the recorder
            const resultPath = await audioRecorderPlayerRef.current.stopRecorder();
            console.log('Recording stopped, result path:', resultPath);
            
            setRecordSecs(0);
            setRecordTime('00:00');
            
            if (shouldSend && resultPath) {
                await uploadAndSendAudio(resultPath);
            }
        } catch (e) {
            console.error('Error in stopRecording:', e);
            setRecordSecs(0);
            setRecordTime('00:00');
            
            // Try to reset the recorder state
            try {
                if (audioRecorderPlayerRef.current) {
                    audioRecorderPlayerRef.current.removeRecordBackListener();
                }
            } catch (cleanupError) {
                console.warn('Error cleaning up after failed stop:', cleanupError);
            }
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
                paused={playingId !== item._id}
                playInBackground={true}
                ignoreSilentSwitch={"obey"}
                onProgress={(e: any) => onVideoProgress(item, e)}
                onLoad={(e: any) => onVideoLoad(item, e)}
                onEnd={() => onVideoEnd(item)}
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
    const [isBlocked, setIsBlocked] = useState<boolean>(false);
    
    // Emotion detection state
    const emotionServerSocketRef = React.useRef<Socket | null>(null);
    const cameraRef = React.useRef<Camera>(null);
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
    const previousCameraRef = React.useRef<Camera | null>(null);
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
    const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
    
    // Message-related state - MUST be before early returns to follow React hooks rules
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [typingMessage, setTypingMessage] = useState('');
    const [pendingMessages, setPendingMessages] = useState<Message[]>([]);
    const flatListRef = useRef<FlatList>(null);
    const inputRef = useRef<TextInput>(null);
    const scrollOffsetRef = useRef<number>(0);
    const lastLoadTimestampRef = useRef<number>(0);
    const visibleMessageIdRef = useRef<string | null>(null);

    // Pagination state for loading old messages
    const [isLoadingOldMessages, setIsLoadingOldMessages] = useState(false);
    const [hasMoreMessages, setHasMoreMessages] = useState(true);
    const [currentPage, setCurrentPage] = useState(0);
    const messagesPerPage = 20;

    // Helper function to save messages to AsyncStorage
    const saveMessagesToStorage = async (friendId: string, messagesToSave: Message[]) => {
        try {
            if (!friendId || !messagesToSave || messagesToSave.length === 0) return;
            
            // Serialize messages - convert Date objects to ISO strings
            const serializedMessages = messagesToSave.map(msg => ({
                ...msg,
                timestamp: msg.timestamp instanceof Date ? msg.timestamp.toISOString() : msg.timestamp,
            }));
            
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
        on('videoCallEnd', handleVideoEnd);
        on('audio-call-ended', handleAudioEnd);
        return () => {
            off('call-accepted', handleCallAccepted);
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
            try { checkUserActive(friend._id, myProfile._id); } catch (_) {}

            // Set up room joined listener
            const handleRoomJoined = ({ room }: { room: string }) => {
                console.log(`Joined room: ${room}`);
                // Note: localStorage is not available in React Native, use AsyncStorage instead
                // localStorage.setItem('roomId', room);
            };

            on('roomJoined', handleRoomJoined);

            // Cleanup listener when component unmounts or dependencies change
            return () => {
                off('roomJoined', handleRoomJoined);
            };
        }
    }, [friend?._id, myProfile?._id, isConnected, emit, on, off, checkUserActive]);

    // Check if user is blocked when component loads
    useEffect(() => {
        const checkBlockStatus = async () => {
            if (!friend?._id || !myProfile?._id) return;

            try {
                // Check if the friend is in the blocked users list
                const response = await api.get(`/profile?profileId=${myProfile._id}`);
                if (response.status === 200 && response.data?.blockedUsers) {
                    const isUserBlocked = response.data.blockedUsers.includes(friend._id);
                    setIsBlocked(isUserBlocked);
                }
            } catch (error) {
                console.error('Error checking block status:', error);
            }
        };

        checkBlockStatus();
    }, [friend?._id, myProfile?._id]);

    // Check if current user is blocked by friend
    useEffect(() => {
        const checkIfBlockedByFriend = async () => {
            if (!friend?._id || !myProfile?._id) return;

            try {
                // Check if current user is in the friend's blocked users list
                const response = await api.get(`/profile?profileId=${friend._id}`);
                if (response.status === 200 && response.data?.blockedUsers) {
                    const isBlockedByFriend = response.data.blockedUsers.includes(myProfile._id);
                    setIsBlockedByFriend(isBlockedByFriend);
                }
            } catch (error) {
                console.error('Error checking if blocked by friend:', error);
            }
        };

        checkIfBlockedByFriend();
    }, [friend?._id, myProfile?._id]);

    // Fetch initial messages - load from storage first, then fetch from server
    useEffect(() => {
        console.log('Initial messages fetch effect triggered:', { friendId: friend?._id });
        
        if (!friend?._id) {
            console.log('Initial fetch blocked - no friendId');
            return;
        }
        
        // Reset when friend changes
        setMessages([]);
        setCurrentPage(0);
        setIsInitialLoading(true);
        
        console.log('Loading messages for friend:', friend._id);
        
        const loadAndFetchMessages = async () => {
            try {
                // First, load messages from AsyncStorage
                const storedMessages = await loadMessagesFromStorage(friend._id);
                
                if (storedMessages.length > 0) {
                    console.log(`Loaded ${storedMessages.length} messages from storage, displaying them immediately`);
                    setMessages(storedMessages);
                    // Hide skeleton immediately if we have stored messages
                    setIsInitialLoading(false);
                } else {
                    console.log('No stored messages found - will show skeleton until server fetch completes');
                    // Keep skeleton visible if no stored messages
                }
                
                // Then fetch fresh messages from server
                console.log('API call starting for getChatHistory');
                const response = await api.get('/message/getChatHistory', {
                    params: {
                        friendId: friend?._id,
                        limit: messagesPerPage
                    }
                });
                
                console.log('API response received:', { status: response.status, dataLength: response.data?.messages?.length });
                
                const httpMessages = response.data?.messages || [];
                const hasMore = response.data?.hasMore || false;
                
                console.log('Fetched initial messages from HTTP:', { 
                    count: httpMessages.length, 
                    hasMore 
                });
                
                if (httpMessages.length > 0) {
                    const validHttpMessages = httpMessages.filter((msg: any) => msg && msg._id);
                    console.log('Setting messages with count:', validHttpMessages.length);
                    
                    // Merge with stored messages, avoiding duplicates
                    setMessages(prev => {
                        const existingIds = new Set(prev.map(m => m._id));
                        const newMessages = validHttpMessages.filter((msg: any) => !existingIds.has(msg._id));
                        const merged = [...prev, ...newMessages].sort((a, b) => {
                            const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
                            const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
                            return timeA - timeB;
                        });
                        return merged;
                    });
                    
                    setHasMoreMessages(hasMore);
                    console.log('Messages state updated successfully');
                } else {
                    console.log('No messages received from API');
                    setHasMoreMessages(false);
                }
            } catch (error: any) {
                console.error('Error fetching initial messages from HTTP:', error);
                console.error('Error details:', error?.response?.data || error?.message);
                setHasMoreMessages(false);
            } finally {
                // Turn off initial loading skeleton once fetch completes
                // Only if it wasn't already turned off by stored messages
                setIsInitialLoading(false);
            }
        };
        
        loadAndFetchMessages();
    }, [friend?._id]);

    // Save messages to AsyncStorage whenever they change
    useEffect(() => {
        if (!friend?._id || messages.length === 0) return;
        
        // Debounce the save operation to avoid too many writes
        debouncedSaveMessages(friend._id, messages);
        
        // Cleanup timeout on unmount or when friend changes
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
                // Save immediately on cleanup if there's pending data
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
            console.log('New message received:', messageData, messages);
            let updatedMessage = messageData.updatedMessage;
            // Add the new message to the messages state
            const newMessage: Message = {
                _id: updatedMessage._id || Date.now().toString(),
                message: updatedMessage.message || '',
                receiverId: updatedMessage.receiverId,
                senderId: updatedMessage.senderId,
                tempId: updatedMessage.tempId,
                timestamp: new Date(updatedMessage.timestamp || Date.now()),
                isSeen: false,
                room,
                attachment: updatedMessage.attachment,
                parent: updatedMessage.parent || null,
                messageType: updatedMessage.messageType,
                callType: updatedMessage.callType,
                callEvent: updatedMessage.callEvent,
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
                __v: 0
            };

            if (messageData.chatPage === true) {

                setMessages(prev => {
                    // If a message with the same tempId exists, replace it with the new message
                    const tempId = newMessage.tempId;
                    if (tempId) {
                        const index = prev.findIndex(msg => msg.tempId && msg.tempId === tempId);
                        if (index !== -1) {
                            // Replace the message at the found index
                            const updated = [...prev];
                            updated[index] = newMessage;
                            return updated;
                        }
                    }
                    // Otherwise, append as new
                    return [...prev, newMessage];
                });
                
                // Remove from pending messages when real message arrives
                if (newMessage.tempId) {
                    setPendingMessages(prev => prev.filter(msg => msg.tempId !== newMessage.tempId));
                }

                // Dispatch action to update message count in Redux
                dispatch(addNewMessage({
                    chatId: friend?._id,
                    message: serializableMessage,
                    currentUserId: myProfile?._id
                }));

                // setMessages(prev => [...prev, newMessage]);
            }
        };

        const handleReceiveTyping = (typingData: any) => {
            console.log('Typing:', typingData);
            setIsTyping(typingData.isTyping);
            setTypingMessage(typingData.type || '');

            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);

        };

        const handleSeenMessage = (message: any) => {
            console.log('Seen message:', message, messages);

            setMessages((prevMessages) =>
                prevMessages.map((msg) =>
                    msg._id === message._id ? { ...msg, isSeen: true } : msg
                )
            );
            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
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

        on('seenMessage', handleSeenMessage);

        on('newMessage', handleNewMessage);
        on('typing', handleReceiveTyping);

        const handleDeleteMessage = (messageId: string) => {
            setMessages(prev => prev.filter(msg => msg._id !== messageId));
        };

        on('deleteMessage', handleDeleteMessage);

        // Live voice listeners
        const handleLiveVoiceStart = async ({ channelName }: { channelName: string }) => {
            try {
                // Leave any existing connection
                if (liveVoiceEngineRef.current) {
                    try {
                        await liveVoiceEngineRef.current.leaveChannel();
                        await liveVoiceEngineRef.current.destroy();
                    } catch (e) {
                        console.warn('Error leaving existing live voice:', e);
                    }
                    liveVoiceEngineRef.current = null;
                }

                // Generate consistent UID from profileId hash (subscriber uses baseUid)
                const generateUid = (str: string) => {
                    let hash = 0;
                    for (let i = 0; i < str.length; i++) {
                        hash = ((hash << 5) - hash) + str.charCodeAt(i);
                        hash |= 0;
                    }
                    return Math.abs(hash);
                };
                const numericUid = generateUid(myProfile?._id || '0');

                // Get token
                const { data } = await api.post('/agora/token', { channelName, uid: numericUid, role: 'subscriber' });
                
                // Initialize engine
                const engine = await RtcEngine.create(data.appId);
                await engine.enableAudio();
                
                // Set channel profile to Communication mode (0) to match web RTC mode
                await engine.setChannelProfile(0); // 0 = Communication (RTC mode)
                
                // Enable all remote audio streams (important for receiving audio in Communication mode)
                await engine.muteAllRemoteAudioStreams(false);
                
                // Set up event handlers
                engine.addListener('UserJoined', (uid) => {
                    console.log('Live voice: User joined', uid);
                    // Ensure remote audio is enabled for the joined user
                    engine.muteRemoteAudioStream(uid, false).catch(e => console.warn('Failed to unmute remote audio:', e));
                });
                
                engine.addListener('UserOffline', (uid) => {
                    console.log('Live voice: User offline', uid);
                });
                
                engine.addListener('RemoteAudioStateChanged', (uid, state, reason, elapsed) => {
                    console.log('Live voice: Remote audio state changed', { uid, state, reason });
                    // state: 0 = STATE_STOPPED, 1 = STATE_STARTING, 2 = STATE_DECODING, 3 = STATE_FAILED
                    if (state === 1 || state === 2) { // STATE_STARTING or STATE_DECODING
                        console.log('Live voice: Remote audio starting/decoding');
                        // Ensure audio is unmuted
                        engine.muteRemoteAudioStream(uid, false).catch(e => console.warn('Failed to unmute remote audio:', e));
                    }
                });
                
                // Join channel (no role needed in Communication mode)
                await engine.joinChannel(data.token, channelName, null, numericUid);

                liveVoiceEngineRef.current = engine;
                setIsLiveVoiceActive(true);
                setLiveVoiceDuration(0);
                setLiveVoiceRole('receiver');
                setIsLiveVoiceModalOpen(true);
                
                // Start duration timer
                if (liveVoiceDurationTimerRef.current) {
                    clearInterval(liveVoiceDurationTimerRef.current);
                }
                liveVoiceDurationTimerRef.current = setInterval(() => {
                    setLiveVoiceDuration(prev => prev + 1);
                }, 1000);
            } catch (e) {
                console.error('Live voice subscribe failed:', e);
                setIsLiveVoiceActive(false);
                setIsLiveVoiceModalOpen(false);
            }
        };

        const handleLiveVoiceStop = async () => {
            try {
                if (liveVoiceEngineRef.current) {
                    await liveVoiceEngineRef.current.leaveChannel();
                    await liveVoiceEngineRef.current.destroy();
                    liveVoiceEngineRef.current = null;
                }
            } catch (e) {
                console.warn('Error stopping live voice:', e);
            }
            setIsLiveVoiceActive(false);
            setIsLiveVoiceModalOpen(false);
            setLiveVoiceDuration(0);
            setLiveVoiceRole('sender');
            if (liveVoiceDurationTimerRef.current) {
                clearInterval(liveVoiceDurationTimerRef.current);
                liveVoiceDurationTimerRef.current = null;
            }
        };

        const handleLiveVoiceLeaveSubscriber = async ({ channelName }: { channelName: string }) => {
            if (liveVoiceEngineRef.current && isLiveVoiceActive) {
                await handleLiveVoiceStop();
            }
        };

        on('live-voice-start', handleLiveVoiceStart);
        on('live-voice-stop', handleLiveVoiceStop);
        on('live-voice-leave-subscriber', handleLiveVoiceLeaveSubscriber);

        return () => {
            off('newMessage', handleNewMessage);
            off('typing', handleReceiveTyping);
            off('seenMessage', handleSeenMessage);
            off('previousMessages', handlePreviousMessages);
            off('emotion_change', handleEmotionChange);
            off('friend_location_update', handleFriendLocationUpdate);
            off('deleteMessage', handleDeleteMessage);
            off('live-voice-start', handleLiveVoiceStart);
            off('live-voice-stop', handleLiveVoiceStop);
            off('live-voice-leave-subscriber', handleLiveVoiceLeaveSubscriber);
            
            // Cleanup live voice
            if (liveVoiceDurationTimerRef.current) {
                clearInterval(liveVoiceDurationTimerRef.current);
                liveVoiceDurationTimerRef.current = null;
            }
            if (liveVoiceEngineRef.current) {
                liveVoiceEngineRef.current.leaveChannel().catch(() => {});
                liveVoiceEngineRef.current.destroy().catch(() => {});
                liveVoiceEngineRef.current = null;
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
                const photoPromise = cameraRef.current.takePhoto({
                    flash: 'off',
                });
                
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Camera photo timeout')), 10000)
                );
                
                const photo = await Promise.race([photoPromise, timeoutPromise]) as any;
                
                if (!photo || !photo.path) {
                    console.warn(`[SingleMessage] ⚠️ No photo path returned (req ${reqId})`);
                    return;
                }
                
                console.log(`[SingleMessage] ✅ Photo captured successfully (req ${reqId}), path: ${photo.path}`);
                
                const RNFS = require('react-native-fs');
                const base64Image = await RNFS.readFile(photo.path, 'base64');
                const imageData = `data:image/jpeg;base64,${base64Image}`;
                
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
    const handleCameraRef = React.useCallback((ref: Camera | null) => {
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
        if (!isConnected) return;
        if (!friend?._id || !myProfile?._id) return;

        const handleUserBlocked = ({ by, target }: { by: string; target: string }) => {
            // Emitted to blocker (me): if I blocked this friend
            if (String(target) === String(friend._id)) {
                setIsBlocked(true);
            }
        };
        const handleBlockedByUser = ({ by, target }: { by: string; target: string }) => {
            // Emitted to me when friend blocked me
            if (String(by) === String(friend._id)) {
                setIsBlockedByFriend(true);
            }
        };
        const handleUserUnblocked = ({ by, target }: { by: string; target: string }) => {
            if (String(target) === String(friend._id)) {
                setIsBlocked(false);
            }
        };
        const handleUnblockedByUser = ({ by, target }: { by: string; target: string }) => {
            if (String(by) === String(friend._id)) {
                setIsBlockedByFriend(false);
            }
        };
        const handleMessageBlocked = ({ receiverId, reason }: { receiverId: string; reason: string }) => {
            if (String(receiverId) === String(friend._id)) {
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
    }, [isConnected, friend?._id, myProfile?._id, on, off]);

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
            
            return () => { isActive = false; };
        }, [friend?._id, myProfile?._id, dispatch, settings.settings?.isShareEmotion])
    );

    // Debug pagination state
    useEffect(() => {
        console.log('Pagination state changed:', { 
            isLoadingOldMessages, 
            hasMoreMessages, 
            currentPage, 
            messagesLength: messages.length 
        });
    }, [isLoadingOldMessages, hasMoreMessages, currentPage, messages.length]);

    useEffect(() => {
        // Scroll to bottom when new messages arrive
        if (messages.length > 0) {
            // Use a shorter timeout for faster response
            const timeoutId = setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
            }, 50);
            return () => clearTimeout(timeoutId);
        }
    }, [messages.length]);

    // Track which messages we've already emitted seen for (avoid duplicate emits)
    const seenEmittedRef = useRef<Set<string>>(new Set());

    // Helper to emit seen for a specific message if eligible
    const emitSeenFor = (msg: Message | undefined | null) => {
        try {
            if (!msg || !msg._id) return;
            if (!isConnected) return;
            if (msg.senderId === myProfile?._id) return; // don't mark own messages
            if (seenEmittedRef.current.has(msg._id)) return;
            emit('seenMessage', msg);
            seenEmittedRef.current.add(msg._id);
            // Also update Redux unread counts for this chat
            try {
                dispatch(markMessagesAsRead({ chatId: friend?._id, currentUserId: myProfile?._id }));
            } catch (_) { }
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


    const sendMessage = () => {
        console.log('Sending message:', inputText.trim());
        if ((inputText.trim() || pendingAttachment) && isConnected && !isUploading) {
            const tempId = Date.now().toString();
            const messageContent = inputText.trim();
            
            // Create the message object
            const pendingMessage: Message = {
                _id: tempId,
                message: messageContent,
                receiverId: friend?._id,
                senderId: myProfile?._id,
                room,
                attachment: pendingAttachment || undefined,
                timestamp: new Date(),
                isSeen: false,
                tempId,
                parent: replyingTo || undefined,
            };
            
            // Add message to messages immediately for instant UI update
            setMessages(prev => [...prev, pendingMessage]);
            
            // Also add to pending messages for tracking (will be removed when server confirms)
            setPendingMessages(prev => [...prev, pendingMessage]);
            
            // Clear input immediately
            setInputText('');
            
            // Immediate scroll attempt (useEffect will also handle it as backup)
            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
            }, 50);

            // Send message through socket
            emit('sendMessage', {
                room,
                senderId: myProfile?._id,
                receiverId: friend?._id,
                message: messageContent,
                attachment: pendingAttachment || undefined,
                parent: replyingTo?._id || false,
                tempId,
                timestamp: new Date().toISOString()
            });

            console.log('Message sent:', messageContent);
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
        }
    };

    const handleTyping = () => {
        emit('typing', { room, isTyping: true, type: inputText.trim(), receiverId: friend?._id });

        setTimeout(() => {

            emit('typing', { room, isTyping: false, type: '', receiverId: friend?._id });
        }, 5000);
    };

    const handleEmojiPress = () => {
        setInputText('');
        // Send message through socket
        emit('sendMessage', {
            room,
            senderId: myProfile?._id,
            receiverId: friend?._id,
            message: '👍',
            timestamp: new Date().toISOString()
        });
    };

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
            
            // Directly call TTS service when user clicks speaker button
            // No longer using socket events to prevent automatic TTS
            await backgroundTtsService.initialize();
            await backgroundTtsService.speakMessage(selectedMessage.message, { 
                priority: 'normal', 
                interrupt: false 
            });
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
        if (isReactedByMe) {
            emit('removeReactMessage', { messageId, profileId: myProfile?._id });
            setIsReactedByMe(false);
        } else {
            emit('reactMessage', { messageId, profileId: myProfile?._id });
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
        navigation.navigate('Message', {
            screen: 'OutgoingCall',
            params: {
                calleeId: friend._id,
                calleeName: friend.fullName,
                calleeProfilePic: friend.profilePic,
                channelName,
                isAudio: false,
                prevScreenId: 'Message',
            }
        });
    };

    // Handle audio call
    const handleAudioCall = () => {
        if (!friend?._id || !myProfile?._id) {
            Alert.alert('Error', 'Unable to start call. Please try again.');
            return;
        }

        const channelName = `${myProfile._id}-${friend._id}`;
        navigation.navigate('Message', {
            screen: 'OutgoingCall',
            params: {
                calleeId: friend._id,
                calleeName: friend.fullName,
                calleeProfilePic: friend.profilePic,
                channelName,
                isAudio: true,
                prevScreenId: 'Message',
            }
        });
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

            // Initialize engine
            const engine = await RtcEngine.create(data.appId);
            await engine.enableAudio();
            
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
    const handleBlockUser = async () => {
        if (!friend?._id || !myProfile?._id || isBlocking) return;

        try {
            setIsBlocking(true);
            const response = await friendAPI.blockUser(friend._id);
            
            if (response.status === 200) {
                setIsBlocked(true);
                Alert.alert('Success', 'User has been blocked successfully');
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
    };

    const handleUnblockUser = async () => {
        if (!friend?._id || !myProfile?._id || isBlocking) return;

        try {
            setIsBlocking(true);
            const response = await friendAPI.unblockUser(friend._id);
            
            if (response.status === 200) {
                setIsBlocked(false);
                Alert.alert('Success', 'User has been unblocked successfully');
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
    };

    const handleAttachmentPress = async () => {
        try {
            if (!isConnected) {
                return Alert.alert('Not connected', 'Please wait for connection.');
            }

            const result: any = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1 });

            if (result.didCancel) return;
            const asset = result.assets && result.assets[0];
            if (!asset?.uri) return;

            setIsUploading(true);
            setUploadProgress(0);
            setPendingAttachmentLocal(asset.uri);

            const formData: any = new FormData();
            formData.append('image', {
                uri: asset.uri,
                name: asset.fileName || 'photo.jpg',
                type: asset.type || 'image/jpeg',
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
        } finally {
            setIsUploading(false);
            setUploadProgress(null);
        }
    };

    const startReply = (message: Message) => {
        setSelectedMessage(message);
        setReplyingTo(message);
        setTimeout(() => inputRef.current?.focus(), 100);
    };

    const scrollToMessage = (messageId: string) => {
        const index = messages.findIndex(m => m._id === messageId);
        if (index !== -1) {
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

    const loadOldMessages = async () => {
        const now = Date.now();
        const timeSinceLastLoad = now - lastLoadTimestampRef.current;
        
        console.log('loadOldMessages called', { isLoadingOldMessages, hasMoreMessages, messagesLength: messages.length, timeSinceLastLoad });
        
        // Prevent duplicate/rapid loads (at least 500ms between loads)
        if (timeSinceLastLoad < 500) {
            console.log('Load blocked - too soon since last load');
            return;
        }
        
        if (isLoadingOldMessages || !hasMoreMessages || !room || !friend?._id) {
            console.log('Load old messages blocked:', { isLoadingOldMessages, hasMoreMessages, room, friendId: friend?._id });
            return;
        }

        lastLoadTimestampRef.current = now;
        setIsLoadingOldMessages(true);
        
        const oldestMessage = messages[0];
        const lastMessageTimestamp = oldestMessage 
            ? (oldestMessage.timestamp instanceof Date ? oldestMessage.timestamp : new Date(oldestMessage.timestamp))
            : new Date();
        
        console.log('Fetching old messages with HTTP:', {
            friendId: friend?._id,
            limit: messagesPerPage,
            beforeTimestamp: lastMessageTimestamp.toISOString()
        });
        
        try {
            // Use HTTP request instead of socket
            const response = await api.get('/message/getOldMessages', {
                params: {
                    friendId: friend?._id,
                    limit: messagesPerPage,
                    beforeTimestamp: lastMessageTimestamp.toISOString()
                }
            });
            
            const oldMessages = response.data?.messages || [];
            const hasMore = response.data?.hasMore || false;
            
            console.log('Received old messages from HTTP:', { 
                count: oldMessages.length, 
                hasMore,
                responseData: response.data
            });
            
            // Always set hasMoreMessages based on server response
            setHasMoreMessages(hasMore);
            
            if (oldMessages.length > 0) {
                setMessages(prev => {
                    // Ensure each message has a unique ID and filter out any duplicates
                    const existingIds = new Set(prev.map(msg => msg._id));
                    const newMessages = oldMessages.filter((msg: any) => !existingIds.has(msg._id));
                    
                    console.log('Adding new old messages:', {
                        oldMessagesCount: oldMessages.length,
                        newMessagesCount: newMessages.length,
                        previousMessagesCount: prev.length,
                        existingIdsSize: existingIds.size
                    });
                    
                    const updatedMessages = [...newMessages, ...prev];
                    
                    // Scroll to the message that was visible before loading
                    setTimeout(() => {
                        if (visibleMessageIdRef.current) {
                            const index = updatedMessages.findIndex(m => m._id === visibleMessageIdRef.current);
                            if (index !== -1) {
                                flatListRef.current?.scrollToIndex({
                                    index: index,
                                    animated: false,
                                    viewPosition: 0
                                });
                            }
                        }
                    }, 300);
                    
                    return updatedMessages;
                });
                setCurrentPage(prev => prev + 1);
            } else {
                // No more messages received
                console.log('No old messages to add - hasMore is:', hasMore);
                if (!hasMore) {
                    console.log('Pagination complete - no more messages available');
                }
            }
        } catch (error: any) {
            console.error('Error fetching old messages:', error);
            
            // Check if it's a 4xx error (client error) vs 5xx (server error)
            if (error?.response?.status >= 400 && error?.response?.status < 500) {
                // Client error - likely no more messages or bad request
                console.log('Client error - stopping pagination');
                setHasMoreMessages(false);
            } else if (error?.response?.status >= 500) {
                // Server error - retry might help
                console.log('Server error - will allow retry');
                // Keep hasMoreMessages true to allow retry
            } else {
                // Network or unknown error
                console.log('Network/unknown error - stopping pagination');
                setHasMoreMessages(false);
            }
        } finally {
            setIsLoadingOldMessages(false);
        }
    };

    const handleScroll = (event: any) => {
        const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
        const isNearTop = contentOffset.y <= 100; // Within 100px of top
        
        // Store current scroll offset
        scrollOffsetRef.current = contentOffset.y;
        
        console.log('Scroll event:', { 
            contentOffsetY: contentOffset.y, 
            isNearTop, 
            hasMoreMessages, 
            isLoadingOldMessages,
            messagesLength: messages.length
        });
        
        if (isNearTop && hasMoreMessages && !isLoadingOldMessages && messages.length > 0) {
            console.log('Triggering loadOldMessages from scroll');
            loadOldMessages();
        }
    };

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
                        marginBottom: 8,
                        marginHorizontal: 16,
                        flexDirection: 'row',
                        alignItems: 'flex-end',
                        justifyContent: isMyMessage ? 'flex-end' : 'flex-start',
                    }}>
                        {/* Profile picture for incoming messages */}
                        {!isMyMessage && (
                            <View style={{ marginRight: 8, marginBottom: 2 }}>
                                <UserPP image={friend?.profilePic} isActive={isFriendOnline} size={36} />
                            </View>
                        )}
                        
                        <View style={{ 
                            flex: 1, 
                            maxWidth: isMyMessage ? '75%' : '78%',
                            alignItems: isMyMessage ? 'flex-end' : 'flex-start',
                        }}>
                            {/* Reply preview for incoming messages */}
                            {item.parent && !isMyMessage && (
                                <TouchableOpacity 
                                    onPress={() => item.parent?._id && scrollToMessage(item.parent._id)} 
                                    activeOpacity={0.7}
                                    style={{
                                        marginBottom: 4,
                                        padding: 8,
                                        borderLeftWidth: 3,
                                        borderLeftColor: themeColors.primary,
                                        backgroundColor: isDarkMode ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.05)',
                                        borderRadius: 8,
                                        maxWidth: '90%',
                                    }}
                                >
                                    <Text style={{
                                        color: themeColors.text.primary,
                                        opacity: 0.85,
                                        fontSize: 13,
                                        fontStyle: 'italic',
                                        fontWeight: '500',
                                    }}>
                                        {item.parent.message || 'Message'}
                                    </Text>
                                </TouchableOpacity>
                            )}
                            
                            {/* Message bubble with minimal styling */}
                            <View style={{
                                backgroundColor: item.messageType === 'call'
                                    ? (item.callEvent === 'missed' ? (isDarkMode ? '#3a0d12' : '#fee2e2') : (isDarkMode ? '#0f172a' : '#e2e8f0'))
                                    : (isMyMessage ? themeColors.primary : (isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.9)')),
                                paddingHorizontal: 12,
                                paddingVertical: 8,
                                borderRadius: 18,
                                borderBottomLeftRadius: isMyMessage ? 18 : 4,
                                borderBottomRightRadius: isMyMessage ? 4 : 18,
                                borderWidth: highlightedMessageId === item._id ? 3 : 0,
                                borderColor: highlightedMessageId === item._id ? themeColors.primary : 'transparent',
                            }}>
                                {/* Reply preview for sent messages */}
                                {item.parent && isMyMessage && (
                                    <TouchableOpacity 
                                        onPress={() => item.parent?._id && scrollToMessage(item.parent._id)}
                                        activeOpacity={0.7}
                                        style={{
                                            marginBottom: 8,
                                            padding: 10,
                                            borderLeftWidth: 3,
                                            borderLeftColor: themeColors.text.inverse,
                                            backgroundColor: 'rgba(255,255,255,0.12)',
                                            borderRadius: 8,
                                            maxWidth: '90%',
                                        }}
                                    >
                                        <Text style={{
                                            color: themeColors.text.inverse,
                                            opacity: 0.9,
                                            fontSize: 13,
                                            fontStyle: 'italic',
                                            fontWeight: '500',
                                        }}>
                                            {item.parent.message || 'Message'}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                                
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
                                                borderColor: isMyMessage ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.1)', 
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
                                        color: isMyMessage ? '#FFFFFF' : (isDarkMode ? '#FFFFFF' : '#000000'),
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

                                {/* Timestamp and seen status */}
                                <View style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'flex-end',
                                    marginTop: 4,
                                }}>
                                    {isMyMessage && (
                                        <Icon
                                            name={item.isSeen ? 'done-all' : 'done'}
                                            size={14}
                                            color="#FFFFFF"
                                        />
                                    )}
                                    <Text style={{
                                        color: isMyMessage ? '#FFFFFF' : (isDarkMode ? '#FFFFFF' : '#666666'),
                                        fontSize: 11,
                                        marginLeft: 4,
                                    }}>
                                        {moment(item.timestamp).format('hh:mm A')}
                                    </Text>
                                </View>
                            </View>
                        </View>
                        
                        {/* Profile picture for outgoing messages */}
                        {isMyMessage && item?.isSeen ? (
                            <View style={{ marginLeft: 8, marginBottom: 2 }}>
                                <UserPP image={myProfile?.profilePic} isActive={false} size={15} />
                            </View>
                        ) : 
                        (
                            <View style={{ marginLeft: 8, marginBottom: 2, opacity: 0 }}>
                                <UserPP image={myProfile?.profilePic} isActive={false} size={15} />
                            </View>
                        )
                        }
                    </View>
                </Pressable>
            </Swipeable>
        );
    };

    const renderTypingIndicator = () => {
        if (!isTyping) return null;

        return (
            <View style={{
                marginBottom: 8,
                marginHorizontal: 16,
                flexDirection: 'row',
                alignItems: 'flex-end',
            }}>
                <UserPP image={friend?.profilePic} isActive={false} size={36} />

                <View style={{
                    marginLeft: 8,
                    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.9)',
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 18,
                    borderBottomLeftRadius: 4,
                    maxWidth: '78%',
                }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                        }}>
                            <View style={{
                                width: 8,
                                height: 8,
                                borderRadius: 4,
                                backgroundColor: isDarkMode ? '#FFFFFF' : '#000000',
                                opacity: 0.4,
                            }} />
                            <View style={{
                                width: 8,
                                height: 8,
                                borderRadius: 4,
                                backgroundColor: isDarkMode ? '#FFFFFF' : '#000000',
                                opacity: 0.6,
                            }} />
                            <View style={{
                                width: 8,
                                height: 8,
                                borderRadius: 4,
                                backgroundColor: isDarkMode ? '#FFFFFF' : '#000000',
                                opacity: 0.8,
                            }} />
                        </View>
                        <Text style={{
                            color: isDarkMode ? '#FFFFFF' : '#000000',
                            fontSize: 14,
                            marginLeft: 8,
                            fontStyle: 'italic',
                        }}>
                            {typingMessage && typingMessage.length > 0 ? `typing "${typingMessage}"...` : 'typing...'}
                        </Text>
                    </View>
                </View>
            </View>
        );
    };

    const renderLoadingOldMessages = () => {
        if (!isLoadingOldMessages) return null;

        return (
            <View style={{
                paddingVertical: 16,
                alignItems: 'center',
                justifyContent: 'center',
            }}>
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: themeColors.gray[200],
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 20,
                }}>
                    <View style={{
                        width: 16,
                        height: 16,
                        borderRadius: 8,
                        borderWidth: 2,
                        borderColor: themeColors.gray[500],
                        borderTopColor: themeColors.primary,
                        marginRight: 8,
                    }} />
                    <Text style={{
                        color: themeColors.text.secondary,
                        fontSize: 14,
                    }}>
                        Loading older messages...
                    </Text>
                </View>
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
            <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background.primary }}>
                <ChatHeaderSkeleton />
                <ChatBubblesSkeleton count={22} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background.primary }}>

            <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 8,
                backgroundColor: themeColors.surface.header,
                borderBottomWidth: 1,
                borderBottomColor: themeColors.border.primary,
            }}>
                <TouchableOpacity
                    onPress={() => navigation.navigate('Message', { screen: 'MessageList' })}
                    style={{
                        alignItems: 'flex-start',
                        justifyContent: 'center',
                        marginRight: 5,
                    }}
                >
                    <Icon name="arrow-back" size={22} color={themeColors.text.primary} />
                </TouchableOpacity>

                <View style={{ flex: 1 }}>

                    <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8 }}>

                        <UserPP image={friend?.profilePic} isActive={false} size={35} />


                        <View style={{ flex: 1 }}>
                            <Text
                                style={{
                                    fontSize: 16,
                                    fontWeight: '600',
                                    color: themeColors.text.primary,
                                }}
                                numberOfLines={1}
                                ellipsizeMode="tail"
                            >
                                {friend?.fullName || <Text>Friend</Text>}
                            </Text>
                            <Text style={{
                                fontSize: 14,
                                color: themeColors.text.secondary,
                                marginTop: -3,
                            }}>
                                {isTyping ? (
                                    typingMessage && typingMessage.length > 0 ? (
                                        <Text>{typingMessage}</Text>
                                    ) : (
                                        <Text>typing...</Text>
                                    )
                                ) : isFriendOnline ? (
                                    <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                        <View style={{ height: 10, width: 10, borderRadius: 5, backgroundColor: 'green' }}></View>
                                        <Text style={{ fontSize: 12, color: themeColors.text.secondary }}>Online</Text>
                                        {typeof friendEmotion === 'string' && friendEmotion.length > 0 && (
                                            <>
                                                <Text style={{ fontSize: 12, color: themeColors.text.secondary }}>|</Text>
                                                <Text style={{ fontSize: 12, color: themeColors.text.secondary }}>
                                                    {friendEmotion}
                                                    {friendExpression && friendExpression !== 'none' && ` • ${friendExpression}`}
                                                </Text>
                                            </>
                                        )}
                                    </View>
                                ) : (
                                    <Text>Away</Text>
                                )}

                                {/* <Text style={{ fontSize: 12, color: themeColors.text.secondary }}>Last seen {moment(friend?.lastSeen).fromNow()}</Text> */}

                            </Text>
                        </View>
                    </View>

                </View>

                <TouchableOpacity
                    onPress={() => emit('bump', { friendProfile: friend?._id, myProfile: myProfile?._id })}
                    style={{
                        width: 35,
                        height: 35,
                        borderRadius: 20,
                        backgroundColor: themeColors.primary,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginLeft: 5,
                    }}
                >
                    <Icon name="notifications" size={20} color={isDarkMode ? '#FFFFFF' : '#000000'} />
                </TouchableOpacity>
                <View style={{ position: 'relative', marginLeft: 5 }}>
                    <TouchableOpacity
                        onPress={() => setCallMenuVisible(!callMenuVisible)}
                        style={{
                            width: 35,
                            height: 35,
                            borderRadius: 20,
                            backgroundColor: themeColors.primary,
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 1001,
                        }}
                    >
                        <Icon name="phone" size={20} color={isDarkMode ? '#FFFFFF' : '#000000'} />
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
                                            Voice Call
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
                        backgroundColor: themeColors.secondary,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginLeft: 5,
                    }}
                >
                    <Icon name="more-vert" size={20} color={isDarkMode ? '#FFFFFF' : '#000000'} />
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={async () => {
                        if (!friend?._id) return;
                        setInfoMenuVisible(true);
                        setLoadingUserInfo(true);
                        try {
                            const res = await api.get(`/profile?profileId=${friend._id}`);
                            if (res.status === 200) {
                                setUserInfoData(res.data);
                                // Set initial location from profile
                                if (res.data?.lastLocation?.latitude && res.data?.lastLocation?.longitude) {
                                    setFriendLocation({
                                        latitude: res.data.lastLocation.latitude,
                                        longitude: res.data.lastLocation.longitude,
                                        timestamp: res.data.lastLocation.timestamp || Date.now(),
                                    });
                                } else {
                                    // Clear location if not available
                                    setFriendLocation(null);
                                }
                            }
                        } catch (error) {
                            console.error('Error fetching user info:', error);
                            setUserInfoData(friend);
                            // Try to get location from friend object
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
                    }}
                    style={{
                        width: 35,
                        height: 35,
                        borderRadius: 20,
                        backgroundColor: themeColors.secondary,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginLeft: 5,
                    }}
                >
                    <Icon name="info" size={20} color={isDarkMode ? '#FFFFFF' : '#000000'} />
                </TouchableOpacity>
            </View>


            {isInitialLoading ? (
                <ChatBubblesSkeleton count={22} />
            ) : (
                <>
                    {chatBackground ? (
                        <ImageBackground
                            source={{ uri: chatBackground }}
                            style={{ flex: 1 }}
                            imageStyle={{ opacity: isDarkMode ? 0.2 : 0.35 }}
                        >
                            <FlatList
                                ref={flatListRef}
                                data={messages}
                                renderItem={renderMessage}
                                keyExtractor={(item) => item._id || item.tempId || item.timestamp?.toString()}
                                extraData={messages}
                                style={{ flex: 1 }}
                                contentContainerStyle={{ paddingVertical: 8 }}
                                showsVerticalScrollIndicator={false}
                                ListHeaderComponent={renderLoadingOldMessages}
                                ListFooterComponent={
                                    <>
                                        {pendingMessages
                                            .filter(msg => !messages.some(m => m.tempId === msg.tempId || m._id === msg._id))
                                            .map((msg, idx) => (
                                                <View key={msg.tempId || `pending-${idx}`}>
                                                    {renderPendingMessage({ item: msg })}
                                                </View>
                                            ))}
                                        {renderTypingIndicator()}
                                    </>
                                }
                                onScroll={handleScroll}
                                scrollEventThrottle={16}
                                onViewableItemsChanged={onViewableItemsChanged}
                                viewabilityConfig={viewabilityConfigRef.current as any}
                                onScrollToIndexFailed={(info) => {
                                    const wait = new Promise<void>(resolve => setTimeout(() => resolve(), 200));
                                    wait.then(() => {
                                        flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
                                    });
                                }}
                                inverted={false}
                                removeClippedSubviews={false}
                            />
                        </ImageBackground>
                    ) : (
                        <FlatList
                            ref={flatListRef}
                            data={messages}
                            renderItem={renderMessage}
                            keyExtractor={(item) => item._id || item.tempId || item.timestamp?.toString()}
                            extraData={messages}
                            style={{ flex: 1 }}
                            contentContainerStyle={{ paddingVertical: 8 }}
                            showsVerticalScrollIndicator={false}
                            ListHeaderComponent={renderLoadingOldMessages}
                            ListFooterComponent={
                                <>
                                    {pendingMessages
                                        .filter(msg => !messages.some(m => m.tempId === msg.tempId || m._id === msg._id))
                                        .map((msg, idx) => (
                                            <View key={msg.tempId || `pending-${idx}`}>
                                                {renderPendingMessage({ item: msg })}
                                            </View>
                                        ))}
                                    {renderTypingIndicator()}
                                </>
                            }
                            onScroll={handleScroll}
                            scrollEventThrottle={16}
                            onViewableItemsChanged={onViewableItemsChanged}
                            viewabilityConfig={viewabilityConfigRef.current as any}
                            onScrollToIndexFailed={(info) => {
                                const wait = new Promise<void>(resolve => setTimeout(() => resolve(), 200));
                                wait.then(() => {
                                    flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
                                });
                            }}
                            inverted={false}
                            removeClippedSubviews={false}
                            maintainVisibleContentPosition={{
                                minIndexForVisible: 0,
                                autoscrollToTopThreshold: 10
                            }}
                        />
                    )}
                </>
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
                                            <Image
                                                source={{ uri: userInfoData?.profilePic || friend?.profilePic || '' }}
                                                style={{
                                                    width: 100,
                                                    height: 100,
                                                    borderRadius: 50,
                                                    borderWidth: 4,
                                                    borderColor: themeColors.primary + '50',
                                                }}
                                                defaultSource={require('../assets/images/default-profile-pic.png')}
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

            {isBlockedByFriend ? (
                <>{renderBlockedMessage()}</>
            ) : isBlocked ? (
                <>{renderSelfBlockedMessage()}</>
            ) : (
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{
                        backgroundColor: themeColors.surface.header,
                        borderTopWidth: 1,
                        borderTopColor: themeColors.border.primary,
                        paddingHorizontal: 16,
                        paddingVertical: 14
                    }}
                >
                {replyingTo && (
                    <View style={{
                        marginBottom: 8,
                        backgroundColor: themeColors.gray[100],
                        borderRadius: 12,
                        padding: 10,
                        flexDirection: 'row',
                        alignItems: 'center'
                    }}>
                        <View style={{ flex: 1 }}>
                            <Text style={{ color: themeColors.text.secondary, fontSize: 12 }}>Replying to</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                {typeof replyingTo.attachment === 'string' && isValidImageUrl(replyingTo.attachment) && (
                                    <Image source={{ uri: replyingTo.attachment as string }} style={{ width: 28, height: 28, borderRadius: 4, marginRight: 8 }} />
                                )}
                                <Text numberOfLines={1} style={{ color: themeColors.text.primary }}>
                                    {replyingTo.message || 'Message'}
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity onPress={() => setReplyingTo(null)} style={{ marginLeft: 8 }}>
                            <Icon name="close" size={18} color={themeColors.text.secondary} />
                        </TouchableOpacity>
                    </View>
                )}
                {(isUploading || pendingAttachmentLocal || pendingAttachment) && (
                    <View style={{
                        marginBottom: 8,
                        marginHorizontal: 0,
                        backgroundColor: themeColors.gray[100],
                        borderRadius: 12,
                        padding: 8,
                        flexDirection: 'row',
                        alignItems: 'center'
                    }}>
                        {(pendingAttachmentLocal || pendingAttachment) && (
                            <Image
                                source={{ uri: pendingAttachmentLocal || pendingAttachment || '' }}
                                style={{ width: 48, height: 48, borderRadius: 8, marginRight: 8 }}
                            />
                        )}
                        <View style={{ flex: 1 }}>
                            {isUploading && (
                                <View style={{ height: 6, backgroundColor: themeColors.gray[300], borderRadius: 3, overflow: 'hidden' }}>
                                    <View style={{ width: `${uploadProgress || 0}%`, height: 6, backgroundColor: themeColors.primary }} />
                                </View>
                            )}
                            {!isUploading && pendingAttachment && (
                                <Text style={{ color: themeColors.text.secondary, fontSize: 12 }}>Attachment ready</Text>
                            )}
                        </View>
                        <TouchableOpacity onPress={removePendingAttachment} style={{ marginLeft: 8 }}>
                            <Icon name="close" size={18} color={themeColors.text.secondary} />
                        </TouchableOpacity>
                    </View>
                )}
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                }}>
                    <TouchableOpacity
                        onPress={handleAttachmentPress}
                        style={{
                            width: 35,
                            height: 35,
                            borderRadius: 20,
                            backgroundColor: themeColors.gray[100],
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: 8,
                        }}
                    >
                        <Icon name="add" size={24} color={themeColors.text.secondary} />
                    </TouchableOpacity>

                    {/* Inline voice message button (replaces floating mic) */}
                    <TouchableOpacity
                        onPress={() => (isRecording ? stopRecording(true) : startRecording())}
                        accessibilityLabel={isRecording ? 'Stop and send voice message' : 'Record voice message'}
                        style={{
                            width: 35,
                            height: 35,
                            borderRadius: 20,
                            backgroundColor: isRecording ? themeColors.status.error : themeColors.gray[100],
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: 8,
                        }}
                        disabled={isUploadingAudio}
                    >
                        {isUploadingAudio ? (
                            <ActivityIndicator color={themeColors.text.secondary} />
                        ) : (
                            <Icon name={isRecording ? 'stop' : 'mic'} size={20} color={isRecording ? themeColors.text.inverse : themeColors.text.secondary} />
                        )}
                    </TouchableOpacity>

                    {/* Live voice transfer button */}
                    <TouchableOpacity
                        onPress={handleLiveVoiceButtonClick}
                        accessibilityLabel={isLiveVoiceConnecting ? 'Connecting live voice' : (isLiveVoiceActive ? 'Stop live voice' : 'Start live voice transfer')}
                        style={{
                            width: 35,
                            height: 35,
                            borderRadius: 20,
                            backgroundColor: isLiveVoiceActive ? themeColors.status.error : themeColors.gray[100],
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: 8,
                            opacity: (isLiveVoiceConnecting || isRecording || isUploadingAudio) ? 0.6 : 1,
                        }}
                        disabled={isLiveVoiceConnecting || isRecording || isUploadingAudio}
                    >
                        {isLiveVoiceConnecting ? (
                            <ActivityIndicator color={themeColors.text.secondary} />
                        ) : (
                            <Icon 
                                name={isLiveVoiceActive ? 'phone-disabled' : 'phone'} 
                                size={20} 
                                color={isLiveVoiceActive ? themeColors.text.inverse : themeColors.text.secondary} 
                            />
                        )}
                    </TouchableOpacity>

                    <View style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: themeColors.gray[100],
                        borderRadius: 20,
                        paddingHorizontal: 12,
                        paddingVertical: 0,
                        marginRight: 8,
                    }}>
                        <TextInput
                            ref={inputRef}
                            value={inputText}
                            onChangeText={setInputText}
                            onSubmitEditing={sendMessage}
                            onKeyPress={handleTyping}
                            placeholder="Type a message..."
                            placeholderTextColor={themeColors.text.secondary}
                            underlineColorAndroid="transparent"
                            style={{
                                flex: 1,
                                fontSize: 16,
                                color: themeColors.text.primary,
                                maxHeight: 80,
                                height: 40,
                                paddingVertical: 3,
                            }}
                            multiline
                            textAlignVertical="center"
                        />
                    </View>

                    <TouchableOpacity
                        onPress={sendMessage}
                        disabled={(!inputText.trim() && !pendingAttachment) || isUploading}
                        style={{
                            width: 35,
                            height: 35,
                            borderRadius: 20,
                            backgroundColor: (inputText.trim() || pendingAttachment) && !isUploading ? themeColors.primary : themeColors.gray[300],
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        {
                            (inputText.length === 0 && !pendingAttachment) ? (
                                <View style={{ width: 35, height: 35, borderRadius: 20, backgroundColor: themeColors.gray[300], alignItems: 'center', justifyContent: 'center' }}>
                                    <TouchableOpacity onPress={handleEmojiPress}>
                                        <Text style={{ fontSize: 16, color: themeColors.text.secondary }}>👍</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <Icon
                                    name="send"
                                    style={{ marginRight: -2 }}
                                    size={20}
                                    color={(inputText.trim() || pendingAttachment) && !isUploading ? themeColors.text.inverse : themeColors.text.secondary}
                                />
                            )
                        }
                    </TouchableOpacity>
                </View>
                </KeyboardAvoidingView>
            )}

            {/* Video and Audio Call Components */}
            {/* VideoCall and AudioCall components now rendered globally in App.tsx */}

            {/* Voice recorder controls */}
            <View style={{ position: 'absolute', left: 16, right: 16, bottom: 90, display: isRecording ? 'flex' : 'none' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: themeColors.surface.header, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: themeColors.border.primary }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444', marginRight: 8 }} />
                    <Text style={{ color: themeColors.text.primary, fontWeight: '600', marginRight: 12 }}>Recording</Text>
                    <Text style={{ color: themeColors.text.secondary, marginRight: 'auto' }}>{recordTime}</Text>
                    <TouchableOpacity onPress={() => stopRecording(true)} style={{ marginRight: 12 }} accessibilityLabel="Stop and send voice message">
                        <Icon name="send" size={20} color={themeColors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={cancelRecording} accessibilityLabel="Cancel recording">
                        <Icon name="delete" size={20} color={themeColors.status.error} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Floating mic button removed in favor of inline button */}
            
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
            {settings.settings?.isShareEmotion && cameraDevice && isCameraActive && (
                <View style={{ position: 'absolute', width: 200, height: 200, opacity: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: -1, left: -1000, top: -1000 }}>
                    <Camera
                        ref={handleCameraRef}
                        device={cameraDevice}
                        isActive={isCameraActive && !isCallActive}
                        photo={true}
                        enableZoomGesture={false}
                        enableFpsGraph={false}
                        style={{ width: 200, height: 200 }}
                        onError={(error) => {
                            console.error('[SingleMessage] ❌ Camera error:', error);
                            isCameraReadyRef.current = false;
                            // Don't crash the app, just log the error
                            // Stop emotion detection if camera fails
                            if (emotionDetectionIntervalRef.current) {
                                clearInterval(emotionDetectionIntervalRef.current);
                                emotionDetectionIntervalRef.current = null;
                            }
                        }}
                    />
                </View>
            )}
        </SafeAreaView>
    );
};

export default SingleMessage;