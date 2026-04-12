const { Web3 } = require("@theqrl/web3");
async function main() {
  const web3 = new Web3(process.env.RPC_URL || "https://rpc.pqlymarket.com/");
  const hexseed = "0xcf54ce1dbaa39f1e80fb0c03a9cf88968054fd5f6ea35d1528809f942d4ac4a9b09d735d25e322b0051f97eb5c529ab5";
  const account = web3.zond.accounts.seedToAccount(hexseed);
  web3.zond.accounts.wallet.add(account);

  const to = "Zc6fe813f5eda9aa5fc88348eca238f07e41f64d2";
  const data = "0x883c84c100000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000069d26180000000000000000000000000000000000000000000000000000000000000001957696c6c2051524c20726561636820243220696e203474683f00000000000000";

  let gas = await web3.zond.estimateGas({ from: account.address, to, data });
  console.log("Real Estimated Gas:", gas);
  gas = BigInt("0x1bceea"); // User gas

  const txObj = {
    from: account.address,
    to,
    data,
    gas: gas.toString(),
    maxFeePerGas: "2000000000",
    maxPriorityFeePerGas: "1000000000",
    nonce: (await web3.zond.getTransactionCount(account.address, "latest")).toString(),
    value: "0"
  };

  const signed = await account.signTransaction(txObj);
  try {
     const receipt = await web3.zond.sendSignedTransaction(signed.rawTransaction);
     console.log("Tx Hash:", receipt.transactionHash);
  } catch(e) {
     console.error("Execution failed:", e.message);
  }
}
main();
