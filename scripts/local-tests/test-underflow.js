const { Web3 } = require("@theqrl/web3");

async function main() {
  const web3 = new Web3(process.env.RPC_URL || "https://rpc.pqlymarket.com/");
  const hexseed = "0xcf54ce1dbaa39f1e80fb0c03a9cf88968054fd5f6ea35d1528809f942d4ac4a9b09d735d25e322b0051f97eb5c529ab5";
  const account = web3.zond.accounts.seedToAccount(hexseed);

  const to = "Zc6fe813f5eda9aa5fc88348eca238f07e41f64d2";
  const data = "0x883c84c100000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000069d26180000000000000000000000000000000000000000000000000000000000000001957696c6c2051524c20726561636820243220696e203474683f00000000000000";

  let txObj = {
    from: account.address, to, data,
    gas: "1822442",
    maxFeePerGas: "2000000000", maxPriorityFeePerGas: "1000000000",
    nonce: (await web3.zond.getTransactionCount(account.address, "latest"))
  };

  console.log("Testing with exact gas...");
  try {
     const signed = await account.signTransaction(txObj);
     await web3.zond.sendSignedTransaction(signed.rawTransaction);
     console.log("Success with exact gas");
  } catch(e) { console.dir(e, {depth: null}); }

  txObj.nonce = (await web3.zond.getTransactionCount(account.address, "latest"));
  txObj.gas = "4000000";
  console.log("\nTesting with very high gas...");
  try {
     const signed = await account.signTransaction(txObj);
     await web3.zond.sendSignedTransaction(signed.rawTransaction);
     console.log("Success with very high gas");
  } catch(e) { console.dir(e, {depth: null}); }

  txObj.nonce = (await web3.zond.getTransactionCount(account.address, "latest"));
  txObj.gas = "21000"; // intrinsic gas
  console.log("\nTesting with 21000 gas...");
  try {
     const signed = await account.signTransaction(txObj);
     await web3.zond.sendSignedTransaction(signed.rawTransaction);
     console.log("Success with 21000 gas");
  } catch(e) { console.log(e.message || e); }

  txObj.gas = "800000"; // mid-way gas
  console.log("\nTesting with 800000 gas...");
  try {
     const signed = await account.signTransaction(txObj);
     await web3.zond.sendSignedTransaction(signed.rawTransaction);
     console.log("Success with 800000 gas");
  } catch(e) { console.log(e.message || e); }
}
main();

