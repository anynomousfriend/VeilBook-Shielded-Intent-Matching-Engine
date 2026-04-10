"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";

const CACHE_KEY = "veilbook_wallet_connection";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const NETWORK_ID = "preprod";

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

/**
 * Discover the first compatible Midnight wallet from window.midnight.
 * Lace injects at window.midnight[<uuid>] — Object.values() enumerates them.
 * We accept any wallet with apiVersion 4.x.
 */
function detectWalletProvider(): any | null {
  const ns = (window as any)?.midnight;
  if (!ns || typeof ns !== 'object') return null;

  // Try well-known key first
  if (ns.mnLace && typeof ns.mnLace.connect === 'function') return ns.mnLace;

  // Scan all values for a compatible provider (documented pattern)
  try {
    const wallet = Object.values(ns).find(
      (w: any) => w && typeof w === 'object' && typeof w.connect === 'function' && w.apiVersion?.startsWith('4.')
    );
    if (wallet) return wallet;
  } catch { /* proxy may throw */ }

  // Fallback: any value with connect()
  try {
    const wallet = Object.values(ns).find(
      (w: any) => w && typeof w === 'object' && typeof w.connect === 'function'
    );
    if (wallet) return wallet;
  } catch { /* */ }

  return null;
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
  const detectionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll for the extension until found
  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 20; // 10 seconds

    const tryDetect = () => {
      const provider = detectWalletProvider();
      if (provider) {
        console.log('[Veilbook] Wallet provider detected:', provider.name ?? 'unknown', 'v' + provider.apiVersion);
        setApi(provider);
        if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
        return;
      }
      attempts++;
      if (attempts >= maxAttempts) {
        console.warn('[Veilbook] No Midnight wallet detected after 10s');
        if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
      }
    };

    tryDetect();
    detectionIntervalRef.current = setInterval(tryDetect, 500);

    return () => {
      if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
    };
  }, []);

  const connectInternal = useCallback(async (provider: any, reconnecting: boolean) => {
    try {
      if (reconnecting) {
        setIsReconnecting(true);
      } else {
        setIsConnecting(true);
      }
      setError(null);

      // DApp Connector API v4: connect(networkId)
      const connectedApi = await provider.connect(NETWORK_ID);
      setWallet(connectedApi);

      // Get unshielded address for display
      try {
        const addr = await connectedApi.getUnshieldedAddress();
        // addr may be a string or an object with a toString()/address field — normalize
        const addrStr = typeof addr === 'string' ? addr : (addr?.unshieldedAddress ?? addr?.address ?? addr?.toString?.() ?? String(addr));
        console.log('[Veilbook] Unshielded address:', addrStr);
        setAddress(addrStr);
      } catch {
        // Fallback: try state() for older API versions
        try {
          const state = await connectedApi.state();
          const addr = state?.address;
          setAddress(typeof addr === 'string' ? addr : String(addr ?? ''));
        } catch { /* no address available */ }
      }

      // Get shielded keys for ZK operations
      try {
        const addrs = await connectedApi.getShieldedAddresses();
        console.log('[Veilbook] Shielded addresses:', addrs);
        const cpk = addrs.shieldedCoinPublicKey;
        const epk = addrs.shieldedEncryptionPublicKey;
        setCoinPublicKey(typeof cpk === 'string' ? cpk : (cpk?.toString?.() ?? null));
        setEncryptionPublicKey(typeof epk === 'string' ? epk : (epk?.toString?.() ?? null));
      } catch {
        // Wallet may not support shielded addresses
      }

      setIsConnected(true);
      setCachedConnection();
    } catch (err: any) {
      console.error('[Veilbook] Wallet connection failed:', err);
      setError(err.message || "Failed to connect wallet.");
      setIsConnected(false);
      clearCachedConnection();
    } finally {
      setIsConnecting(false);
      setIsReconnecting(false);
    }
  }, []);

  // Auto-reconnect if previously connected
  useEffect(() => {
    if (!api || autoConnectAttempted.current || isConnected) return;
    autoConnectAttempted.current = true;

    const cached = getCachedConnection();
    if (cached?.connected) {
      connectInternal(api, true);
    }
  }, [api, isConnected, connectInternal]);

  const connect = useCallback(async () => {
    // Re-probe at click time in case extension loaded late
    const freshProvider = detectWalletProvider() ?? api;

    if (!freshProvider) {
      setError("Midnight wallet not found. Install the Lace wallet extension and refresh.");
      return;
    }

    if (freshProvider !== api) setApi(freshProvider);
    await connectInternal(freshProvider, false);
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
