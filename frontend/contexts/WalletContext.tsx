"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface WalletContextType {
  api: any | null;
  wallet: any | null;
  address: string | null;
  coinPublicKey: string | null;
  encryptionPublicKey: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [api, setApi] = useState<any | null>(null);
  const [wallet, setWallet] = useState<any | null>(null);
  const [coinPublicKey, setCoinPublicKey] = useState<string | null>(null);
  const [encryptionPublicKey, setEncryptionPublicKey] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check for injected wallets on mount
  useEffect(() => {
    const checkWallet = () => {
      // Look for Lace or Nightly
      // window.midnight is injected by extensions
      const midnight = (window as any).midnight;
      if (midnight) {
        const provider = midnight.mnLace || midnight.nightly;
        if (provider) {
          setApi(provider);
        }
      }
    };
    
    // Give extensions a moment to inject
    setTimeout(checkWallet, 500);
  }, []);

  const connect = async () => {
    if (!api) {
      setError("No Midnight wallet found. Please install Lace or Nightly.");
      return;
    }

    try {
      setIsConnecting(true);
      setError(null);
      
      const enabledWallet = await api.enable();
      setWallet(enabledWallet);
      
      const state = await enabledWallet.state();
      setAddress(state.address);

      try {
        const addrs = await enabledWallet.getShieldedAddresses();
        setCoinPublicKey(addrs.shieldedCoinPublicKey);
        setEncryptionPublicKey(addrs.shieldedEncryptionPublicKey);
      } catch(e) {}

      setIsConnected(true);
      
      // Subscribe to state changes if the wallet supports it
      enabledWallet.stateEvents?.subscribe((newState: any) => {
        setAddress(newState.address);
      });
      
    } catch (err: any) {
      setError(err.message || "Failed to connect wallet.");
      setIsConnected(false);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = () => {
    setWallet(null);
    setAddress(null);
    setIsConnected(false);
  };

  return (
    <WalletContext.Provider
      value={{
        api,
        wallet,
        address,
        coinPublicKey,
        encryptionPublicKey,
        isConnected,
        isConnecting,
        error,
        connect,
        disconnect,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}
