"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";

const CACHE_KEY = "veilbook_wallet_connection";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CachedConnection {
  connected: boolean;
  timestamp: number;
}

interface WalletContextType {
  api: any | null;
  wallet: any | null;
  address: string | null;
  coinPublicKey: string | null;
  encryptionPublicKey: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

function getCachedConnection(): CachedConnection | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached: CachedConnection = JSON.parse(raw);
    if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return cached;
  } catch {
    return null;
  }
}

function setCachedConnection() {
  localStorage.setItem(CACHE_KEY, JSON.stringify({ connected: true, timestamp: Date.now() }));
}

function clearCachedConnection() {
  localStorage.removeItem(CACHE_KEY);
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [api, setApi] = useState<any | null>(null);
  const [wallet, setWallet] = useState<any | null>(null);
  const [coinPublicKey, setCoinPublicKey] = useState<string | null>(null);
  const [encryptionPublicKey, setEncryptionPublicKey] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoConnectAttempted = useRef(false);

  // Detect injected wallet
  useEffect(() => {
    const checkWallet = () => {
      const midnight = (window as any).midnight;
      if (midnight) {
        const provider = midnight.mnLace || midnight.nightly;
        if (provider) {
          setApi(provider);
          return true;
        }
      }
      return false;
    };

    // Give extensions a moment to inject
    const timeout = setTimeout(() => {
      checkWallet();
    }, 500);

    return () => clearTimeout(timeout);
  }, []);

  const connectInternal = useCallback(async (currentApi: any, reconnecting: boolean) => {
    try {
      if (reconnecting) {
        setIsReconnecting(true);
      } else {
        setIsConnecting(true);
      }
      setError(null);

      const enabledWallet = await currentApi.enable();
      setWallet(enabledWallet);

      const state = await enabledWallet.state();
      setAddress(state.address);

      try {
        const addrs = await enabledWallet.getShieldedAddresses();
        setCoinPublicKey(addrs.shieldedCoinPublicKey);
        setEncryptionPublicKey(addrs.shieldedEncryptionPublicKey);
      } catch {
        // Wallet may not support shielded addresses
      }

      setIsConnected(true);
      setCachedConnection();

      // Subscribe to state changes
      enabledWallet.stateEvents?.subscribe((newState: any) => {
        setAddress(newState.address);
      });
    } catch (err: any) {
      setError(err.message || "Failed to connect wallet.");
      setIsConnected(false);
      clearCachedConnection();
    } finally {
      setIsConnecting(false);
      setIsReconnecting(false);
    }
  }, []);

  // Auto-reconnect if cached
  useEffect(() => {
    if (!api || autoConnectAttempted.current || isConnected) return;
    autoConnectAttempted.current = true;

    const cached = getCachedConnection();
    if (cached?.connected) {
      connectInternal(api, true);
    }
  }, [api, isConnected, connectInternal]);

  const connect = useCallback(async () => {
    if (!api) {
      setError("No Midnight wallet found. Please install Lace.");
      return;
    }
    await connectInternal(api, false);
  }, [api, connectInternal]);

  const disconnect = useCallback(() => {
    setWallet(null);
    setAddress(null);
    setCoinPublicKey(null);
    setEncryptionPublicKey(null);
    setIsConnected(false);
    clearCachedConnection();
  }, []);

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
        isReconnecting,
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
