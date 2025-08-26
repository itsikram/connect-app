import { initializeSocket, getSocket, disconnectSocket } from '../socket/socket';

class SocketService {
  private socket: any = null;
  private isConnecting: boolean = false;

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
  }

  emit(event: string, data: any): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('Socket not connected, cannot emit event:', event);
    }
  }

  on(event: string, callback: (...args: any[]) => void): void {
    if (this.socket) {
      this.socket.on(event, callback);
    } else {
      console.warn('Socket not available, cannot listen to event:', event);
    }
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
}

export default new SocketService();
