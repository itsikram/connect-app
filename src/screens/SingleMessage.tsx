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
import { useRoute, useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Slider from '@react-native-community/slider';
import { check, request, PERMISSIONS, RESULTS, openSettings } from 'react-native-permissions';
import Video from 'react-native-video';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import { useTheme } from '../contexts/ThemeContext';
import { ChatHeaderSkeleton, ChatBubblesSkeleton } from '../components/skeleton/ChatSkeleton';
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
    const [room, setRoom] = useState('');
    const { connect, isConnected, emit, on, off, startVideoCall, startAudioCall } = useSocket();
    const { colors: themeColors, isDarkMode } = useTheme();
    const CHAT_BG_STORAGE_KEY = '@chat_background_image';

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
        // Create instance dynamically to avoid TypeScript constructor issues
        try {
            // Use require to dynamically get the module
            const AudioRecorderPlayerModule = require('react-native-audio-recorder-player');
            
            // Log the structure to understand what we're dealing with
            console.log('AudioRecorderPlayerModule:', Object.keys(AudioRecorderPlayerModule));
            console.log('Default:', AudioRecorderPlayerModule.default);
            
            // Try different ways to get a constructor
            let AudioRecorderPlayerClass;
            if (AudioRecorderPlayerModule.default) {
                AudioRecorderPlayerClass = AudioRecorderPlayerModule.default;
            } else if (typeof AudioRecorderPlayerModule === 'function') {
                AudioRecorderPlayerClass = AudioRecorderPlayerModule;
            } else {
                AudioRecorderPlayerClass = AudioRecorderPlayerModule;
            }
            
            // Try to create instance
            if (typeof AudioRecorderPlayerClass === 'function') {
                audioRecorderPlayerRef.current = new AudioRecorderPlayerClass();
                console.log('AudioRecorderPlayer initialized successfully with new');
            } else {
                // Maybe it's already an instance
                audioRecorderPlayerRef.current = AudioRecorderPlayerClass;
                console.log('AudioRecorderPlayer initialized successfully (using module directly)');
            }
        } catch (e) {
            console.error('Error initializing AudioRecorderPlayer:', e);
            audioRecorderPlayerRef.current = null;
        }
        
        return () => {
            try {
                if (audioRecorderPlayerRef.current && typeof audioRecorderPlayerRef.current.removeRecordBackListener === 'function') {
                    audioRecorderPlayerRef.current.removeRecordBackListener();
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
            if (!audioRecorderPlayerRef.current) {
                console.error('AudioRecorderPlayer is null');
                Alert.alert('Voice recording unavailable', 'Recorder not initialized. Please restart the app.');
                return;
            }
            
            const path = Platform.select({ ios: 'voice.m4a', android: undefined });
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
                return undefined;
            });
        } catch (e: any) {
            console.error('Error in startRecording:', e);
            setIsRecording(false);
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
        
        try {
            if (!audioRecorderPlayerRef.current) {
                console.error('AudioRecorderPlayer is null in stopRecording');
                setIsRecording(false);
                return;
            }
            
            // Mark as not recording immediately to prevent duplicate calls
            setIsRecording(false);
            
            const resultPath = await audioRecorderPlayerRef.current.stopRecorder();
            console.log('Recording stopped, result path:', resultPath);
            
            try {
                audioRecorderPlayerRef.current.removeRecordBackListener();
            } catch (e) {
                console.warn('Error removing record back listener:', e);
            }
            
            setRecordSecs(0);
            setRecordTime('00:00');
            
            if (shouldSend && resultPath) {
                await uploadAndSendAudio(resultPath);
            }
        } catch (e) {
            console.error('Error in stopRecording:', e);
            setRecordSecs(0);
            setRecordTime('00:00');
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

    // Set up room and socket events when both IDs are available
    useEffect(() => {
        if (!friend?._id || !myProfile?._id) return;

        const newRoom = [friend._id, myProfile._id].sort().join('_');
        setRoom(newRoom);

        // Only emit and set up listeners if socket is connected
        if (isConnected) {
            emit('startChat', { user1: myProfile._id, user2: friend._id });

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
    }, [friend?._id, myProfile?._id, isConnected, emit, on, off]);

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

    // Listen for incoming messages
    useEffect(() => {
        if (!isConnected) return;


        emit('fetchMessages', myProfile?._id);

        const handlePreviousMessages = (messages: any) => {
            // Ensure all messages have valid IDs and filter out any invalid ones
            const validMessages = messages.filter((msg: any) => msg && msg._id);
            setMessages(validMessages);
            setCurrentPage(0);
            setHasMoreMessages(validMessages.length === messagesPerPage);
        }

        const handleOldMessages = (oldMessages: any) => {
            console.log('handleOldMessages received:', oldMessages);
            
            if (oldMessages && oldMessages.length > 0) {
                setMessages(prev => {
                    // Ensure each message has a unique ID and filter out any duplicates
                    const validOldMessages = oldMessages.filter((msg: any) => msg && msg._id);
                    const existingIds = new Set(prev.map(msg => msg._id));
                    const newMessages = validOldMessages.filter((msg: any) => !existingIds.has(msg._id));
                    
                    console.log('Adding old messages:', { 
                        oldMessagesLength: oldMessages.length, 
                        validOldMessagesLength: validOldMessages.length,
                        newMessagesLength: newMessages.length,
                        existingMessagesLength: prev.length
                    });
                    
                    return [...newMessages, ...prev];
                });
                setCurrentPage(prev => prev + 1);
                setHasMoreMessages(oldMessages.length === messagesPerPage);
            } else {
                console.log('No more old messages available');
                setHasMoreMessages(false);
            }
            setIsLoadingOldMessages(false);
        }

        on('previousMessages', handlePreviousMessages);
        on('oldMessages', handleOldMessages);

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
            off('oldMessages', handleOldMessages);
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

    // Early return with skeletons if required data is not available
    if (!friend?._id || !myProfile?._id) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background.primary }}>
                <ChatHeaderSkeleton />
                <ChatBubblesSkeleton count={12} />
            </SafeAreaView>
        );
    }

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

    const [messages, setMessages] = useState<Message[]>([]);

    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [typingMessage, setTypingMessage] = useState('');
    const flatListRef = useRef<FlatList>(null);
    const inputRef = useRef<TextInput>(null);

    // Pagination state for loading old messages
    const [isLoadingOldMessages, setIsLoadingOldMessages] = useState(false);
    const [hasMoreMessages, setHasMoreMessages] = useState(true);
    const [currentPage, setCurrentPage] = useState(0);
    const messagesPerPage = 20;

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
            // const newMessage: Message = {
            //     _id: Date.now().toString(),
            //     message: inputText.trim(),
            //     room,
            //     receiverId: friend?._id,
            //     senderId: myProfile?._id,
            //     timestamp: new Date(),
            //     isSeen: false,
            // };

            // Add message to local state immediately for optimistic UI
            setInputText('');

            // Send message through socket
            emit('sendMessage', {
                room,
                senderId: myProfile?._id,
                receiverId: friend?._id,
                message: inputText.trim(),
                attachment: pendingAttachment || undefined,
                parent: replyingTo?._id || false,
                tempId: Date.now().toString(),
                timestamp: new Date().toISOString()
            });

            console.log('Message sent:', inputText.trim());
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

    const loadOldMessages = () => {
        console.log('loadOldMessages called', { isLoadingOldMessages, hasMoreMessages, isConnected, messagesLength: messages.length });
        
        if (isLoadingOldMessages || !hasMoreMessages || !isConnected || !room) {
            console.log('Load old messages blocked:', { isLoadingOldMessages, hasMoreMessages, isConnected, room });
            return;
        }

        setIsLoadingOldMessages(true);
        const oldestMessage = messages[0];
        const lastMessageTimestamp = oldestMessage ? oldestMessage.timestamp : new Date();
        
        console.log('Emitting fetchOldMessages with:', {
            room,
            userId: myProfile?._id,
            page: currentPage + 1,
            limit: messagesPerPage,
            beforeTimestamp: lastMessageTimestamp.toISOString()
        });
        
        emit('fetchOldMessages', {
            room,
            userId: myProfile?._id,
            page: currentPage + 1,
            limit: messagesPerPage,
            beforeTimestamp: lastMessageTimestamp.toISOString()
        });
    };

    const handleScroll = (event: any) => {
        const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
        const isNearTop = contentOffset.y <= 50; // Within 50px of top
        
        console.log('Scroll event:', { 
            contentOffsetY: contentOffset.y, 
            isNearTop, 
            hasMoreMessages, 
            isLoadingOldMessages,
            messagesLength: messages.length
        });
        
        if (isNearTop && hasMoreMessages && !isLoadingOldMessages && isConnected && messages.length > 0) {
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

    const renderMessage = ({ item }: { item: Message }) => (
        <Swipeable
            ref={(ref) => {
                if (ref) {
                    swipeableRefs.current.set(item._id, ref);
                } else {
                    swipeableRefs.current.delete(item._id);
                }
            }}
            renderLeftActions={() => (item.senderId !== myProfile?._id ? renderLeftReplyAction() : null)}
            onSwipeableOpen={(direction) => {
                if (direction === 'left' && item.senderId !== myProfile?._id) {
                    startReply(item);
                    setActiveSwipeId(item._id);
                }
            }}
        >
            <Pressable onLongPress={(event) => handleMessageLongPress(item, event)} delayLongPress={250}>
                <View key={item._id} style={{
                    marginBottom: 8,
                    alignItems: item.senderId === myProfile?._id ? 'flex-end' : 'flex-start',
                }}>
                    <View style={{
                        backgroundColor: item.messageType === 'call'
                            ? (item.callEvent === 'missed' ? (isDarkMode ? '#3a0d12' : '#fee2e2') : (isDarkMode ? '#0f172a' : '#e2e8f0'))
                            : (item.senderId === myProfile?._id ? themeColors.primary : themeColors.gray[200]),
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 20,
                        maxWidth: '80%',
                        borderBottomLeftRadius: item.senderId === myProfile._id ? 20 : 4,
                        borderBottomRightRadius: item.senderId === myProfile._id ? 4 : 20,
                        borderWidth: highlightedMessageId === item._id ? 2 : 0,
                        borderColor: highlightedMessageId === item._id ? themeColors.primary : 'transparent',
                    }}>
                        {item.parent && (
                            <TouchableOpacity onPress={() => item.parent?._id && scrollToMessage(item.parent._id)} style={{
                                marginBottom: 8,
                                padding: 8,
                                borderLeftWidth: 3,
                                borderLeftColor: item.senderId === myProfile?._id ? themeColors.text.inverse : themeColors.primary,
                                backgroundColor: item.senderId === myProfile?._id ? 'rgba(255,255,255,0.12)' : themeColors.gray[300],
                                borderRadius: 6
                            }}>
                                <Text style={{
                                    color: item.senderId === myProfile?._id ? themeColors.text.inverse : themeColors.text.primary,
                                    opacity: 0.8,
                                    fontSize: 12,
                                    fontStyle: 'italic',
                                }}>
                                    {item.parent.message || 'Message'}
                                </Text>
                            </TouchableOpacity>
                        )}
                        {item.messageType === 'call' ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Icon
                                    name={item.callType === 'video' ? 'videocam' : 'call'}
                                    size={18}
                                    color={item.callEvent === 'missed' ? '#ef4444' : themeColors.text.primary}
                                />
                                <Text style={{
                                    color: item.senderId === myProfile?._id ? themeColors.text.inverse : themeColors.text.primary,
                                    fontSize: 16,
                                    lineHeight: 20,
                                }}>
                                    {item.message || (item.callEvent === 'missed' ? (item.callType === 'video' ? 'Missed video call' : 'Missed audio call') : (item.callType === 'video' ? 'Video call' : 'Audio call'))}
                                </Text>
                            </View>
                        ) : item.messageType === 'audio' || isAudioUrl(item.attachment || '') ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <TouchableOpacity
                                    onPress={() => togglePlay(item)}
                                    accessibilityLabel={playingId === item._id ? 'Pause voice message' : 'Play voice message'}
                                    style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}
                                >
                                    <Icon name={playingId === item._id ? 'pause' : 'play-arrow'} size={20} color={item.senderId === myProfile?._id ? '#fff' : themeColors.primary} />
                                </TouchableOpacity>
                                <Slider
                                    style={{ flex: 1, height: 28, marginHorizontal: 6 }}
                                    minimumValue={0}
                                    maximumValue={Math.max(1, Math.floor((playingProgress[item._id]?.duration || 0)))}
                                    value={Math.floor(playingProgress[item._id]?.current || 0)}
                                    minimumTrackTintColor={item.senderId === myProfile?._id ? '#fff' : themeColors.primary}
                                    maximumTrackTintColor={item.senderId === myProfile?._id ? 'rgba(255,255,255,0.35)' : themeColors.gray[400]}
                                    thumbTintColor={item.senderId === myProfile?._id ? '#fff' : themeColors.primary}
                                    onSlidingComplete={(val) => seekTo(item, Number(val))}
                                />
                                <Text style={{ color: item.senderId === myProfile?._id ? themeColors.text.inverse : themeColors.text.primary, fontSize: 12, marginLeft: 6 }}>
                                    {formatSecs(playingProgress[item._id]?.current || 0)} / {formatSecs(playingProgress[item._id]?.duration || 0)}
                                </Text>
                                {renderHiddenVideo(item)}
                            </View>
                        ) : (
                            <Text style={{
                                color: item.senderId === myProfile?._id ? themeColors.text.inverse : themeColors.text.primary,
                                fontSize: 16,
                                lineHeight: 20,
                            }}>
                                {item.message}
                            </Text>
                        )}
                        {item.attachment && isValidImageUrl(item.attachment) && item.messageType !== 'audio' && (
                            <Image
                                source={{ uri: item.attachment }}
                                style={{ width: 200, height: 200, borderRadius: 8, marginTop: 8 }}
                                resizeMode="cover"
                            />
                        )}


                        {item.senderId == myProfile?._id && <>
                            <View style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'flex-end',
                                marginTop: 4,
                            }}>
                                <Icon
                                    name={item.isSeen ? 'done-all' : 'check'}
                                    size={16}
                                    color={item.isSeen ? themeColors.text.primary : themeColors.text.inverse}
                                    style={{ marginLeft: 4 }}
                                />
                                <Text style={{
                                    color: themeColors.text.primary,
                                    fontSize: 12,
                                    opacity: 0.7,
                                    marginLeft: 4,
                                }}>
                                    {moment(item.timestamp).format('hh:mm')}
                                </Text>
                            </View>
                        </>}


                    </View>
                    {item.senderId !== myProfile?._id && (
                        <Text style={{
                            color: item.senderId === myProfile?._id ? themeColors.primary : themeColors.text.secondary,
                            fontSize: 12,
                            opacity: 0.7,
                            marginTop: 4,
                            marginLeft: 8,
                        }}>
                            {moment(item.timestamp).fromNow()}
                        </Text>
                    )}
                </View>
            </Pressable>
        </Swipeable>
    );

    const renderTypingIndicator = () => {
        if (!isTyping) return null;

        return (
            <View style={{
                marginVertical: 4,
                marginHorizontal: 16,
                alignItems: 'center',
                display: 'flex',
                flexDirection: 'row',
                gap: 8,
            }}>
                <UserPP image={friend?.profilePic} isActive={false} size={30} />

                <View style={{
                    backgroundColor: themeColors.gray[200],
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderRadius: 20,
                    borderBottomLeftRadius: 4,
                }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>

                        <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                        }}>
                            <View style={{
                                width: 8,
                                height: 8,
                                borderRadius: 4,
                                backgroundColor: themeColors.gray[500],
                                marginRight: 4,
                                opacity: 0.6,
                            }} />
                            <View style={{
                                width: 8,
                                height: 8,
                                borderRadius: 4,
                                backgroundColor: themeColors.gray[500],
                                marginRight: 4,
                                opacity: 0.8,
                            }} />
                            <View style={{
                                width: 8,
                                height: 8,
                                borderRadius: 4,
                                backgroundColor: themeColors.gray[500],
                                opacity: 1,
                            }} />
                        </View>
                        <Text style={{
                            color: themeColors.text.secondary,
                            fontSize: 14,
                            marginLeft: 8,
                        }}>
                            typing...
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
                                ) : friend?.isActive ? (
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
                        keyExtractor={(item, index) => item._id || item.tempId || `msg-${index}-${item.timestamp}`}
                        style={{ flex: 1 }}
                        contentContainerStyle={{ paddingVertical: 8, paddingHorizontal: 16 }}
                        showsVerticalScrollIndicator={false}
                        ListHeaderComponent={renderLoadingOldMessages}
                        ListFooterComponent={renderTypingIndicator}
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
                        maintainVisibleContentPosition={{
                            minIndexForVisible: 0,
                            autoscrollToTopThreshold: 100
                        }}
                    />
                </ImageBackground>
            ) : (
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderMessage}
                    keyExtractor={(item, index) => item._id || item.tempId || `msg-${index}-${item.timestamp}`}
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingVertical: 8, paddingHorizontal: 16 }}
                    showsVerticalScrollIndicator={false}
                    ListHeaderComponent={renderLoadingOldMessages}
                    ListFooterComponent={renderTypingIndicator}
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
                    maintainVisibleContentPosition={{
                        minIndexForVisible: 0,
                        autoscrollToTopThreshold: 100
                    }}
                />
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
                            <UserPP image={friend?.profilePic} isActive={friend?.isActive} size={50} />
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