import { initializeSocket, getSocket, disconnectSocket } from '../socket/socket';

class SocketService {
  private socket: any = null;
  private isConnecting: boolean = false;
  private pendingEmits: { event: string; data: any }[] = [];
  private pendingListeners: { event: string; callback: (...args: any[]) => void }[] = [];

  async connect(profileId: string): Promise<void> {
    if (this.socket && this.socket.connected) {
      console.log('Socket already connected');
      return;
    }

    if (this.isConnecting) {
      console.log('Socket connection already in progress');
      return;
    }

    try {
      this.isConnecting = true;
      this.socket = await initializeSocket(profileId);
      console.log('Socket connected successfully');

      // Flush any queued listeners first
      if (this.pendingListeners.length > 0) {
        this.pendingListeners.forEach(({ event, callback }) => {
          try {
            this.socket.on(event, callback);
          } catch (e) {
            console.warn('Failed to attach pending listener for event:', event, e);
          }
        });
        this.pendingListeners = [];
      }

      // Then flush any queued emits
      if (this.pendingEmits.length > 0) {
        this.pendingEmits.forEach(({ event, data }) => {
          try {
            this.socket.emit(event, data);
          } catch (e) {
            console.warn('Failed to emit pending event:', event, e);
          }
        });
        this.pendingEmits = [];
      }
    } catch (error) {
      console.error('Failed to connect socket:', error);
      throw error;
    } finally {
      this.isConnecting = false;
    }
  }

  disconnect(): void {
    if (this.socket) {
      disconnectSocket();
      this.socket = null;
      console.log('Socket disconnected');
    }
    // Clear any queues on explicit disconnect
    this.pendingEmits = [];
    this.pendingListeners = [];
  }

  emit(event: string, data: any): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit(event, data);
      return;
    }

    // Queue the emit and attempt to flush on next connect
    this.pendingEmits.push({ event, data });
    if (this.socket) {
      this.socket.once('connect', () => {
        const toFlush = [...this.pendingEmits];
        this.pendingEmits = [];
        toFlush.forEach(({ event: ev, data: payload }) => {
          try {
            this.socket.emit(ev, payload);
          } catch (e) {
            console.warn('Failed to emit queued event:', ev, e);
          }
        });
      });
    }
  }

  on(event: string, callback: (...args: any[]) => void): void {
    if (this.socket) {
      this.socket.on(event, callback);
      return;
    }

    // Queue listener to attach when socket is available
    this.pendingListeners.push({ event, callback });
  }

  off(event: string, callback?: (...args: any[]) => void): void {
    if (this.socket) {
      if (callback) {
        this.socket.off(event, callback);
      } else {
        this.socket.off(event);
      }
    }
  }

  isSocketConnected(): boolean {
    return this.socket ? this.socket.connected : false;
  }

  joinChat(user1: string, user2: string): void {
    const room = [user1, user2].sort().join('-');
    this.emit('join-chat', { room, user1, user2 });
  }

  sendMessage(room: string, senderId: string, receiverId: string, message: string, attachment?: any, parent?: string): void {
    this.emit('send-message', {
      room,
      senderId,
      receiverId,
      message,
      attachment,
      parent
    });
  }

  loadMessages(myId: string, friendId: string, skip: number): void {
    this.emit('load-messages', { myId, friendId, skip });
  }

  markMessageAsSeen(message: any): void {
    this.emit('mark-message-seen', message);
  }

  setTyping(room: string, isTyping: boolean, type: string, receiverId: string): void {
    this.emit('typing', { room, isTyping, type, receiverId });
  }

  fetchMessages(profileId: string): void {
    this.emit('fetch-messages', { profileId });
  }

  updateLastLogin(userId: string): void {
    this.emit('update-last-login', { userId });
  }

  checkUserActive(profileId: string, myId: string): void {
    this.emit('check-user-active', { profileId, myId });
  }

  // Video call methods
  startVideoCall(to: string, channelName: string): void {
    this.emit('video-call', { to, channelName, isAudio: false });
  }

  answerVideoCall(to: string, channelName: string): void {
    this.emit('answer-call', { to, channelName, isAudio: false });
  }


  endAudioCall(friendId: string, channelName?: string, action?: string): void {
    if(action === 'reject') {
      this.emit('audio-call-reject', { to: friendId, channelName: channelName || '' });
    } else if(action === 'cancel') {
      this.emit('audio-call-cancel', { to: friendId, channelName: channelName || '' });
    }else {
      this.emit('audio-call-end', { to: friendId, channelName: channelName || '' });
    }
  }

  endVideoCall(friendId: string, channelName?: string, action?: string): void {
    if(action === 'reject') {
      this.emit('video-call-reject', { to: friendId, channelName: channelName || '' });
    } else if(action === 'cancel') {
      this.emit('video-call-cancel', { to: friendId, channelName: channelName || '' });
    }else {
      this.emit('video-call-end', { to: friendId, channelName: channelName || '' });
    }
  }

  // Audio call methods
  startAudioCall(to: string, channelName: string): void {
    this.emit('audio-call', { to, channelName, isAudio: true });
  }

  answerAudioCall(to: string, channelName: string): void {
    this.emit('answer-call', { to, channelName, isAudio: true });
  }



  // Filter methods
  applyVideoFilter(to: string, filter: string): void {
    this.emit('filter-video', { to, filter });
  }
}

export default new SocketService();
