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
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors } from '../theme/colors';
import UserPP from '../components/UserPP';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { useSocket } from '../contexts/SocketContext';

interface Message {
    id: string;
    message: string;
    receiverId: string;
    senderId: string;
    timestamp: Date;
    isRead: boolean;
}

const SingleMessage = () => {
    const route = useRoute();
    const navigation = useNavigation();
    const { friend } = route.params as { friend: any };
    const myProfile = useSelector((state: RootState) => state.profile);
    const [room, setRoom] = useState('');

    const { connect, isConnected, emit, on, off } = useSocket();

    // Connect to socket when component mounts
    useEffect(() => {
        if (friend?._id && myProfile?._id && !isConnected) {
            connect(myProfile._id)
                .then(() => {
                    console.log('Socket connected successfully in SingleMessage component');
                })
                .catch((error) => {
                    console.error('Failed to connect socket in SingleMessage component:', error);
                    Alert.alert('Connection Error', 'Failed to connect to real-time service');
                });
        }
    }, [friend?._id, myProfile?._id, isConnected, connect]);

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

    // Listen for incoming messages
    useEffect(() => {
        if (!isConnected) return;


        emit('fetchMessages', myProfile?._id);

        on('previousMessages', (messages) => {
            console.log('Old messages received:', messages);
            setMessages(messages);
        });

        const handleNewMessage = (messageData: any) => {
            console.log('New message received:', messageData);
            // Add the new message to the messages state
            const newMessage: Message = {
                id: messageData.id || Date.now().toString(),
                message: messageData.message || 'No message',
                receiverId: messageData.receiverId,
                senderId: messageData.senderId,
                timestamp: new Date(messageData.timestamp || Date.now()),
                isRead: false,
            };
            setMessages(prev => [...prev, newMessage]);
        };

        on('newMessage', handleNewMessage);

        return () => {
            off('newMessage', handleNewMessage);
        };
    }, [isConnected, myProfile?._id, on, off]);

    // Early return if required data is not available
    if (!friend?._id || !myProfile?._id) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.light }}>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Text>Loading...</Text>
                </View>
            </SafeAreaView>
        );
    }


    // Hide bottom tabs when this screen is focused
    useFocusEffect(
        React.useCallback(() => {
            // Hide bottom tabs
            navigation.getParent()?.setOptions({
                tabBarStyle: { display: 'none' }
            });

            // Show bottom tabs when screen loses focus
            return () => {
                navigation.getParent()?.setOptions({
                    tabBarStyle: {
                        backgroundColor: colors.background.light,
                        borderTopColor: colors.border.light,
                        height: 60,
                        paddingBottom: 8,
                        paddingTop: 8,
                    }
                });
            };
        }, [navigation])
    );

    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            message: 'Hey! How are you doing?',
            senderId: friend?._id,
            receiverId: myProfile?._id,
            timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
            isRead: true,
        },
        {
            id: '2',
            message: 'I\'m doing great! Just finished working on that project.',
            senderId: myProfile?._id,
            receiverId: friend?._id,
            timestamp: new Date(Date.now() - 1000 * 60 * 25), // 25 minutes ago
            isRead: true,
        },
        {
            id: '3',
            message: 'That sounds amazing! Can you tell me more about it?',
            senderId: friend?._id,
            receiverId: myProfile?._id,
            timestamp: new Date(Date.now() - 1000 * 60 * 20), // 20 minutes ago
            isRead: false,
        },
    ]);

    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const flatListRef = useRef<FlatList>(null);

    useEffect(() => {
        // Scroll to bottom when new messages arrive
        if (messages.length > 0) {
            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
        }
    }, [messages]);

    const sendMessage = () => {
        if (inputText.trim() && isConnected) {
            const newMessage: Message = {
                id: Date.now().toString(),
                message: inputText.trim(),
                receiverId: friend?._id,
                senderId: myProfile?._id,
                timestamp: new Date(),
                isRead: false,
            };

            // Add message to local state immediately for optimistic UI
            setMessages(prev => [...prev, newMessage]);
            setInputText('');

            // Send message through socket
            emit('sendMessage', {
                room,
                senderId: myProfile?._id,
                receiverId: friend?._id,
                message: inputText.trim(),
                timestamp: new Date().toISOString()
            });


            // Remove the simulated friend response since we're now using real-time messaging
            // setIsTyping(true);
            // setTimeout(() => {
            //     const friendResponse: Message = {
            //         id: (Date.now() + 1).toString(),
            //         text: 'Thanks for the message! I\'ll get back to you soon.',
            //         sender: 'friend',
            //         receiverId: myProfile?._id,
            //         senderId: friend?._id,
            //         timestamp: new Date(),
            //         isRead: true,
            //     };
            //     setMessages(prev => [...prev, friendResponse]);
            //     setIsTyping(false);
            // }, 2000);
        }
    };

    const formatTime = (date: Date) => {
        return '5 M ago';
        const now = new Date();
        const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

        if (diffInHours < 1) {
            const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
            return `${diffInMinutes}m ago`;
        } else if (diffInHours < 24) {
            return `${Math.floor(diffInHours)}h ago`;
        } else {
            return date.toLocaleDateString();
        }
    };

    const renderMessage = ({ item }: { item: Message }) => (
        <View style={{
            marginVertical: 4,
            marginHorizontal: 16,
            flexDirection: 'row',
            alignItems: 'flex-end',
            justifyContent: item.senderId === myProfile?._id ? 'flex-end' : 'flex-start',
        }}>
            {/* Avatar for friend messages (left side) */}
            {item.senderId === friend?._id && (
                <View style={{
                    marginRight: 8,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 18,
                }}>
                    <UserPP image={friend?.profilePic} isActive={true} size={30} />
                </View>
            )}

            {/* Message content */}
            <View style={{
                maxWidth: '75%',
                alignItems: item.senderId === myProfile?._id ? 'flex-end' : 'flex-start',
            }}>
                <View style={{
                    backgroundColor: item.senderId === myProfile?._id ? colors.primary : colors.gray[200],
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 20,
                    borderBottomLeftRadius:item.senderId === myProfile?._id ? 20 : 4,
                    borderBottomRightRadius: item.senderId === myProfile?._id ? 4 : 20,
                }}>
                    <Text style={{
                        color: item.senderId === myProfile?._id ? colors.white : colors.text.primary,
                        fontSize: 16,
                        lineHeight: 20,
                    }}>
                        {item.message}
                    </Text>
                    {item.senderId === myProfile?._id ? (
                        <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            marginTop: -2,
                            justifyContent: 'flex-end',
                        }}>
                            <Icon
                                name={item.isRead ? 'done-all' : 'check'}
                                size={16}
                                color={item.isRead ? colors.info : colors.white}
                                style={{ marginLeft: 4 }}
                            />
                            <Text style={{
                                color: colors.white,
                                fontSize: 12,
                                opacity: 0.7,
                                marginHorizontal: 4,
                            }}>
                                {formatTime(item.timestamp) === '0m ago' ? 'now' : formatTime(item.timestamp)}
                            </Text>
                        </View>
                    ) : (
                        <Text style={{
                            color: item.senderId === myProfile?._id ? colors.primary : colors.text.secondary,
                            fontSize: 12,
                            opacity: 0.7,
                            marginTop: 0,
                        }}>
                            {formatTime(item.timestamp) === '0m ago' ? 'now' : formatTime(item.timestamp)}
                        </Text>
                    )}


                </View>

            </View>

        </View>
    );

    const renderTypingIndicator = () => {
        if (!isTyping) return null;

        return (
            <View style={{
                marginVertical: 4,
                marginHorizontal: 16,
                alignItems: 'flex-start',
            }}>
                <View style={{
                    backgroundColor: colors.gray[200],
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
                                backgroundColor: colors.gray[500],
                                marginRight: 4,
                                opacity: 0.6,
                            }} />
                            <View style={{
                                width: 8,
                                height: 8,
                                borderRadius: 4,
                                backgroundColor: colors.gray[500],
                                marginRight: 4,
                                opacity: 0.8,
                            }} />
                            <View style={{
                                width: 8,
                                height: 8,
                                borderRadius: 4,
                                backgroundColor: colors.gray[500],
                                opacity: 1,
                            }} />
                        </View>
                        <Text style={{
                            color: colors.text.secondary,
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

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.light }}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.background.light} />

            {/* Header */}
            <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 8,
                backgroundColor: colors.white,
                borderBottomWidth: 1,
                borderBottomColor: colors.border.light,
            }}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={{
                        alignItems: 'flex-start',
                        justifyContent: 'center',
                        marginRight: 5,
                    }}
                >
                    <Icon name="arrow-back" size={22} color={colors.text.primary} />
                </TouchableOpacity>

                <View style={{ flex: 1 }}>

                    <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8 }}>

                        <UserPP image={friend?.profilePic} isActive={friend?.isActive} size={35} />


                        <View>
                            <Text style={{
                                fontSize: 16,
                                fontWeight: '600',
                                color: colors.text.primary,
                            }}>
                                {friend?.fullName || 'Friend'}
                            </Text>
                            <Text style={{
                                fontSize: 14,
                                color: colors.text.secondary,
                                marginTop: -3,
                            }}>
                                {isTyping ? 'typing...' : friend?.isActive ? (<View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 4 }}><View style={{ height: 10, width: 10, borderRadius: 5, backgroundColor: 'green' }}></View><Text style={{ fontSize: 12, color: colors.text.secondary }}>Online</Text></View>) : 'Away'}
                            </Text>
                        </View>



                    </View>

                </View>

                <TouchableOpacity
                    onPress={() => Alert.alert('Call', 'Call feature coming soon!')}
                    style={{
                        width: 35,
                        height: 35,
                        borderRadius: 20,
                        backgroundColor: colors.primary,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginLeft: 5,
                    }}
                >
                    <Icon name="notifications" size={20} color={colors.white} />
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => Alert.alert('Call', 'Call feature coming soon!')}
                    style={{
                        width: 35,
                        height: 35,
                        borderRadius: 20,
                        backgroundColor: colors.primary,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginLeft: 5,
                    }}
                >
                    <Icon name="call" size={20} color={colors.white} />
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => Alert.alert('Video Call', 'Video call feature coming soon!')}
                    style={{
                        width: 35,
                        height: 35,
                        borderRadius: 20,
                        backgroundColor: colors.secondary,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginLeft: 5,
                    }}
                >
                    <Icon name="videocam" size={20} color={colors.white} />
                </TouchableOpacity>
            </View>

            {/* Messages */}
            <FlatList
                ref={flatListRef}
                data={messages}
                renderItem={renderMessage}
                keyExtractor={(item) => item.id}
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingVertical: 8 }}
                showsVerticalScrollIndicator={false}
                ListFooterComponent={renderTypingIndicator}
            />

            {/* Input Area */}
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{
                    backgroundColor: colors.white,
                    borderTopWidth: 1,
                    borderTopColor: colors.border.light,
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                }}
            >
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                }}>
                    <TouchableOpacity
                        onPress={() => Alert.alert('Attachment', 'Attachment feature coming soon!')}
                        style={{
                            width: 30,
                            height: 30,
                            borderRadius: 20,
                            backgroundColor: colors.gray[100],
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: 8,
                        }}
                    >
                        <Icon name="add" size={24} color={colors.text.secondary} />
                    </TouchableOpacity>

                    <View style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: colors.gray[100],
                        borderRadius: 20,
                        paddingHorizontal: 12,
                        paddingVertical: 0,
                        marginRight: 8,
                    }}>
                        <TextInput
                            value={inputText}
                            onChangeText={setInputText}
                            placeholder="Type a message..."
                            placeholderTextColor={colors.text.secondary}
                            style={{
                                flex: 1,
                                fontSize: 16,
                                color: colors.text.primary,
                                maxHeight: 80,
                                height: 32,
                                paddingVertical: 0,
                            }}
                            multiline
                            textAlignVertical="center"
                        />
                    </View>

                    <TouchableOpacity
                        onPress={sendMessage}
                        disabled={!inputText.trim()}
                        style={{
                            width: 30,
                            height: 30,
                            borderRadius: 20,
                            backgroundColor: inputText.trim() ? colors.primary : colors.gray[300],
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Icon
                            name="send"
                            style={{ marginRight: -2 }}
                            size={20}
                            color={inputText.trim() ? colors.white : colors.text.secondary}
                        />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

export default SingleMessage;