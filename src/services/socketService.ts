import { initializeSocket, getSocket, disconnectSocket } from '../socket/socket';

class SocketService {
  private socket: any = null;
  private isConnecting: boolean = false;
  private pendingEmits: { event: string; data: any; ack?: (...args: any[]) => void }[] = [];
  private registeredListeners: { event: string; callback: (...args: any[]) => void }[] = [];

  private attachRegisteredListeners = (): void => {
    if (!this.socket) return;
    this.registeredListeners.forEach(({ event, callback }) => {
      try {
        this.socket.off(event, callback);
        this.socket.on(event, callback);
      } catch (e) {
        console.warn('Failed to attach listener for event:', event, e);
      }
    });
  };

    async connect(profileId: string): Promise<void> {
    if (this.socket && this.socket.connected) {
      if (__DEV__) {
        console.log('✅ Socket already connected');
      }
      this.attachRegisteredListeners();
      return;
    }

    if (this.isConnecting) {
      if (__DEV__) {
        console.log('⏳ Socket connection already in progress');
      }
      return;
    }

    try {
      this.isConnecting = true;
      if (__DEV__) {
        console.log('🔌 Starting socket connection with profileId:', profileId);
      }
      this.socket = await initializeSocket(profileId);
      if (__DEV__) {
        console.log('✅ Socket connected successfully in socketService');
      }

      this.attachRegisteredListeners();
      if (this.socket) {
        this.socket.off('connect', this.attachRegisteredListeners);
        this.socket.on('connect', this.attachRegisteredListeners);
      }

      // Then flush any queued emits
      if (this.pendingEmits.length > 0) {
        this.pendingEmits.forEach(({ event, data, ack }) => {
          try {
            if (typeof ack === 'function') {
              this.socket.emit(event, data, ack);
            } else {
              this.socket.emit(event, data);
            }
          } catch (e) {
            console.warn('Failed to emit pending event:', event, e);
          }
        });
        this.pendingEmits = [];
      }
    } catch (error) {
      // Always log connection failures as they're important
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
    this.pendingEmits = [];
  }

  emit(event: string, data: any, ack?: (...args: any[]) => void): void {
    if (this.socket && this.socket.connected) {
      if (typeof ack === 'function') {
        this.socket.emit(event, data, ack);
      } else {
        this.socket.emit(event, data);
      }
      return;
    }

    // Queue the emit and attempt to flush on next connect
    this.pendingEmits.push({ event, data, ack });
    if (this.socket) {
      this.socket.once('connect', () => {
        const toFlush = [...this.pendingEmits];
        this.pendingEmits = [];
        toFlush.forEach(({ event: ev, data: payload, ack: cb }) => {
          try {
            if (typeof cb === 'function') {
              this.socket.emit(ev, payload, cb);
            } else {
              this.socket.emit(ev, payload);
            }
          } catch (e) {
            console.warn('Failed to emit queued event:', ev, e);
          }
        });
      });
    }
  }

  on(event: string, callback: (...args: any[]) => void): void {
    const already = this.registeredListeners.some(
      (l) => l.event === event && l.callback === callback,
    );
    if (!already) {
      this.registeredListeners.push({ event, callback });
    }
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event: string, callback?: (...args: any[]) => void): void {
    if (callback) {
      this.registeredListeners = this.registeredListeners.filter(
        (l) => !(l.event === event && l.callback === callback),
      );
      this.socket?.off(event, callback);
    } else {
      this.registeredListeners = this.registeredListeners.filter((l) => l.event !== event);
      this.socket?.off(event);
    }
  }

  isSocketConnected(): boolean {
    return this.socket ? this.socket.connected : false;
  }

  joinChat(user1: string, user2: string): void {
    const room = [user1, user2].sort().join('_');
    this.emit('startChat', { user1, user2 });
    this.emit('joinRoom', room);
  }

  joinRoom(roomId: string): void {
    this.emit('joinRoom', roomId);
  }

  sendMessage(room: string, senderId: string, receiverId: string, message: string, attachment?: any, parent?: string): void {
    this.emit('sendMessage', {
      room,
      senderId,
      receiverId,
      message,
      attachment,
      parent,
      messageType: 'text',
    });
  }

  loadMessages(myId: string, friendId: string, skip: number): void {
    this.emit('loadMessages', { myId, friendId, skip });
  }

  markMessageAsSeen(message: any): void {
    this.emit('seenMessage', message);
  }

  setTyping(room: string, isTyping: boolean, type: string, receiverId: string, senderId?: string): void {
    this.emit('typing', { room, isTyping, type, receiverId, senderId });
  }

  fetchMessages(profileId: string): void {
    this.emit('fetchMessages', profileId);
  }

  updateCallStatus(to: string, status: string): void {
    this.emit('update-call-status', { to: String(to), status });
  }

  updateLastLogin(userId: string): void {
    this.emit('update-last-login', { userId });
  }

  checkUserActive(profileId: string, myId: string): void {
    this.emit('check-user-active', { profileId, myId });
  }

  // Video call methods
  startVideoCall(to: string, channelName: string): void {
    this.emit('video-call', { to: String(to), channelName, isAudio: false });
  }

  answerVideoCall(to: string, channelName: string): void {
    this.emit('answer-call', { to: String(to), channelName, isAudio: false });
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
    this.emit('audio-call', { to: String(to), channelName, isAudio: true });
  }

  answerAudioCall(to: string, channelName: string): void {
    this.emit('answer-call', { to: String(to), channelName, isAudio: true });
  }



  // Filter methods
  applyVideoFilter(to: string, filter: string): void {
    this.emit('filter-video', { to, filter });
  }
}

export default new SocketService();
