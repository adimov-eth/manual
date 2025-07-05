// src/index.ts
import { broadcastTx, tick } from './runtime';

// Gossip two messages
broadcastTx('first message',  '0x01');
broadcastTx('second message', '0x02');

let seen = new Set<number>();

// Every 50 ms, advance and log new frames
const handle = setInterval(() => {
  const frame = tick(50);
  if (!seen.has(frame.height)) {
    console.log(`Frame #${frame.height}:`, frame.txs.map(t => t.text));
    seen.add(frame.height);
  }
  // stop once we hit height 1
  if (frame.height >= 1) clearInterval(handle);
}, 50);
