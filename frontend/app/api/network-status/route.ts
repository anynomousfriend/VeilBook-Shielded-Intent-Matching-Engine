import { NextResponse } from 'next/server';

export async function GET() {
  const status = {
    proofServer: 'down',
    node: 'unknown',
    indexer: 'unknown'
  };

  try {
    // Check local proof server
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    
    // The proof server is a JSON RPC server on port 6300.
    // Sending a simple GET request will usually return a 404 or 405, but it proves the server is up.
    // Or we can send a valid JSON RPC request. 
    // Just connecting is enough to say it's 'up'
    const psRes = await fetch('http://127.0.0.1:6300', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "health_check" }),
      signal: controller.signal
    }).catch(e => {
        if (e.name !== 'AbortError') throw e;
        return null;
    });

    clearTimeout(timeoutId);
    
    if (psRes) {
        status.proofServer = 'up';
    }
  } catch (error) {
    console.error('Proof server check failed:', error);
    status.proofServer = 'down';
  }

  return NextResponse.json(status);
}
