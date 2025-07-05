import type { ChatTx, Cmd, Frame, Replica } from './types';

const execFrame = (prev: Frame, txs: ChatTx[]): Frame => ({
  height: prev.height + 1,
  txs
});

export const entityReduce = (rep: Replica, cmd: Cmd): Replica => {
  switch (cmd.t) {
    case 'ADD_TX':
      return { ...rep, mempool: [...rep.mempool, cmd.tx] };

    case 'PROPOSE':
      if (rep.waiting || rep.mempool.length === 0) return rep;
      return {
        ...rep,
        waiting: true      // proposer starts waiting for ACKs
      };

    case 'ACK': {
      // in this stripped version we assume everyone always ACKs instantly
      return rep;         // real logic lives in server reducer
    }

    case 'COMMIT':
      return {
        ...rep,
        last:    cmd.frame,
        waiting: false,
        mempool: []
      };

    default:
      return rep;
  }
};
