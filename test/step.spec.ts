// test/runtime.spec.ts
import { expect, test } from "bun:test";
import { broadcastTx, getReplica, resetWorld, tick } from "../src/runtime";

test("two transactions appear in Frame #1", () => {
  resetWorld();                        // fresh world

  broadcastTx("first message",  "0x01");
  broadcastTx("second message", "0x02");

  while (getReplica().last.height < 1) tick();

  const texts = getReplica().last.txs.map(t => t.text);
  expect(texts).toEqual(["first message", "second message"]);
});
