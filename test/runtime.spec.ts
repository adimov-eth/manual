import { expect, test } from "bun:test";
import { v4 as uuid } from "uuid";
import { boot, tick } from "../src/runtime";
import type { ChatTx } from "../src/types";

test("tick processes two transactions into Frame #1", () => {
  // Reset state before each test by re-initializing replicas
  // Note: ensure runtime.ts exports `boot` and `tick`
  // and that `tick` uses the `state` set by `boot()`
  // For this test we only call `tick` once on fresh state.

  // Prepare two chat transactions
  const txs: ChatTx[] = [
    { id: uuid(), from: "0x01", text: "first message" },
    { id: uuid(), from: "0x02", text: "second message" }
  ];

  // Capture console.log output
  let output = "";
  const origLog = console.log;
  console.log = (msg: string, arr: string[]) => {
    output = `${msg} ${JSON.stringify(arr)}`;
  };

  // Initialize state
  boot();
  // Inject both transactions in one tick
  tick(
    txs.map((tx) => ["0x00" /* sender ID ignored by gossip */, tx] as [string, ChatTx])
  );

  // Restore console.log
  console.log = origLog;

  // Assert Frame #1 contains both messages
  expect(output).toBe(
    `Frame #1: [ "first message", "second message" ]`
  );
});
