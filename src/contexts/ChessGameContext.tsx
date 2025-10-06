import React, { createContext, useContext, useState, ReactNode } from 'react';

interface ChessGameContextType {
  isChessGameActive: boolean;
  setChessGameActive: (active: boolean) => void;
}

const ChessGameContext = createContext<ChessGameContextType | undefined>(undefined);

export const ChessGameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isChessGameActive, setIsChessGameActive] = useState(false);

  const setChessGameActive = (active: boolean) => {
    setIsChessGameActive(active);
  };

  return (
    <ChessGameContext.Provider value={{ isChessGameActive, setChessGameActive }}>
      {children}
    </ChessGameContext.Provider>
  );
};

export const useChessGame = () => {
  const context = useContext(ChessGameContext);
  if (context === undefined) {
    throw new Error('useChessGame must be used within a ChessGameProvider');
  }
  return context;
};


