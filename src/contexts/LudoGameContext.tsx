import React, { createContext, useContext, useState, ReactNode } from 'react';

interface LudoGameContextType {
  isLudoGameActive: boolean;
  setLudoGameActive: (active: boolean) => void;
}

const LudoGameContext = createContext<LudoGameContextType | undefined>(undefined);

export const LudoGameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isLudoGameActive, setIsLudoGameActive] = useState(false);

  const setLudoGameActive = (active: boolean) => {
    setIsLudoGameActive(active);
  };

  return (
    <LudoGameContext.Provider value={{ isLudoGameActive, setLudoGameActive }}>
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

