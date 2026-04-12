/**
 * Minimal test: send a simple QRL transfer to verify transaction format
 */
const { Web3 } = require("@theqrl/web3");

async function main() {
  // go-zond:stable natively speaks zond_* with Z-prefix — no provider wrapper needed
  const web3 = new Web3(process.env.RPC_URL || "https://rpc.pqlymarket.com/");

  const HEXSEED =
    "0xcf54ce1dbaa39f1e80fb0c03a9cf88968054fd5f6ea35d1528809f942d4ac4a9b09d735d25e322b0051f97eb5c529ab5";
  const account = web3.zond.accounts.seedToAccount(HEXSEED);
  web3.zond.accounts.wallet.add(account);
  console.log("Account:", account.address);

  // First check the nonce
  const nonce = await web3.zond.getTransactionCount(account.address);
  console.log("Nonce:", nonce.toString());

  // Check balance
  const balance = await web3.zond.getBalance(account.address);
  console.log("Balance:", web3.utils.fromWei(balance, "ether"), "QRL");

  // Try a simple self-transfer to test transaction format
  console.log("\nSending 1 QRL to self...");
  try {
    const tx = await web3.zond.sendTransaction({
      from: account.address,
      to: account.address,
      value: web3.utils.toWei("1", "ether"),
      gas: "21000",
    });
    console.log("TX Hash:", tx.transactionHash);
    console.log("Block:", tx.blockNumber?.toString());
    console.log("SUCCESS!");
  } catch (e) {
    console.error("FAILED:", e.message);
    if (e.innerError) console.error("Inner:", JSON.stringify(e.innerError));
  }
}

main().catch(console.error);
