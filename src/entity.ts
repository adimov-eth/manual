import type { Cmd, Replica } from './types';

export const entityReduce = (rep: Replica, cmd: Cmd): Replica => {
  switch (cmd.t) {
    case 'ADD_TX':
      return { ...rep, mempool: [...rep.mempool, cmd.tx] };

    case 'PROPOSE': {
      const pending = new Map(rep.pending);
      pending.set(cmd.frame.height, cmd.frame);
      const proposed = new Set(rep.proposed).add(cmd.frame.height);
      return { ...rep, pending, proposed };
    }

    case 'VOTE': {
      const acks = new Map(rep.acks);
      const set = new Set(acks.get(cmd.h) ?? []).add(cmd.from);
      acks.set(cmd.h, set);
      return { ...rep, acks };
    }

    case 'COMMIT': {
      const remaining = rep.mempool.filter(
        tx => !cmd.frame.txs.some(t => t.id === tx.id)
      );
      const pending = new Map(rep.pending);
      pending.delete(cmd.frame.height);
      const acks = new Map(rep.acks);
      acks.delete(cmd.frame.height);
      return { ...rep, last: cmd.frame, mempool: remaining, pending, acks };
    }

    case 'IMPORT':
      return cmd.replica;
  }
};
