// test/step.spec.ts ----------------------------------------------
import { expect, test } from "bun:test";
import { v4 as uuid } from "uuid";
import { boot, step, type World } from "../src/runtime";
import type { ChatTx } from "../src/types";

const makeTx = (from: string, text: string): ChatTx => ({
  id: uuid(), from: from as any, text
});

test("two txs land in Frame #1", () => {
  let w: World = {
    t:     0,
    state: { replicas: boot() },
    queue: []
  };

  // inject two txs at t=0 (gossiped to all replicas)
  ["first", "second"].forEach(txt => {
    for (const key of w.state.replicas.keys()) {
      w.queue.push({ at: 0, key, cmd: { t: "ADD_TX", tx: makeTx("0x01", txt) } });
    }
  });
  // proposer trigger
  w.queue.push({ at: 0, key: "demo:0x00", cmd: { t: "PROPOSE" } });

  // run until nothing left in queue
  while (w.queue.length) {
    w = step(w, w.t + 1);   // advance 1 ms per iteration
  }

  const view = w.state.replicas.get("demo:0x00")!;
  expect(view.last.height).toBe(1);
  expect(view.last.txs.map(t => t.text)).toEqual(["first", "second"]);
});
