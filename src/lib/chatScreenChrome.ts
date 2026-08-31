import { useSyncExternalStore } from 'react';

type Listener = () => void;

let chatScreenActive = false;
const listeners = new Set<Listener>();

function emit() {
    listeners.forEach((listener) => listener());
}

export function setChatScreenChrome(active: boolean) {
    if (chatScreenActive === active) return;
    chatScreenActive = active;
    emit();
}

export function getChatScreenChrome() {
    return chatScreenActive;
}

export function subscribeChatScreenChrome(listener: Listener) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function hideTabBarForChat(navigation?: { getParent?: () => any; setOptions?: (o: any) => void }) {
    setChatScreenChrome(true);
    let nav: any = navigation;
    for (let i = 0; i < 4 && nav; i += 1) {
        nav.setOptions?.({
            tabBarStyle: { display: 'none', height: 0, position: 'absolute' },
            safeAreaInsets: { bottom: 0, top: 0, left: 0, right: 0 },
        });
        nav = typeof nav.getParent === 'function' ? nav.getParent() : null;
    }
}

export function restoreTabBarAfterChat(navigation?: { getParent?: () => any; setOptions?: (o: any) => void }) {
    setChatScreenChrome(false);
    let nav: any = navigation;
    for (let i = 0; i < 4 && nav; i += 1) {
        nav.setOptions?.({
            tabBarStyle: { position: 'absolute' },
            safeAreaInsets: undefined,
        });
        nav = typeof nav.getParent === 'function' ? nav.getParent() : null;
    }
}

export function useChatScreenChrome() {
    return useSyncExternalStore(subscribeChatScreenChrome, getChatScreenChrome, getChatScreenChrome);
}
