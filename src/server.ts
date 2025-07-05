import { entityReduce } from './entity';
import type { Address, Cmd, Replica } from './types';

export interface ServerState {
  replicas: Map<string, Replica>;
}

const quorum = (n: number) => Math.floor((2 * n) / 3) + 1;
const idx = (id: Address) => parseInt(id.slice(2), 16);
const proposerFor = (h: number, n: number) => h % n;

export const serverReduce = (
  prev: ServerState,
  inbox: { key: string; cmd: Cmd }[]
): { next: ServerState; outbox: { key: string; cmd: Cmd }[] } => {
  const replicas = new Map(prev.replicas);
  const out: { key: string; cmd: Cmd }[] = [];
  const total = replicas.size;

  const broadcast = (cmd: Cmd) => {
    for (const key of replicas.keys()) out.push({ key, cmd });
  };

  for (const { key, cmd } of inbox) {
    if (cmd.t === 'IMPORT') {
      replicas.set(key, cmd.replica);
      continue;
    }

    const rep = replicas.get(key);
    if (!rep) continue;

    const updated = entityReduce(rep, cmd);
    replicas.set(key, updated);

    if (cmd.t === 'PROPOSE') {
      for (const [k, r] of replicas)
        out.push({ key: k, cmd: { t: 'VOTE', h: cmd.frame.height, from: r.id } });
      continue;
    }

    if (cmd.t === 'VOTE' && idx(updated.id) === proposerFor(cmd.h, total)) {
      // count votes safely (default to 0 if none yet)
      const votes = updated.acks.get(cmd.h)?.size ?? 0;
      if (votes >= quorum(total)) {
        const frame = updated.pending.get(cmd.h);
        if (frame) broadcast({ t: 'COMMIT', frame });
      }
    }
  }

  return { next: { replicas }, outbox: out };
};
