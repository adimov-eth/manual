// Wire format types
export type Input = [number, string, Command]; // [signerIdx, entityId, cmd]

// Command types extending the existing Cmd pattern
export type Command = 
	| { type: "importEntity"; snapshot: unknown }
	| { type: "addTx"; tx: EntityTx }
	| { type: "proposeFrame"; header: FrameHeader }
	| { type: "signFrame"; sig: string }
	| { type: "commitFrame"; frame: CommittedFrame };

// Transaction and frame types
export type EntityTx = {
	kind: string;
	data: unknown;
	nonce: bigint;
	sig: string;
};

export type FrameHeader = {
	height: number;
	timestamp: bigint;
	proposer: string;
};

export type CommittedFrame = {
	header: FrameHeader;
	txs: EntityTx[];
};

// Server input structure
export type ServerInput = {
	inputId: string;
	frameId: number;
	timestamp: bigint;
	metaTxs: ServerMetaTx[];
	entityInputs: EntityInput[];
};

export type ServerMetaTx = {
	type: "importEntity";
	entityId: string;
	data: unknown;
};

export type EntityInput = {
	jurisdictionId: string;
	signerId: string;
	entityId: string;
	quorumProof: {
		quorumHash: string;
		quorumStructure: string;
	};
	entityTxs: EntityTx[];
	precommits: string[];
	proposedBlock: string;
	observedInbox: InboxMessage[];
	accountInputs: AccountInput[];
};

// Placeholder types for inbox and account functionality
export type InboxMessage = {
	from: string;
	to: string;
	data: unknown;
};

export type AccountInput = {
	accountId: string;
	data: unknown;
};

export function inputsToServerInput(
	inputs: Input[],
	signerIds: string[],
	frameId: number
): ServerInput {
	// Helper to map signer index to signerId
	const getSignerId = (signerIdx: number) => {
		if (signerIdx < 0 || signerIdx >= signerIds.length) {
			throw new Error(`Invalid signerIdx ${signerIdx}`);
		}
		return signerIds[signerIdx];
	};

	const serverInput: ServerInput = {
		inputId:
			typeof crypto !== "undefined" && crypto.randomUUID
				? crypto.randomUUID()
				: `input-${Date.now()}`,
		frameId: frameId,
		timestamp: BigInt(Date.now()),
		metaTxs: [],
		entityInputs: [],
	};

	for (const [signerIdx, entityId, cmd] of inputs) {
		const signerId = getSignerId(signerIdx);

		// Prepare base EntityInput structure with default/empty fields
		const baseEntityInput: EntityInput = {
			jurisdictionId: "0:0x0000000000000000000000000000000000000000", // TODO: set actual jurisdictionId if available
			signerId: signerId,
			entityId: entityId,
			quorumProof: { quorumHash: "", quorumStructure: "0x" }, // TODO: compute quorumHash
			entityTxs: [],
			precommits: [],
			proposedBlock: "", // TODO: compute proposedBlock hash when applicable
			observedInbox: [],
			accountInputs: [],
		};

		switch (cmd.type) {
			case "importEntity":
				// Network-wide command: add a ServerMetaTx
				serverInput.metaTxs.push({
					type: "importEntity",
					entityId: entityId,
					data: cmd.snapshot,
				});
				break;

			case "addTx":
				// Add the transaction to entityTxs
				baseEntityInput.entityTxs = [cmd.tx];
				serverInput.entityInputs.push(baseEntityInput);
				break;

			case "proposeFrame":
				// Proposer sends a new frame header
				// Leave entityTxs empty (transactions from mempool)
				serverInput.entityInputs.push(baseEntityInput);
				break;

			case "signFrame":
				// Signer provides a BLS signature for a proposed frame
				baseEntityInput.precommits = [cmd.sig];
				serverInput.entityInputs.push(baseEntityInput);
				break;

			case "commitFrame":
				// Finalize the frame: include all transactions
				baseEntityInput.entityTxs = [...cmd.frame.txs];
				serverInput.entityInputs.push(baseEntityInput);
				break;

			default:
				// Unknown command types
				console.warn(`Unhandled command type: ${(cmd as any).type}`);
				break;
		}
	}

	// TODO: Future improvement – batch multiple commands per (signerId, entityId) into one EntityInput
	return serverInput;
}