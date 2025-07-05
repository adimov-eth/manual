import { serverReduce } from './server';
import type { ChatTx, Cmd, Replica } from './types';

/** create five signer replicas for the same room */
export const boot = (): Map<string, Replica> => {
  const ids = Array.from({ length: 5 }, (_, i) => `0x0${i}` as const);
  return new Map(ids.map(a => [
    `demo:${a}`,
    { roomId: 'demo', last: { height: 0, txs: [] }, mempool: [], waiting: false }
  ]));
};

let state = { replicas: boot() };

export const tick = (inbox: [string, ChatTx][]) => {
  // wrap ChatTxs into ADD_TX cmds addressed to proposer 0x00
  const queued: { key: string; cmd: Cmd }[] = inbox.map(
      ([addr, tx]): { key: string; cmd: Cmd } => ({
        key: `demo:${addr}`,
        cmd: { t: 'ADD_TX', tx }
      })
    );

  // proposer always triggers PROPOSE next tick
  queued.push({ key: 'demo:0x00', cmd: { t: 'PROPOSE' } as const });

  const { next, outbox } = serverReduce(state, queued);
  // immediately feed outbox back (simulates zero‑latency network)
  const { next: final } = serverReduce(next, outbox);

  state = final;

  // show the agreed chat log (same on every replica)
  const sample = final.replicas.get('demo:0x00')!;
  console.log(`Frame #${sample.last.height}:`, sample.last.txs.map(t => t.text));
};
