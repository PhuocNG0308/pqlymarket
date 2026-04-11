const { Web3 } = require('@theqrl/web3');
const web3 = new Web3(process.env.RPC_URL || 'https://qrlwallet.com/api/qrl-rpc/testnet');
(async () => {
    try {
        const account = web3.qrl.accounts.create();
        console.log("Estimating from", account.address);
        const gas = await web3.qrl.estimateGas({
            from: account.address,
            to: 'Qb22ae7227e7f77341908bf4e2ec8039603d33f11',
            data: '0x883c84c100000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000067da504b00000000000000000000000000000000000000000000000000000000000000215468697320697320612074657374206d61726b65742066726f6d2066726f6e74656e640000000000000000000000000000000000000000000000000000000000'
        });
        console.log("Gas:", gas);
    } catch(e) { console.log("ERROR:", e.message); }
})();
