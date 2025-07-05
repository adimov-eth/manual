import { entityReduce } from './entity';
import type { Cmd, Frame, Replica } from './types';

export interface ServerState {
  replicas: Map<string, Replica>;   // key = roomId:signer
}

export const serverReduce = (
  prev: ServerState,
  inbox: { key: string; cmd: Cmd }[]
): { next: ServerState; outbox: { key: string; cmd: Cmd }[] } => {

  const replicas = new Map(prev.replicas);
  const outbox: { key: string; cmd: Cmd }[] = [];

  const enqueue = (key: string, cmd: Cmd) => outbox.push({ key, cmd });

  for (const { key, cmd } of inbox) {
    if (cmd.t === 'IMPORT') {
      replicas.set(key, cmd.replica);
      continue;
    }

    const rep = replicas.get(key);
    if (!rep) continue;

    const updated = entityReduce(rep, cmd);
    replicas.set(key, updated);

    // deterministic follow‑ups (mocked – everyone ACKs in next tick)
    if (cmd.t === 'PROPOSE') {
      const frame: Frame = {
        height: rep.last.height + 1,
        txs: rep.mempool
      };
      // broadcast COMMIT directly (skips ACK round)
      replicas.forEach((replica, key) =>
        enqueue(key, { t: 'COMMIT', frame })
      );
    }
  }

  return { next: { replicas }, outbox };
};
