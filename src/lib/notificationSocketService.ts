// Global socket service for notifications
// This allows notifications to emit socket events without requiring React context

let globalSocketService: any = null;

export const setGlobalSocketService = (socketService: any) => {
  globalSocketService = socketService;
};

export const emitCallRejection = (callerId: string, channelName: string, isAudio: boolean) => {
  if (globalSocketService) {
    try {
      if (isAudio) {
        globalSocketService.endAudioCall(callerId);
      } else {
        globalSocketService.endVideoCall(callerId);
      }
      console.log('Call rejection sent via global socket service');
    } catch (error) {
      console.error('Error sending call rejection via global socket service:', error);
    }
  } else {
    console.warn('Global socket service not available for call rejection');
  }
};
