const { Web3 } = require("@theqrl/web3");

async function main() {
  const web3 = new Web3(process.env.RPC_URL || "https://qrlwallet.com/api/qrl-rpc/testnet");
  const hexseed = "0xcf54ce1dbaa39f1e80fb0c03a9cf88968054fd5f6ea35d1528809f942d4ac4a9b09d735d25e322b0051f97eb5c529ab5";
  const account = web3.zond.accounts.seedToAccount(hexseed);
  web3.zond.accounts.wallet.add(account);

  const txObj = {
    from: account.address,
    to: "Zc6fe813f5eda9aa5fc88348eca238f07e41f64d2",
    data: "0x883c84c100000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000069d26180000000000000000000000000000000000000000000000000000000000000001957696c6c2051524c20726561636820243220696e203474683f00000000000000",
    gas: "0x1bceea",
    maxFeePerGas: "0x77359400",
    maxPriorityFeePerGas: "0x3b9aca00",
    nonce: "0x1"
  };

  try {
    const signed = await account.signTransaction(txObj);
    console.log("Signed OK:", !!signed.rawTransaction);
  } catch(e) { 
    console.error("Error formatting hex params:", e.message); 
  }
}
main();
