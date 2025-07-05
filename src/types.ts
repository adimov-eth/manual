export type Hex = `0x${string}`;

/** each “signer” in the quorum is just a hex address string */
export type Address = Hex;

export interface ChatTx {
  id: string;             // uuid() on the client – unique within room
  from: Address;
  text: string;
}

/** a committed batch of txs (a “frame”) */
export interface Frame {
  height: number;         // 0,1,2…
  txs:   ChatTx[];
}

/** replica‑local view of an Entity (chat room) */
export interface Replica {
  roomId:  string;
  last:    Frame;         // last committed frame
  mempool: ChatTx[];      // pending txs waiting to be proposed
  waiting: boolean;       // true while collecting acks
}

/** five command types – cryptography removed */
export type Cmd =
  | { t: 'ADD_TX';  tx: ChatTx }
  | { t: 'PROPOSE' }
  | { t: 'ACK';     frameH: string }
  | { t: 'COMMIT';  frame: Frame }
  | { t: 'IMPORT';  replica: Replica };


  export interface Envelope {
    at:  number;            // unix ms when this cmd should be delivered
    key: string;            // replica id
    cmd: Cmd;
  }
