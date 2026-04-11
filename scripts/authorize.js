const { Web3 } = require("@theqrl/web3");
const fs = require("fs");
const path = require("path");

async function main() {
  const web3 = new Web3(process.env.RPC_URL || "https://qrlwallet.com/api/qrl-rpc/testnet");
  const hexseed = process.env.HEXSEED || "0x0100005290731d5827bab3001398170c4fd044a4fa65829bbd3ef0d353d75dca83b6f972a12df64d80116a6d839f84a660cfb0";
  const account = web3.qrl.accounts.seedToAccount(hexseed);
  web3.qrl.accounts.wallet.add(account);

  const deployment = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployment.json"), "utf8"));
  const factoryAddr = deployment.contracts.MarketFactory;
  const abi = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "artifacts", "MarketFactory.json"), "utf8")).abi;
  const contract = new web3.qrl.Contract(abi, factoryAddr);

  // Q-prefix version of the user address
  const userAddress = "Qc670e4e2d24dB18ee19710eb4eCe9Dd3794D5740";

  console.log(`Checking if ${userAddress} is market creator...`);
  const isCreator = await contract.methods.isMarketCreator(userAddress).call();
  console.log(`Result: ${isCreator}`);

  if (!isCreator) {
    console.log(`Authorizing ${userAddress}...`);
    const txMethod = contract.methods.setMarketCreator(userAddress, true);
    const data = txMethod.encodeABI();
    const gas = await txMethod.estimateGas({ from: account.address });
    const nonce = await web3.qrl.getTransactionCount(account.address, "latest");
    const maxFee = web3.utils.toPlanck("2", "shor");

    const txObj = {
      from: account.address,
      to: factoryAddr,
      data,
      gas: Math.ceil(Number(gas) * 1.5).toString(),
      maxFeePerGas: maxFee,
      maxPriorityFeePerGas: web3.utils.toPlanck("1", "shor"),
      nonce: nonce.toString(),
      value: "0"
    };

    const signed = await account.signTransaction(txObj);
    const receipt = await web3.qrl.sendSignedTransaction(signed.rawTransaction);
    console.log("Authorized successfully! Tx Hash:", receipt.transactionHash);
  } else {
    console.log("User is already authorized.");
  }
}
main().catch(console.error);
