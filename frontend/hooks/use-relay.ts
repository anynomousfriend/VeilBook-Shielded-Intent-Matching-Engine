"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { RelayClient, type RelayMessage, type RelayOrderData } from '@/lib/relay-client';

const RELAY_URL = process.env.NEXT_PUBLIC_RELAY_URL || 'ws://localhost:4400';

export interface UseRelayReturn {
  peerCount: number;
  counterpartyOrders: RelayOrderData[];
  isConnected: boolean;
  matchEvent: { type: 'confirmed'; blockHeight: number; by: string } | { type: 'attempted'; by: string } | null;
  publishOrder: (data: RelayOrderData) => void;
  publishMatchAttempt: (walletAddress: string) => void;
  publishMatchConfirmed: (blockHeight: number, walletAddress: string) => void;
  publishMatchFailed: (reason: string, walletAddress: string) => void;
}

export function useRelay(
  contractAddress: string | null,
  walletAddress: string | null,
  onRelayMessage?: (msg: RelayMessage) => void,
): UseRelayReturn {
  const clientRef = useRef<RelayClient | null>(null);
  const [peerCount, setPeerCount] = useState(0);
  const [counterpartyOrders, setCounterpartyOrders] = useState<RelayOrderData[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [matchEvent, setMatchEvent] = useState<UseRelayReturn['matchEvent']>(null);

  // Stable callback ref for external handler
  const onRelayMessageRef = useRef(onRelayMessage);
  onRelayMessageRef.current = onRelayMessage;

  useEffect(() => {
    const client = new RelayClient(RELAY_URL);
    clientRef.current = client;

    const unsub = client.onMessage((msg) => {
      onRelayMessageRef.current?.(msg);

      switch (msg.type) {
        case 'PEER_JOINED':
          setPeerCount(msg.peerCount);
          setIsConnected(true);
          break;
        case 'PEER_LEFT':
          setPeerCount(msg.peerCount);
          break;
        case 'ORDER_SUBMITTED':
          // Only add if it's from a different wallet
          if (msg.data.walletAddress !== walletAddress) {
            setCounterpartyOrders((prev) => [...prev, msg.data]);
          }
          break;
        case 'MATCH_CONFIRMED':
          setMatchEvent({ type: 'confirmed', blockHeight: msg.blockHeight, by: msg.by });
          break;
        case 'MATCH_ATTEMPTED':
          setMatchEvent({ type: 'attempted', by: msg.by });
          break;
      }
    });

    client.connect();

    // Check connection state periodically
    const interval = setInterval(() => {
      setIsConnected(client.isConnected);
    }, 2000);

    return () => {
      unsub();
      clearInterval(interval);
      client.disconnect();
      clientRef.current = null;
    };
  }, [walletAddress]);

  // Join room when contract address and wallet are available
  useEffect(() => {
    if (contractAddress && walletAddress && clientRef.current) {
      clientRef.current.join(contractAddress, walletAddress);
    }
  }, [contractAddress, walletAddress]);

  const publishOrder = useCallback((data: RelayOrderData) => {
    clientRef.current?.publishOrder(data);
  }, []);

  const publishMatchAttempt = useCallback((addr: string) => {
    clientRef.current?.publishMatchAttempt(addr);
  }, []);

  const publishMatchConfirmed = useCallback((blockHeight: number, addr: string) => {
    clientRef.current?.publishMatchConfirmed(blockHeight, addr);
  }, []);

  const publishMatchFailed = useCallback((reason: string, addr: string) => {
    clientRef.current?.publishMatchFailed(reason, addr);
  }, []);

  return {
    peerCount,
    counterpartyOrders,
    isConnected,
    matchEvent,
    publishOrder,
    publishMatchAttempt,
    publishMatchConfirmed,
    publishMatchFailed,
  };
}
