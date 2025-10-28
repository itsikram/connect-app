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
} from 'react-native';
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
    const CHAT_BG_STORAGE_KEY = '@chat_background_image';

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
    const [chatBackground, setChatBackground] = useState<string | null>(null);
    const [friendEmotion, setFriendEmotion] = useState<string | null>("");
    const [isBlocked, setIsBlocked] = useState<boolean>(false);
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

    // Fetch initial messages using HTTP
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
        
        console.log('Fetching initial messages for friend:', friend._id);
        
        const fetchInitialMessages = async () => {
            try {
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
                    setMessages(validHttpMessages);
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
                setIsInitialLoading(false);
            }
        };
        
        fetchInitialMessages();
    }, [friend?._id]);

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
                    return;
                }
                if (typeof payload === 'object') {
                    const display = payload.emoji || payload.emotionText || payload.emotion || '';
                    setFriendEmotion(display || '');
                    return;
                }
            } catch (_) { }
        };

        on('emotion_change', handleEmotionChange);

        on('seenMessage', handleSeenMessage);

        on('newMessage', handleNewMessage);
        on('typing', handleReceiveTyping);

        const handleDeleteMessage = (messageId: string) => {
            setMessages(prev => prev.filter(msg => msg._id !== messageId));
        };

        on('deleteMessage', handleDeleteMessage);

        return () => {
            off('newMessage', handleNewMessage);
            off('typing', handleReceiveTyping);
            off('seenMessage', handleSeenMessage);
            off('previousMessages', handlePreviousMessages);
            off('emotion_change', handleEmotionChange);
            // off('oldMessages', handleOldMessages); // Disabled - using HTTP pagination now
            off('deleteMessage', handleDeleteMessage);
        };
    }, [isConnected, myProfile?._id, on, off]);

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
            
            return () => { isActive = false; };
        }, [friend?._id, myProfile?._id, dispatch])
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
            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
        }
    }, [messages]);

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
            
            // Add message to pending state
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
            
            setPendingMessages(prev => [...prev, pendingMessage]);
            setInputText('');

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

    const playSound = () => {
        console.log('Playing sound:', selectedMessage?.attachment);
        emit('speak_message', { msgId: selectedMessage?._id, friendId: friend?._id });

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

    // Block/Unblock functionality
    const handleBlockUser = async () => {
        if (!friend?._id || !myProfile?._id || isBlocking) return;

        try {
            setIsBlocking(true);
            const response = await friendAPI.blockUser(friend._id);
            
            if (response.status === 200) {
                setIsBlocked(true);
                Alert.alert('Success', 'User has been blocked successfully');
                setInfoMenuVisible(false);
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
                setInfoMenuVisible(false);
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
                                                <Text style={{ fontSize: 12, color: themeColors.text.secondary }}>{friendEmotion}</Text>
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
                <TouchableOpacity
                    onPress={handleAudioCall}
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
                    <Icon name="call" size={20} color={isDarkMode ? '#FFFFFF' : '#000000'} />
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={handleVideoCall}
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
                    <Icon name="videocam" size={20} color={isDarkMode ? '#FFFFFF' : '#000000'} />
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => setInfoMenuVisible(true)}
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
                                style={{ flex: 1 }}
                                contentContainerStyle={{ paddingVertical: 8 }}
                                showsVerticalScrollIndicator={false}
                                ListHeaderComponent={renderLoadingOldMessages}
                                ListFooterComponent={
                                    <>
                                        {pendingMessages.map((msg, idx) => (
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
                            style={{ flex: 1 }}
                            contentContainerStyle={{ paddingVertical: 8 }}
                            showsVerticalScrollIndicator={false}
                            ListHeaderComponent={renderLoadingOldMessages}
                            ListFooterComponent={
                                <>
                                    {pendingMessages.map((msg, idx) => (
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
                visible={infoMenuVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setInfoMenuVisible(false)}
            >
                <TouchableOpacity
                    style={{
                        flex: 1,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        justifyContent: 'flex-end',
                    }}
                    onPress={() => setInfoMenuVisible(false)}
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
                                    setInfoMenuVisible(false);
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
                                    setInfoMenuVisible(false);
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
                                    setInfoMenuVisible(false);
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
                                    setInfoMenuVisible(false);
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
                                    setInfoMenuVisible(false);
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
                                    setInfoMenuVisible(false);
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
                                />)
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
        </SafeAreaView>
    );
};

export default SingleMessage;