import { createPublicClient, createWalletClient, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { seismicDevnet2 } from "seismic-viem";

const TARGET_ADDRESS = "0x97c6BC04c4E3d762890A6dfD4cD181e43169471e";

async function main() {
  const privateKey = process.argv[2];

  if (!privateKey) {
    console.error("Usage: bun run scripts/check-nonce.ts <private-key>");
    console.error("Example: bun run scripts/check-nonce.ts 0x...");
    process.exit(1);
  }

  // Derive address from private key
  const account = privateKeyToAccount(
    privateKey.startsWith("0x") ? (privateKey as `0x${string}`) : (`0x${privateKey}` as `0x${string}`)
  );
  console.log("Derived address from private key:", account.address);

  // Create public client
  const client = createPublicClient({
    chain: seismicDevnet2,
    transport: http(),
  });

  // Get nonces at all available block tags
  const [latestNonce, pendingNonce, safeNonce, finalizedNonce] = await Promise.all([
    client.getTransactionCount({ address: TARGET_ADDRESS, blockTag: "latest" }),
    client.getTransactionCount({ address: TARGET_ADDRESS, blockTag: "pending" }),
    client.getTransactionCount({ address: TARGET_ADDRESS, blockTag: "safe" }).catch(() => null),
    client.getTransactionCount({ address: TARGET_ADDRESS, blockTag: "finalized" }).catch(() => null),
  ]);

  console.log(`\nNonce check for ${TARGET_ADDRESS}:`);
  console.log(`  latest:    ${latestNonce}`);
  console.log(`  pending:   ${pendingNonce}`);
  console.log(`  safe:      ${safeNonce ?? "N/A"}`);
  console.log(`  finalized: ${finalizedNonce ?? "N/A"}`);

  // Check if all nonces are equal
  const nonces = [latestNonce, pendingNonce, safeNonce, finalizedNonce].filter((n) => n !== null);
  const allEqual = nonces.every((n) => n === nonces[0]);

  console.log(`\n  All equal? ${allEqual ? "YES" : "NO"}`);

  if (!allEqual) {
    if (pendingNonce !== latestNonce) {
      console.log(`  Pending txs in mempool: ${pendingNonce - latestNonce}`);
    }
    if (safeNonce !== null && safeNonce !== latestNonce) {
      console.log(`  Txs not yet safe: ${latestNonce - safeNonce}`);
    }
    if (finalizedNonce !== null && finalizedNonce !== latestNonce) {
      console.log(`  Txs not yet finalized: ${latestNonce - finalizedNonce}`);
    }
  }

  // Create wallet client and send 0.001 ETH to itself
  const walletClient = createWalletClient({
    account,
    chain: seismicDevnet2,
    transport: http(),
  });

  console.log(`\nSending 0.001 ETH from ${account.address} to itself...`);
  const hash = await walletClient.sendTransaction({
    to: account.address,
    value: parseEther("0.001"),
  });

  console.log(`Transaction sent! Hash: ${hash}`);
  console.log("Waiting for confirmation...");

  const receipt = await client.waitForTransactionReceipt({ hash });
  console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
}

main().catch(console.error);
