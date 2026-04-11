const { Web3 } = require('@theqrl/web3');
const web3 = new Web3(process.env.RPC_URL || "https://qrlwallet.com/api/qrl-rpc/testnet");

(async () => {
    const hexseed = "0xcf54ce1dbaa39f1e80fb0c03a9cf88968054fd5f6ea35d1528809f942d4ac4a9b09d735d25e322b0051f97eb5c529ab5";
    const account = web3.qrl.accounts.seedToAccount(hexseed);
    // Use factory address from deploy test
    const to = "0xb22ae7227e7f77341908bf4e2ec8039603d33f11";    
    const data = "0x883c84c100000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000067da504b00000000000000000000000000000000000000000000000000000000000000215468697320697320612074657374206d61726b65742066726f6d2066726f6e74656e640000000000000000000000000000000000000000000000000000000000";
    
    try {
        const nonce = await web3.qrl.getTransactionCount(account.address, "latest");
        const txObj = {
            type: 2,
            from: account.address,
            to,
            data,
            gasLimit: 5000000,
            maxPriorityFeePerGas: "20000000",
            maxFeePerGas: "50000000",
            nonce: Number(nonce),
            chainId: 32382
        };
        
        const signed = await account.signTransaction(txObj);
        console.log("sending eip1559...");
        const tx = await web3.qrl.sendSignedTransaction(signed.rawTransaction);
        console.log("Success EIP1559:", tx.transactionHash);
    } catch (e) {
        console.log("Error EIP1559:", e);
    }
})();
