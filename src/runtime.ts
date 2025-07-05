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
  // ❶ PREPARE an empty queue with the correct element type up front
  const queued: { key: string; cmd: Cmd }[] = [];

  // ❷ GOSSIP each new ChatTx to every replica
  for (const [, tx] of inbox) {
    for (const key of state.replicas.keys()) {
      queued.push({ key, cmd: { t: 'ADD_TX', tx } });
    }
  }

  // ❸ Always let replica 0x00 propose in this toy model
  queued.push({ key: 'demo:0x00', cmd: { t: 'PROPOSE' } });

  const { next, outbox } = serverReduce(state, queued);
  const { next: final }  = serverReduce(next, outbox);  // feedback loop

  state = final;

  const view = final.replicas.get('demo:0x00')!;
  console.log(`Frame #${view.last.height}:`, view.last.txs.map(t => t.text));
};
