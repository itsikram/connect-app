import React, { createContext, useContext, useState, ReactNode } from 'react';
import Toast, { ToastType } from '../components/Toast';

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  showSuccess: (message: string, duration?: number) => void;
  showError: (message: string, duration?: number) => void;
  showWarning: (message: string, duration?: number) => void;
  showInfo: (message: string, duration?: number) => void;
  hideToast: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

interface ToastProviderProps {
  children: ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toastConfig, setToastConfig] = useState<{
    visible: boolean;
    message: string;
    type: ToastType;
    duration: number;
  }>({
    visible: false,
    message: '',
    type: 'info',
    duration: 3000,
  });

  const showToast = (message: string, type: ToastType = 'info', duration: number = 3000) => {
    setToastConfig({
      visible: true,
      message,
      type,
      duration,
    });
  };

  const showSuccess = (message: string, duration: number = 3000) => {
    showToast(message, 'success', duration);
  };

  const showError = (message: string, duration: number = 4000) => {
    showToast(message, 'error', duration);
  };

  const showWarning = (message: string, duration: number = 3500) => {
    showToast(message, 'warning', duration);
  };

  const showInfo = (message: string, duration: number = 3000) => {
    showToast(message, 'info', duration);
  };

  const hideToast = () => {
    setToastConfig(prev => ({ ...prev, visible: false }));
  };

  const handleToastHide = () => {
    setToastConfig(prev => ({ ...prev, visible: false }));
  };

  return (
    <ToastContext.Provider
      value={{
        showToast,
        showSuccess,
        showError,
        showWarning,
        showInfo,
        hideToast,
      }}
    >
      {children}
      <Toast
        visible={toastConfig.visible}
        message={toastConfig.message}
        type={toastConfig.type}
        duration={toastConfig.duration}
        onHide={handleToastHide}
        position="top"
        showIcon={true}
        showCloseButton={true}
      />
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
