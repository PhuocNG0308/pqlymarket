const { QrlProvider } = require("./qrl-provider");
const { Web3 } = require("@theqrl/web3");

async function main() {
  const web3 = new Web3(new QrlProvider(process.env.RPC_URL || "https://qrlwallet.com/api/qrl-rpc/testnet"));

  try {
    const blockNum = await web3.zond.getBlockNumber();
    console.log("Block number:", blockNum.toString());

    const chainId = await web3.zond.getChainId();
    console.log("Chain ID:", chainId.toString());

    // Test deployer account balance
    const HEXSEED = "0xcf54ce1dbaa39f1e80fb0c03a9cf88968054fd5f6ea35d1528809f942d4ac4a9b09d735d25e322b0051f97eb5c529ab5";
    const account = web3.zond.accounts.seedToAccount(HEXSEED);
    console.log("Deployer address:", account.address);

    const balance = await web3.zond.getBalance(account.address);
    console.log("Deployer balance:", web3.utils.fromWei(balance, "ether"), "QRL");
    
    // Test market creator balance
    const creatorAddr = "Z209CE2DB9e9Cb39d20e6f2A30A8599573aD1739b";
    const creatorBal = await web3.zond.getBalance(creatorAddr);
    console.log("Creator balance:", web3.utils.fromWei(creatorBal, "ether"), "QRL");
  } catch (e) {
    console.error("ERROR:", e.message);
    if (e.cause) console.error("Cause:", JSON.stringify(e.cause));
  }
}

main();
