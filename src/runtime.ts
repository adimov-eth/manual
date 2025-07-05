import { v4 as uuid } from 'uuid';
import { type ServerState, serverReduce } from './server';
import type { ChatTx, Cmd, Frame, Replica } from './types';

export const boot = (n = 5): Map<string, Replica> => {
  const replicas = new Map<string, Replica>();
  const genesis: Frame = { height: 0, txs: [] };
  for (let i = 0; i < n; i++) {
    const id = `0x0${i}` as const;
    const key = `demo:${id}`;
    replicas.set(key, {
      roomId: 'demo',
      id,
      last: genesis,
      mempool: [],
      acks: new Map(),
      pending: new Map(),
      proposed: new Set()
    });
  }
  return replicas;
};


export interface Envelope {
  at: number;
  key: string;
  cmd: Cmd;
}

export interface World {
  t: number;
  state: ServerState;
  queue: Envelope[];
}

const partition = <T>(
  arr: T[],
  pred: (x: T) => boolean
): [T[], T[]] => {
  const left: T[]  = [];
  const right: T[] = [];
  for (const item of arr) (pred(item) ? left : right).push(item);
  return [left, right];
};

export const step = (w: World, now: number): World => {
  const [due, future] = partition(w.queue, e => e.at <= now);
  const { next, outbox } = serverReduce(
    w.state,
    due.map(e => ({ key: e.key, cmd: e.cmd }))
  );
  const lat = 20;
  const scheduled = outbox.map(e => ({ at: now + lat, key: e.key, cmd: e.cmd }));
  return { t: now, state: next, queue: future.concat(scheduled) };
};


let world: World;

export const resetWorld = (n = 5) => {
  const now = 0;
  world = { t: now, state: { replicas: boot(n) }, queue: [] };
};

resetWorld(); // initialise once on import
// ────────────────────────────────────────────────────────────

// util
const idx = (id: string) => parseInt(id.slice(2), 16);
const proposerFor = (h: number, n: number) => h % n;

// internal scheduler
const scheduleProposals = () => {
  const total = world.state.replicas.size;
  for (const [key, r] of world.state.replicas) {
    const h = r.last.height + 1;
    if (
      proposerFor(h, total) === idx(r.id) &&
      r.mempool.length &&
      !r.proposed.has(h)
    ) {
      const frame = { height: h, txs: r.mempool };
      world.queue.push({ at: world.t, key, cmd: { t: 'PROPOSE', frame } });
    }
  }
};

// PUBLIC: inject a chat message (gossip to every replica)
export const broadcastTx = (text: string, from: string) => {
  const tx: ChatTx = { id: uuid(), from: from as any, text };
  for (const key of world.state.replicas.keys()) {
    world.queue.push({ at: world.t, key, cmd: { t: 'ADD_TX', tx } });
  }
};

/**
 * Advance the world by `tickDuration` ms,
 * schedule any pending proposals, apply one step,
 * and return the newly committed Frame for the default proposer (0x00).
 */
export const tick = (tickDuration = 1): Frame => {
  world.t += tickDuration;
  scheduleProposals();
  world = step(world, world.t);
  // return the last committed frame for replica "demo:0x00"
  return world.state.replicas.get(`demo:0x00` as const)!.last;
};

// PUBLIC accessor used in tests
export const getReplica = (addr = '0x00') =>
  world.state.replicas.get(`demo:${addr}`)!;
