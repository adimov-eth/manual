export type Hex = `0x${string}`;
export type Address = Hex;

export interface ChatTx {
  id: string;
  from: Address;
  text: string;
}

export interface Frame {
  height: number;
  txs: ChatTx[];
}

export interface Replica {
  roomId: string;
  id: Address;
  last: Frame;
  mempool: ChatTx[];
  acks: Map<number, Set<Address>>;
  pending: Map<number, Frame>;
  proposed: Set<number>;
}

export type Cmd =
  | { t: 'ADD_TX'; tx: ChatTx }
  | { t: 'PROPOSE'; frame: Frame }
  | { t: 'VOTE'; h: number; from: Address }
  | { t: 'COMMIT'; frame: Frame }
  | { t: 'IMPORT'; replica: Replica };
