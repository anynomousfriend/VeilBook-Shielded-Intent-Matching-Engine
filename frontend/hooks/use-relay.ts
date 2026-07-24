"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { RelayClient, type RelayMessage, type RelayOrderData } from '@/lib/relay-client';
import { createSession, type Session } from '@/lib/crypto';

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
  const sessionRef = useRef<Session | null>(null);
  const [peerCount, setPeerCount] = useState(0);
  const [counterpartyOrders, setCounterpartyOrders] = useState<RelayOrderData[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [matchEvent, setMatchEvent] = useState<UseRelayReturn['matchEvent']>(null);

  // Stable callback ref for external handler
  const onRelayMessageRef = useRef(onRelayMessage);
  useEffect(() => {
    onRelayMessageRef.current = onRelayMessage;
  }, [onRelayMessage]);

  // Initialize WebCrypto session once
  useEffect(() => {
    let cancelled = false;
    createSession().then((session) => {
      if (!cancelled) {
        sessionRef.current = session;
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
          if (msg.sender !== walletAddress) {
            try {
              const parsed = JSON.parse(msg.payload);
              if (parsed.commitment) {
                setCounterpartyOrders((prev) => [...prev, parsed as RelayOrderData]);
              }
            } catch {
              // ignore
            }
          }
          break;
        case 'MATCH_CONFIRMED': {
          let blockHeight = 0;
          try {
            const parsed = JSON.parse(msg.payload);
            blockHeight = parsed.blockHeight || 0;
          } catch {
            // ignore
          }
          setMatchEvent({ type: 'confirmed', blockHeight, by: msg.sender });
          break;
        }
        case 'MATCH_ATTEMPTED':
          setMatchEvent({ type: 'attempted', by: msg.sender });
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

  // Join room when contract address, wallet, and session are available
  useEffect(() => {
    if (contractAddress && walletAddress && clientRef.current && sessionRef.current) {
      clientRef.current.join(
        contractAddress,
        walletAddress,
        sessionRef.current.encryption.publicKeyJwk,
        sessionRef.current.signing.publicKeyJwk,
      );
    }
  }, [contractAddress, walletAddress]);

  const publishOrder = useCallback(
    (data: RelayOrderData) => {
      if (walletAddress && clientRef.current) {
        clientRef.current.publishEncryptedOrder(walletAddress, JSON.stringify(data));
      }
    },
    [walletAddress],
  );

  const publishMatchAttempt = useCallback(
    (addr: string) => {
      if (clientRef.current) {
        clientRef.current.publishMatchAttempt(addr, JSON.stringify({ sender: addr }));
      }
    },
    [],
  );

  const publishMatchConfirmed = useCallback(
    (blockHeight: number, addr: string) => {
      if (clientRef.current) {
        clientRef.current.publishMatchConfirmed(
          addr,
          JSON.stringify({ blockHeight, sender: addr }),
        );
      }
    },
    [],
  );

  const publishMatchFailed = useCallback(
    (reason: string, addr: string) => {
      if (clientRef.current) {
        clientRef.current.publishMatchFailed(
          addr,
          JSON.stringify({ reason, sender: addr }),
        );
      }
    },
    [],
  );

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
