import { describe, expect, test } from "bun:test";
import {
	inputsToServerInput,
	type Input,
	type ServerInput,
	type EntityTx,
} from "../src/input.ts";

describe("inputsToServerInput", () => {
	const signerIds = [
		"0x1111111111111111111111111111111111111111",
		"0x2222222222222222222222222222222222222222",
		"0x3333333333333333333333333333333333333333",
	];

	test("converts addTx inputs correctly", () => {
		const testInputs: Input[] = [
			[
				0,
				"entityX",
				{
					type: "addTx",
					tx: {
						kind: "test",
						data: { value: 42 },
						nonce: 1n,
						sig: "0xaaaa",
					},
				},
			],
			[
				1,
				"entityY",
				{
					type: "addTx",
					tx: {
						kind: "test",
						data: { value: 99 },
						nonce: 2n,
						sig: "0xbbbb",
					},
				},
			],
		];

		const result = inputsToServerInput(testInputs, signerIds, 42);

		expect(result.frameId).toBe(42);
		expect(result.entityInputs).toHaveLength(2);
		expect(result.metaTxs).toHaveLength(0);

		// Check first entity input
		expect(result.entityInputs[0].signerId).toBe(signerIds[0]);
		expect(result.entityInputs[0].entityId).toBe("entityX");
		expect(result.entityInputs[0].entityTxs).toHaveLength(1);
		expect(result.entityInputs[0].entityTxs[0].data).toEqual({ value: 42 });

		// Check second entity input
		expect(result.entityInputs[1].signerId).toBe(signerIds[1]);
		expect(result.entityInputs[1].entityId).toBe("entityY");
		expect(result.entityInputs[1].entityTxs).toHaveLength(1);
		expect(result.entityInputs[1].entityTxs[0].data).toEqual({ value: 99 });
	});

	test("converts importEntity to metaTx", () => {
		const testInputs: Input[] = [
			[
				0,
				"newEntity",
				{
					type: "importEntity",
					snapshot: { state: "initial", version: 1 },
				},
			],
		];

		const result = inputsToServerInput(testInputs, signerIds, 1);

		expect(result.metaTxs).toHaveLength(1);
		expect(result.entityInputs).toHaveLength(0);
		expect(result.metaTxs[0].type).toBe("importEntity");
		expect(result.metaTxs[0].entityId).toBe("newEntity");
		expect(result.metaTxs[0].data).toEqual({ state: "initial", version: 1 });
	});

	test("handles proposeFrame command", () => {
		const testInputs: Input[] = [
			[
				2,
				"entityZ",
				{
					type: "proposeFrame",
					header: {
						height: 100,
						timestamp: 1234567890n,
						proposer: signerIds[2],
					},
				},
			],
		];

		const result = inputsToServerInput(testInputs, signerIds, 100);

		expect(result.entityInputs).toHaveLength(1);
		expect(result.entityInputs[0].signerId).toBe(signerIds[2]);
		expect(result.entityInputs[0].entityId).toBe("entityZ");
		expect(result.entityInputs[0].entityTxs).toHaveLength(0); // No txs in propose
		expect(result.entityInputs[0].precommits).toHaveLength(0);
	});

	test("handles signFrame command", () => {
		const testInputs: Input[] = [
			[
				1,
				"entityA",
				{
					type: "signFrame",
					sig: "0xBLSSignature123",
				},
			],
		];

		const result = inputsToServerInput(testInputs, signerIds, 50);

		expect(result.entityInputs).toHaveLength(1);
		expect(result.entityInputs[0].signerId).toBe(signerIds[1]);
		expect(result.entityInputs[0].precommits).toHaveLength(1);
		expect(result.entityInputs[0].precommits[0]).toBe("0xBLSSignature123");
		expect(result.entityInputs[0].entityTxs).toHaveLength(0);
	});

	test("handles commitFrame command", () => {
		const txs: EntityTx[] = [
			{ kind: "tx1", data: { a: 1 }, nonce: 1n, sig: "0xsig1" },
			{ kind: "tx2", data: { b: 2 }, nonce: 2n, sig: "0xsig2" },
		];

		const testInputs: Input[] = [
			[
				0,
				"entityB",
				{
					type: "commitFrame",
					frame: {
						header: {
							height: 200,
							timestamp: 9876543210n,
							proposer: signerIds[0],
						},
						txs: txs,
					},
				},
			],
		];

		const result = inputsToServerInput(testInputs, signerIds, 200);

		expect(result.entityInputs).toHaveLength(1);
		expect(result.entityInputs[0].entityTxs).toHaveLength(2);
		expect(result.entityInputs[0].entityTxs).toEqual(txs);
		expect(result.entityInputs[0].precommits).toHaveLength(0);
	});

	test("processes multiple mixed commands", () => {
		const testInputs: Input[] = [
			[
				0,
				"entity1",
				{ type: "addTx", tx: { kind: "test", data: {}, nonce: 1n, sig: "0x1" } },
			],
			[
				1,
				"entity2",
				{ type: "importEntity", snapshot: { initial: true } },
			],
			[
				2,
				"entity3",
				{ type: "signFrame", sig: "0xSig123" },
			],
		];

		const result = inputsToServerInput(testInputs, signerIds, 300);

		expect(result.entityInputs).toHaveLength(2); // addTx and signFrame
		expect(result.metaTxs).toHaveLength(1); // importEntity
		expect(result.entityInputs[0].entityId).toBe("entity1");
		expect(result.entityInputs[1].entityId).toBe("entity3");
		expect(result.metaTxs[0].entityId).toBe("entity2");
	});

	test("throws error for invalid signerIdx", () => {
		const testInputs: Input[] = [
			[
				5, // Invalid index
				"entity",
				{ type: "addTx", tx: { kind: "test", data: {}, nonce: 1n, sig: "0x1" } },
			],
		];

		expect(() => inputsToServerInput(testInputs, signerIds, 1)).toThrow(
			"Invalid signerIdx 5"
		);
	});

	test("generates unique inputId and timestamp", () => {
		const testInputs: Input[] = [
			[
				0,
				"entity",
				{ type: "addTx", tx: { kind: "test", data: {}, nonce: 1n, sig: "0x1" } },
			],
		];

		const result1 = inputsToServerInput(testInputs, signerIds, 1);
		const result2 = inputsToServerInput(testInputs, signerIds, 2);

		expect(result1.inputId).not.toBe(result2.inputId);
		expect(result1.timestamp).toBeGreaterThan(0n);
		expect(result2.timestamp).toBeGreaterThanOrEqual(result1.timestamp);
	});

	test("sets placeholder values for quorum and crypto fields", () => {
		const testInputs: Input[] = [
			[
				0,
				"entity",
				{ type: "addTx", tx: { kind: "test", data: {}, nonce: 1n, sig: "0x1" } },
			],
		];

		const result = inputsToServerInput(testInputs, signerIds, 1);

		expect(result.entityInputs[0].quorumProof.quorumHash).toBe("");
		expect(result.entityInputs[0].quorumProof.quorumStructure).toBe("0x");
		expect(result.entityInputs[0].proposedBlock).toBe("");
		expect(result.entityInputs[0].jurisdictionId).toBe(
			"0:0x0000000000000000000000000000000000000000"
		);
	});

	test("creates separate EntityInput for each command", () => {
		// Multiple commands from same signer and entity
		const testInputs: Input[] = [
			[
				0,
				"entityX",
				{ type: "addTx", tx: { kind: "tx1", data: {}, nonce: 1n, sig: "0x1" } },
			],
			[
				0,
				"entityX",
				{ type: "addTx", tx: { kind: "tx2", data: {}, nonce: 2n, sig: "0x2" } },
			],
			[
				0,
				"entityX",
				{ type: "signFrame", sig: "0xSig" },
			],
		];

		const result = inputsToServerInput(testInputs, signerIds, 1);

		// Should create 3 separate EntityInputs, not batch them
		expect(result.entityInputs).toHaveLength(3);
		expect(result.entityInputs[0].entityTxs[0].kind).toBe("tx1");
		expect(result.entityInputs[1].entityTxs[0].kind).toBe("tx2");
		expect(result.entityInputs[2].precommits[0]).toBe("0xSig");
	});
});