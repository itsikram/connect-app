import React, { createContext, useContext, useState, ReactNode } from 'react';

interface LudoGameContextType {
  isLudoGameActive: boolean;
  setLudoGameActive: (active: boolean) => void;
  pendingLudoInvite: LudoInviteRequest | null;
  requestLudoInvite: (invite: LudoInviteRequest) => void;
  consumeLudoInvite: () => void;
}

export interface LudoInviteRequest {
  id: string;
  name?: string;
  profilePic?: string;
  coverPic?: string;
  gameId?: string;
  by?: string;
  playerCount?: number;
  slotIndex?: number;
  inviteId?: string;
}

const LudoGameContext = createContext<LudoGameContextType | undefined>(undefined);

export const LudoGameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isLudoGameActive, setIsLudoGameActive] = useState(false);
  const [pendingLudoInvite, setPendingLudoInvite] = useState<LudoInviteRequest | null>(null);

  const setLudoGameActive = (active: boolean) => {
    setIsLudoGameActive(active);
  };

  // "Invite this person to Ludo" from elsewhere in the app; the Ludo menu
  // creates the game and sends the invite.
  const requestLudoInvite = (invite: LudoInviteRequest) => {
    setPendingLudoInvite(invite);
  };

  const consumeLudoInvite = () => {
    setPendingLudoInvite(null);
  };

  return (
    <LudoGameContext.Provider
      value={{
        isLudoGameActive,
        setLudoGameActive,
        pendingLudoInvite,
        requestLudoInvite,
        consumeLudoInvite,
      }}
    >
      {children}
    </LudoGameContext.Provider>
  );
};

export const useLudoGame = () => {
  const context = useContext(LudoGameContext);
  if (context === undefined) {
    throw new Error('useLudoGame must be used within a LudoGameProvider');
  }
  return context;
};
