import { serverReduce, type ServerState } from './server';
import type { ChatTx, Cmd, Envelope, Replica } from './types';


export interface World {
  t:       number;                  // millis
  state:   ServerState;             // replicas + their local state
  queue:   Envelope[];              // pending network messages
}

function partition<T>(
  arr: T[],
  pred: (item: T) => boolean
): [T[], T[]] {
  const pass: T[] = [];
  const fail: T[] = [];
  for (const it of arr) {
    if (pred(it)) pass.push(it);
    else          fail.push(it);
  }
  return [pass, fail];
}

/** create five signer replicas for the same room */
export const boot = (): Map<string, Replica> => {
  const ids = Array.from({ length: 5 }, (_, i) => `0x0${i}` as const);
  return new Map(ids.map(a => [
    `demo:${a}`,
    { roomId: 'demo', last: { height: 0, txs: [] }, mempool: [], waiting: false }
  ]));
};

export const step = (w: World, now: number): World => {
  // ❶ deliver all messages whose time has come
  const [due, future] = partition(w.queue, e => e.at <= now);

  const { next, outbox } = serverReduce(
    w.state,
    due.map(e => ({ key: e.key, cmd: e.cmd }))
  );

  // ❷ schedule freshly produced cmds with +latency
  const latency = 30; // ms – tweak to simulate network
  const scheduled: Envelope[] = outbox.map(e => ({
    at:  now + latency,
    ...e
  }));

  return {
    t:     now,
    state: next,
    queue: future.concat(scheduled)
  };
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



const start = Date.now();
let world: World = {
  t:     start,
  state: { replicas: boot() },
  queue: []
};

export const sendTx = (tx: ChatTx) => {
  for (const key of world.state.replicas.keys()) {
    world.queue.push({
      at:  world.t,                // immediate delivery
      key,
      cmd: { t: "ADD_TX", tx }
    });
  }
};

export const loop = async () => {
  while (true) {
    const now = Date.now();
    world = step(world, now);

    // inspect one replica for demo
    const view = world.state.replicas.get("demo:0x00")!;
    console.log(`t=${now - start}ms | h=${view.last.height}`, view.last.txs);

    await Bun.sleep(50);           // game‑loop cadence
  }
};
