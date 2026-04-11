const { Web3 } = require('@theqrl/web3');
const web3 = new Web3(process.env.RPC_URL || "https://qrlwallet.com/api/qrl-rpc/testnet");

(async () => {
    try {
        const account = web3.zond.accounts.create();
        console.log("Testing with unauthorized account:", account.address);
        const devAccount = web3.zond.accounts.seedToAccount("0xcf54ce1dbaa39f1e80fb0c03a9cf88968054fd5f6ea35d1528809f942d4ac4a9b09d735d25e322b0051f97eb5c529ab5");
        
        let nonce = await web3.zond.getTransactionCount(devAccount.address, "latest");
        const fundTx = await devAccount.signTransaction({
            to: account.address,
            value: "1000000000000000000",
            gasLimit: 21000,
            nonce: Number(nonce),
            chainId: 32382
        });
        await web3.zond.sendSignedTransaction(fundTx.rawTransaction);
        
        console.log("Funded");
        
        const to = "0xb22ae7227e7f77341908bf4e2ec8039603d33f11";    
        const data = "0x883c84c100000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000067da504b00000000000000000000000000000000000000000000000000000000000000215468697320697320612074657374206d61726b65742066726f6d2066726f6e74656e640000000000000000000000000000000000000000000000000000000000";
        
        const nonceU = await web3.zond.getTransactionCount(account.address, "latest");
        const txObj = {
            from: account.address,
            to,
            data,
            gas: 5000000,
            nonce: Number(nonceU),
            chainId: 32382
        };
        const stx = await account.signTransaction(txObj);
        console.log("Sending tx...");
        const tx = await web3.zond.sendSignedTransaction(stx.rawTransaction);
        console.log("Success:", tx.transactionHash);
    } catch (e) {
        console.log("Error testing unauth:", e.message);
    }
})();