/**
 * PQlymarket - Wallet Connection (Client-Side)
 * Uses EIP-6963 (Multi Injected Provider Discovery) to detect wallets.
 * Direct provider.request() pattern (like MyQRLWallet) - no ethers.js proxy.
 *
 * Architecture:
 *   - Reads: direct JSON-RPC to gqrl node (qrl_* prefix)
 *   - Writes: wallet extension provider.request() with prefix detection
 *   - ABI encode/decode: ethers.Interface (lightweight, no BrowserProvider)
 */

(function () {
  "use strict";

  var config = window.__PQLY_CONFIG__ || {};
  var currentAccount = null;          // 0x-prefixed account address
  var walletProvider = null;          // Raw EIP-1193 provider from extension
  var activeWalletInfo = null;        // { info, provider } from EIP-6963

  // Wallet method prefix: detected during connectToWallet().
  // "qrl_" for latest (default), "zond_" for v0.1.1 legacy.
  var walletMethodPrefix = "qrl_";

  // ---- Address Conversion ----

  function zondToEvm(addr) {
    if (typeof addr === "string" && (addr.startsWith("Z") || addr.startsWith("Q")) && addr.length === 41) {
      return "0x" + addr.substring(1);
    }
    return addr;
  }

  function evmToZond(addr) {
    if (typeof addr === "string" && addr.startsWith("0x") && addr.length === 42) {
      return "Q" + addr.substring(2);
    }
    return addr;
  }

  // ---- Direct RPC to gqrl ----

  function rpcCall(method, params) {
    var url = config.rpcUrl || "https://qrlwallet.com/api/qrl-rpc/testnet/";
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: method, params: params || [], id: Date.now() }),
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (j.error) throw new Error(j.error.message || "RPC error");
      return j.result;
    });
  }

  // ---- Read Helpers ----

  function getBalance(address) {
    return rpcCall("qrl_getBalance", [evmToZond(address), "latest"]);
  }

  function ethCall(to, data) {
    return rpcCall("qrl_call", [{ to: evmToZond(to), data: data }, "latest"]);
  }

  function estimateGas(txObj) {
    var params = {
      from: txObj.from ? evmToZond(txObj.from) : undefined,
      to: txObj.to ? evmToZond(txObj.to) : undefined,
      data: txObj.data,
      value: txObj.value || "0x0",
    };
    return rpcCall("qrl_estimateGas", [params]);
  }

  function getTransactionCount(address) {
    return rpcCall("qrl_getTransactionCount", [evmToZond(address), "latest"]);
  }

  function getTransactionReceipt(txHash) {
    return rpcCall("qrl_getTransactionReceipt", [txHash]);
  }

  // ---- Transaction Helpers ----

  async function buildTransaction(opts) {
    var tx = {
      from: opts.from || currentAccount,
      to: opts.to,
      data: opts.data || "0x",
      value: opts.value || "0x0",
      type: "0x2",
      chainId: "0x" + (config.chainId || 1337).toString(16),
    };

    try {
      var gasEstimate = await estimateGas(tx);
      var gas = Math.ceil(parseInt(gasEstimate, 16) * 4);
      tx.gas = "0x" + gas.toString(16);
    } catch (gasErr) {
      console.warn("[Wallet] Gas estimation failed:", gasErr);
      // Try to extract revert reason from the error
      var revertMsg = gasErr && (gasErr.message || gasErr.data || "");
      if (typeof revertMsg === "string" && revertMsg.toLowerCase().indexOf("revert") !== -1) {
        throw new Error("Transaction will revert: " + revertMsg);
      }
      // Try qrl_call to get the revert reason
      try {
        await ethCall(tx.to, tx.data);
      } catch (callErr) {
        var reason = callErr && (callErr.message || callErr.data || "Unknown reason");
        throw new Error("Transaction will revert: " + reason);
      }
      tx.gas = "0x3D0900";
    }

    try {
      var results = await Promise.all([
        rpcCall("qrl_getBlockByNumber", ["latest", false]),
        rpcCall("qrl_maxPriorityFeePerGas").catch(function () { return "0x3B9ACA00"; })
      ]);
      var block = results[0];
      var maxPriorityFee = results[1];
      var baseFee = block && block.baseFeePerGas ? parseInt(block.baseFeePerGas, 16) : 1000000000;
      var priorityFee = parseInt(maxPriorityFee, 16) || 1000000000;
      tx.maxPriorityFeePerGas = "0x" + priorityFee.toString(16);
      tx.maxFeePerGas = "0x" + (baseFee * 2 + priorityFee).toString(16);
    } catch (_e) {
      tx.maxPriorityFeePerGas = "0x3B9ACA00";
      tx.maxFeePerGas = "0x77359400";
    }

    try {
      tx.nonce = await getTransactionCount(tx.from);
    } catch (_e) {
      tx.nonce = "0x0";
    }

    return tx;
  }

  async function sendTransaction(opts) {
    if (!walletProvider) {
      await connect();
    }
    if (!walletProvider) {
      throw new Error("Wallet not connected");
    }

    var tx = await buildTransaction(opts);

    // Check if user has enough balance for gas + value
    try {
      var rawBal = await getBalance(tx.from);
      var balance = BigInt(rawBal);
      var gasLimit = BigInt(parseInt(tx.gas, 16));
      var maxFee = BigInt(parseInt(tx.maxFeePerGas, 16));
      var txValue = BigInt(parseInt(tx.value, 16) || 0);
      var maxCost = gasLimit * maxFee + txValue;

      if (balance < maxCost) {
        var balQrl = (Number(balance) / 1e18).toFixed(4);
        var costQrl = (Number(maxCost) / 1e18).toFixed(4);
        throw new Error(
          "Insufficient QRL balance. You have " + balQrl + " QRL but this transaction requires ~" + costQrl + " QRL. " +
          "Please claim QRL from the faucet first (click the faucet button in the top bar after connecting your wallet)."
        );
      }
    } catch (balErr) {
      // Re-throw our own insufficient balance error, swallow RPC errors
      if (balErr.message && balErr.message.indexOf("Insufficient QRL") !== -1) {
        throw balErr;
      }
      console.warn("[Wallet] Balance check failed, proceeding anyway:", balErr.message);
    }

    var walletTx = Object.assign({}, tx);
    walletTx.from = evmToZond(walletTx.from);
    walletTx.to = evmToZond(walletTx.to);

    var method = walletMethodPrefix + "sendTransaction";
    console.log("[Wallet] Sending tx via", method, walletTx);

    var txHash = await walletProvider.request({
      method: method,
      params: [walletTx],
    });

    return txHash;
  }

  async function waitForTransaction(txHash, maxAttempts, intervalMs) {
    maxAttempts = maxAttempts || 60;
    intervalMs = intervalMs || 3000;

    for (var i = 0; i < maxAttempts; i++) {
      try {
        var receipt = await getTransactionReceipt(txHash);
        if (receipt) {
          if (receipt.status === "0x0") {
            throw new Error("Transaction reverted");
          }
          return receipt;
        }
      } catch (e) {
        if (e.message === "Transaction reverted") throw e;
      }
      await new Promise(function (r) { setTimeout(r, intervalMs); });
    }
    throw new Error("Transaction confirmation timed out");
  }

  // ---- Contract Interaction ----

  async function readContract(contractName, method, args) {
    var resp = await fetch("/api/abi/" + contractName);
    var data = await resp.json();
    var address = config.contracts[contractName];
    if (!address) throw new Error("No address for contract: " + contractName);

    var iface = new ethers.Interface(data.abi);
    var calldata = iface.encodeFunctionData(method, args || []);
    var result = await ethCall(address, calldata);
    return iface.decodeFunctionResult(method, result);
  }

  async function writeContract(contractName, method, args, opts) {
    var resp = await fetch("/api/abi/" + contractName);
    var data = await resp.json();
    var address = config.contracts[contractName];
    if (!address) throw new Error("No address for contract: " + contractName);

    var iface = new ethers.Interface(data.abi);
    var calldata = iface.encodeFunctionData(method, args || []);

    var txHash = await sendTransaction({
      to: address,
      data: calldata,
      value: (opts && opts.value) || "0x0",
      from: currentAccount,
    });

    return {
      hash: txHash,
      wait: function () { return waitForTransaction(txHash); },
    };
  }

  async function writeContractAt(address, abi, method, args, opts) {
    var iface = new ethers.Interface(abi);
    var calldata = iface.encodeFunctionData(method, args || []);

    var txHash = await sendTransaction({
      to: address,
      data: calldata,
      value: (opts && opts.value) || "0x0",
      from: currentAccount,
    });

    return {
      hash: txHash,
      wait: function () { return waitForTransaction(txHash); },
    };
  }

  async function readContractAt(address, abi, method, args) {
    var iface = new ethers.Interface(abi);
    var calldata = iface.encodeFunctionData(method, args || []);
    var result = await ethCall(address, calldata);
    return iface.decodeFunctionResult(method, result);
  }

  // ---- QRL Wallet Detection ----

  function isZondWallet(walletDetail) {
    return walletDetail && walletDetail.info && walletDetail.info.rdns === "theqrl.org";
  }

  // ---- EIP-6963 Wallet Discovery ----

  var discoveredWallets = [];

  function startEIP6963Discovery() {
    window.addEventListener("eip6963:announceProvider", function (event) {
      var detail = event.detail;
      if (!detail || !detail.info || !detail.provider) return;
      var exists = discoveredWallets.some(function (w) {
        return w.info.uuid === detail.info.uuid;
      });
      if (!exists) {
        discoveredWallets.push({ info: detail.info, provider: detail.provider });
        console.log("[PQlyWallet] Discovered wallet:", detail.info.name, "rdns:", detail.info.rdns);
      }
    });
    window.dispatchEvent(new Event("eip6963:requestProvider"));
  }

  function getLegacyProvider() {
    if (typeof window.ethereum !== "undefined") {
      return {
        info: {
          uuid: "legacy-ethereum",
          name: window.ethereum.isMetaMask ? "MetaMask" : "Browser Wallet",
          icon: "",
          rdns: window.ethereum.isMetaMask ? "io.metamask" : "unknown",
        },
        provider: window.ethereum,
      };
    }
    return null;
  }

  function getAvailableWallets() {
    var wallets = discoveredWallets.slice();
    if (wallets.length === 0) {
      var legacy = getLegacyProvider();
      if (legacy) wallets.push(legacy);
    }
    wallets.sort(function (a, b) {
      var aIsQRL = a.info.rdns === "theqrl.org" ? 0 : 1;
      var bIsQRL = b.info.rdns === "theqrl.org" ? 0 : 1;
      return aIsQRL - bIsQRL;
    });
    return wallets;
  }

  // ---- Wallet Picker Modal ----

  function showWalletPicker() {
    var wallets = getAvailableWallets();
    console.log("[PQlyWallet] showWalletPicker: found", wallets.length, "wallet(s)");

    var overlay = document.getElementById("walletPickerOverlay");
    var list = document.getElementById("walletPickerList");
    if (!overlay || !list) return;
    list.innerHTML = "";

    if (wallets.length === 0) {
      var msg = document.createElement("div");
      msg.className = "p-6 text-center space-y-3";
      msg.innerHTML =
        '<span class="material-symbols-outlined text-4xl text-on-surface-variant">search_off</span>' +
        '<p class="text-sm font-bold text-on-surface">No wallets detected</p>' +
        '<p class="text-xs text-on-surface-variant leading-relaxed">' +
        'Install the <a href="https://chromewebstore.google.com/detail/qrl-web3-wallet" target="_blank" class="text-primary hover:underline font-bold">QRL Zond Web3 Wallet</a> ' +
        'or <a href="https://metamask.io" target="_blank" class="text-primary hover:underline font-bold">MetaMask</a> browser extension, then reload this page.' +
        "</p>";
      list.appendChild(msg);
      overlay.classList.remove("hidden");
      overlay.classList.add("flex");
      return;
    }

    wallets.forEach(function (w) {
      var btn = document.createElement("button");
      btn.className =
        "w-full flex items-center gap-4 p-4 bg-surface-container-highest hover:bg-primary/10 " +
        "transition-colors text-left group";

      var iconHTML = "";
      if (w.info.icon) {
        iconHTML = '<img src="' + escapeAttr(w.info.icon) + '" alt="" class="w-8 h-8 rounded" />';
      } else {
        iconHTML = '<span class="material-symbols-outlined text-3xl text-on-surface-variant">account_balance_wallet</span>';
      }

      var tagHTML = "";
      if (w.info.rdns === "theqrl.org") {
        tagHTML = '<span class="text-[9px] bg-primary/20 text-primary px-2 py-0.5 uppercase tracking-widest font-bold">Recommended</span>';
      }

      btn.innerHTML =
        iconHTML +
        '<div class="flex-1 min-w-0">' +
        '<div class="flex items-center gap-2">' +
        '<span class="text-sm font-bold text-on-surface group-hover:text-primary transition-colors">' + escapeHTML(w.info.name) + "</span>" +
        tagHTML +
        "</div>" +
        '<span class="text-[10px] text-on-surface-variant tracking-wide">' + escapeHTML(w.info.rdns || "") + "</span>" +
        "</div>" +
        '<span class="material-symbols-outlined text-on-surface-variant group-hover:text-primary text-lg transition-colors">chevron_right</span>';

      btn.addEventListener("click", function () {
        closeWalletPicker();
        connectToWallet(w);
      });

      list.appendChild(btn);
    });

    overlay.classList.remove("hidden");
    overlay.classList.add("flex");
  }

  function closeWalletPicker() {
    var overlay = document.getElementById("walletPickerOverlay");
    if (overlay) {
      overlay.classList.add("hidden");
      overlay.classList.remove("flex");
    }
    if (_pendingConnectResolve) {
      _pendingConnectResolve(null);
      _pendingConnectResolve = null;
    }
  }

  // ---- Connect / Disconnect ----

  function showWalletPrompt(onCancel) {
    var overlay = document.getElementById("walletPromptOverlay");
    if (overlay) {
      overlay.classList.remove("hidden");
      overlay.classList.add("flex");
    }
    var cancelBtn = document.getElementById("walletPromptCancel");
    var handler = function () {
      hideWalletPrompt();
      if (onCancel) onCancel();
    };
    if (cancelBtn) {
      cancelBtn.addEventListener("click", handler, { once: true });
    }
  }

  function hideWalletPrompt() {
    var overlay = document.getElementById("walletPromptOverlay");
    if (overlay) {
      overlay.classList.add("hidden");
      overlay.classList.remove("flex");
    }
  }

  /**
   * Health check strategy:
   *
   * The QRL extension uses a complex double-hop message pipeline:
   *   DApp → contentScript → serviceWorker → (back to) contentScript → RPC node
   *
   * This pipeline is fragile (breaks on extension reload, Edge quirks, etc.).
   * Instead of testing the full pipeline with provider.request(), we:
   *
   * 1. Verify the provider object exists and has request() (EIP-6963 discovery worked)
   * 2. Verify the RPC node is reachable via direct fetch (no extension needed)
   * 3. Quick-probe the extension pipeline (short timeout) — success = bonus, failure = OK
   *
   * The critical pipeline test happens naturally when requestAccounts is called.
   */
  async function _walletHealthCheck(rawProvider) {
    // Step 1: Verify provider has request method
    if (!rawProvider || typeof rawProvider.request !== "function") {
      throw new Error("Invalid wallet provider: missing request() method");
    }
    console.log("[Wallet] Health check step 1: provider.request exists ✓");

    // Step 2: Verify RPC node is reachable directly (no extension pipeline needed)
    try {
      var rpcResult = await Promise.race([
        rpcCall("qrl_chainId"),
        new Promise(function (_, reject) {
          setTimeout(function () { reject(new Error("RPC_TIMEOUT")); }, 5000);
        }),
      ]);
      console.log("[Wallet] Health check step 2: RPC node reachable, chainId =", rpcResult, "✓");
    } catch (rpcErr) {
      console.warn("[Wallet] Health check step 2: RPC node unreachable:", rpcErr.message);
      // Don't fail here — the extension might use its own configured RPC
    }

    // Step 3: Quick probe of extension pipeline (2s timeout, non-blocking)
    // Try qrl_ then zond_ prefix — whichever responds first wins
    var prefixes = [
      { prefix: "qrl_", method: "qrl_chainId" },
      { prefix: "zond_", method: "zond_chainId" },
    ];
    for (var i = 0; i < prefixes.length; i++) {
      try {
        var result = await Promise.race([
          rawProvider.request({ method: prefixes[i].method }),
          new Promise(function (_, reject) {
            setTimeout(function () { reject(new Error("PROBE_TIMEOUT")); }, 2000);
          }),
        ]);
        console.log("[Wallet] Health check step 3: extension pipeline works!", prefixes[i].method, "=", result, "✓");
        return prefixes[i].prefix;
      } catch (probeErr) {
        console.warn("[Wallet] Health check step 3: probe failed for", prefixes[i].method + ":", probeErr.message);
      }
    }

    // Pipeline probe failed, but provider exists. Default to qrl_ prefix
    // and let the actual requestAccounts call be the real test.
    console.warn("[Wallet] Health check: extension pipeline probe timed out. Proceeding with qrl_ prefix (requestAccounts will be the real test).");
    return "qrl_";
  }

  function _requestAccountsWithTimeout(rawProvider, method) {
    var PROMPT_DELAY_MS = 1500;
    var HARD_TIMEOUT_MS = 120000;
    return new Promise(function (resolve, reject) {
      var settled = false;
      function settle() { settled = true; hideWalletPrompt(); clearTimeout(promptTimerId); clearTimeout(hardTimerId); }

      var promptTimerId = setTimeout(function () {
        if (!settled) {
          showWalletPrompt(function () {
            if (!settled) { settle(); reject(new Error("WALLET_POPUP_TIMEOUT")); }
          });
        }
      }, PROMPT_DELAY_MS);

      var hardTimerId = setTimeout(function () {
        if (!settled) { settle(); reject(new Error("WALLET_POPUP_TIMEOUT")); }
      }, HARD_TIMEOUT_MS);

      rawProvider.request({ method: method })
        .then(function (result) {
          if (!settled) { settle(); resolve(result); }
        })
        .catch(function (err) {
          if (!settled) { settle(); reject(err); }
        });
    });
  }

  async function connectToWallet(walletDetail) {
    console.log("[PQlyWallet] connectToWallet:", walletDetail.info.name, "rdns:", walletDetail.info.rdns);

    var connectBtn = document.getElementById("connectWalletBtn");
    var originalBtnHTML = connectBtn ? connectBtn.innerHTML : "";
    if (connectBtn) {
      connectBtn.disabled = true;
      connectBtn.innerHTML =
        '<span class="material-symbols-outlined text-base animate-spin" style="font-variation-settings: \'FILL\' 1;">progress_activity</span>' +
        "Connecting...";
    }

    try {
      activeWalletInfo = walletDetail;

      if (isZondWallet(walletDetail)) {
        var detectedPrefix = await _walletHealthCheck(walletDetail.provider);
        console.log("[Wallet] Detected method prefix:", detectedPrefix);

        var rawAccounts;
        var requestAccountsMethod = detectedPrefix + "requestAccounts";
        try {
          rawAccounts = await _requestAccountsWithTimeout(walletDetail.provider, requestAccountsMethod);
          walletMethodPrefix = detectedPrefix;
          console.log("[Wallet] Using " + detectedPrefix + "* prefix, accounts:", rawAccounts);
        } catch (reqErr) {
          if (reqErr && reqErr.code === 4200 && /already pending/i.test(reqErr.message || "")) {
            console.warn("[Wallet] Request pending from previous attempt, retrying in 2s...");
            await new Promise(function (r) { setTimeout(r, 2000); });
            try {
              rawAccounts = await _requestAccountsWithTimeout(walletDetail.provider, requestAccountsMethod);
              walletMethodPrefix = detectedPrefix;
            } catch (retryErr) {
              throw new Error("Wallet connection failed: A previous request is still pending. Please open the wallet extension, approve or reject the pending request, then try again.");
            }
          } else if (reqErr.message === "WALLET_POPUP_TIMEOUT") {
            throw new Error("The wallet did not respond in time. Please click the QRL wallet icon in your browser toolbar, approve the connection, then try again.");
          } else {
            throw new Error("Wallet connection failed: " + (reqErr.message || reqErr));
          }
        }

        if (!rawAccounts || rawAccounts.length === 0) {
          showToast("No accounts found in wallet", "error");
          return null;
        }

        currentAccount = zondToEvm(rawAccounts[0]);
        walletProvider = walletDetail.provider;
        console.log("[Wallet] DApp connected, account:", currentAccount);

        var localChainId = "0x" + (config.chainId || 1337).toString(16);
        try {
          var currentChainId = await walletDetail.provider.request({ method: detectedPrefix + "chainId" });
          if (currentChainId !== localChainId) {
            await walletDetail.provider.request({
              method: "wallet_addQRLChain",
              params: [{
                chainId: localChainId,
                chainName: "QRL Zond Testnet",
                rpcUrls: [config.rpcUrl || "https://qrlwallet.com/api/qrl-rpc/testnet/"],
                nativeCurrency: { name: "Quanta", symbol: "QRL", decimals: 18 },
                blockExplorerUrls: [],
                iconUrls: [],
              }],
            });
            console.log("[Wallet] Local chain added/activated:", localChainId);
          } else {
            console.log("[Wallet] Already on correct chain:", localChainId);
          }
        } catch (chainErr) {
          console.warn("[Wallet] wallet_addQRLChain failed:", chainErr.message || chainErr);
          try {
            await walletDetail.provider.request({
              method: "wallet_switchQRLChain",
              params: [{ chainId: localChainId }],
            });
          } catch (switchErr) {
            console.warn("[Wallet] wallet_switchQRLChain also failed:", switchErr.message || switchErr);
          }
        }

      } else {
        var accounts = await walletDetail.provider.request({ method: "eth_requestAccounts" });

        if (!accounts || accounts.length === 0) {
          showToast("No accounts found in wallet", "error");
          return null;
        }

        currentAccount = accounts[0];
        walletProvider = walletDetail.provider;
        walletMethodPrefix = "eth_";

        var targetChainHex = "0x" + (config.chainId || 1337).toString(16);
        try {
          var currentEthChain = await walletDetail.provider.request({ method: "eth_chainId" });
          if (currentEthChain !== targetChainHex) {
            await walletDetail.provider.request({
              method: "wallet_switchEthereumChain",
              params: [{ chainId: targetChainHex }],
            });
            console.log("[Wallet] Switched Ethereum chain:", targetChainHex);
          } else {
            console.log("[Wallet] Already on correct Ethereum chain:", targetChainHex);
          }
        } catch (switchErr) {
          if (switchErr.code === 4902 || switchErr.code === -32603) {
            try {
              await walletDetail.provider.request({
                method: "wallet_addEthereumChain",
                params: [{
                  chainId: targetChainHex,
                  chainName: "QRL Zond Local",
                  rpcUrls: [config.rpcUrl],
                  nativeCurrency: { name: "QRL", symbol: "QRL", decimals: 18 },
                }],
              });
            } catch (_addErr) {
              console.warn("Could not add chain:", _addErr);
            }
          }
        }
      }

      try {
        localStorage.setItem("pqly_wallet_rdns", walletDetail.info.rdns);
        localStorage.setItem("pqly_wallet_prefix", walletMethodPrefix);
      } catch (_e) {}

      attachProviderListeners(walletDetail.provider, walletDetail);
      updateConnectedUI();
      showToast("Connected: " + shortenAddress(currentAccount), "success");

      if (_pendingConnectResolve) {
        _pendingConnectResolve(currentAccount);
        _pendingConnectResolve = null;
      }

      return currentAccount;
    } catch (err) {
      console.error("Wallet connection failed:", err);
      showToast("Connection failed: " + (err.message || "Unknown error"), "error");

      if (_pendingConnectResolve) {
        _pendingConnectResolve(null);
        _pendingConnectResolve = null;
      }

      return null;
    } finally {
      var cb = document.getElementById("connectWalletBtn");
      if (cb) {
        cb.disabled = false;
        if (originalBtnHTML) cb.innerHTML = originalBtnHTML;
      }
    }
  }

  function disconnectWallet() {
    currentAccount = null;
    walletProvider = null;
    activeWalletInfo = null;
    walletMethodPrefix = "qrl_";

    try {
      localStorage.removeItem("pqly_wallet_rdns");
      localStorage.removeItem("pqly_wallet_prefix");
    } catch (_e) {}

    updateDisconnectedUI();
    closeAccountMenu();
    showToast("Wallet disconnected", "info");
  }

  var _pendingConnectResolve = null;

  async function connect() {
    console.log("[PQlyWallet] connect() called, currentAccount:", currentAccount);
    if (currentAccount) return currentAccount;

    return new Promise(function (resolve) {
      _pendingConnectResolve = resolve;
      showWalletPicker();
    });
  }

  // ---- Provider Event Listeners ----

  function attachProviderListeners(rawProvider, walletDetail) {
    if (typeof rawProvider.on !== "function") return;

    rawProvider.on("accountsChanged", function (accounts) {
      if (!accounts || accounts.length === 0) {
        disconnectWallet();
      } else {
        currentAccount = isZondWallet(walletDetail) ? zondToEvm(accounts[0]) : accounts[0];
        walletProvider = rawProvider;
        updateConnectedUI();
      }
    });

    rawProvider.on("chainChanged", function () {
      window.location.reload();
    });
  }

  // ---- Auto-reconnect ----

  var _readyCallbacks = [];
  var _isReady = false;

  function markReady() {
    if (_isReady) return;
    _isReady = true;
    _readyCallbacks.forEach(function (cb) { cb(currentAccount); });
    _readyCallbacks = [];
  }

  function onReady(cb) {
    if (_isReady) {
      cb(currentAccount);
    } else {
      _readyCallbacks.push(cb);
    }
  }

  function tryAutoReconnect() {
    var lastRdns = null;
    try {
      lastRdns = localStorage.getItem("pqly_wallet_rdns");
      var savedPrefix = localStorage.getItem("pqly_wallet_prefix");
      if (savedPrefix === "qrl_" || savedPrefix === "zond_" || savedPrefix === "eth_") {
        walletMethodPrefix = savedPrefix;
      }
    } catch (_e) {}

    if (!lastRdns) {
      markReady();
      return;
    }

    var connectBtn = document.getElementById("connectWalletBtn");
    if (connectBtn) connectBtn.classList.add("hidden");

    setTimeout(function () {
      var wallets = getAvailableWallets();
      var match = wallets.find(function (w) {
        return w.info.rdns === lastRdns;
      });
      if (!match) {
        updateDisconnectedUI();
        markReady();
        return;
      }

      var accountsMethod = isZondWallet(match) ? walletMethodPrefix + "accounts" : "eth_accounts";

      var reconnectDone = false;
      var reconnectTimeout = setTimeout(function () {
        if (!reconnectDone) {
          reconnectDone = true;
          console.warn("[PQlyWallet] Auto-reconnect timed out");
          updateDisconnectedUI();
          markReady();
        }
      }, 3000);

      match.provider.request({ method: accountsMethod })
        .then(function (accounts) {
          if (reconnectDone) return;
          reconnectDone = true;
          clearTimeout(reconnectTimeout);

          if (accounts && accounts.length > 0) {
            var rawAddr = accounts[0];
            currentAccount = isZondWallet(match) ? zondToEvm(rawAddr) : rawAddr;
            activeWalletInfo = match;
            walletProvider = match.provider;
            attachProviderListeners(match.provider, match);
            updateConnectedUI();
            markReady();
          } else {
            updateDisconnectedUI();
            markReady();
          }
        })
        .catch(function (err) {
          if (reconnectDone) return;
          reconnectDone = true;
          clearTimeout(reconnectTimeout);
          console.warn("[PQlyWallet] Auto-reconnect failed:", err.message);
          updateDisconnectedUI();
          markReady();
        });
    }, 150);
  }

  // ---- UI Updates ----

  function shortenAddress(addr) {
    if (!addr) return "";
    if (addr.startsWith("Z") || addr.startsWith("Q")) {
      return addr.substring(0, 5) + "..." + addr.substring(addr.length - 4);
    }
    return addr.substring(0, 6) + "..." + addr.substring(addr.length - 4);
  }

  function updateConnectedUI() {
    var connectBtn = document.getElementById("connectWalletBtn");
    var connectedBtn = document.getElementById("connectedWalletBtn");
    var addrSpan = document.getElementById("walletAddress");
    var iconEl = document.getElementById("walletIcon");
    var menuName = document.getElementById("menuWalletName");

    if (connectBtn) connectBtn.classList.add("hidden");
    if (connectedBtn) connectedBtn.classList.remove("hidden");

    if (addrSpan) {
      addrSpan.textContent = shortenAddress(currentAccount);
    }
    if (iconEl && activeWalletInfo && activeWalletInfo.info.icon) {
      iconEl.src = activeWalletInfo.info.icon;
      iconEl.classList.remove("hidden");
    }
    if (menuName && activeWalletInfo) {
      menuName.textContent = activeWalletInfo.info.name;
    }

    if (typeof checkFaucetEligibility === "function") {
      checkFaucetEligibility();
    }
    if (typeof checkCreatorStatusForAccount === "function") {
      checkCreatorStatusForAccount(currentAccount);
    }

    fetchAndDisplayBalance();
  }

  async function fetchAndDisplayBalance() {
    var balanceEl = document.getElementById("walletBalance");
    if (!balanceEl || !currentAccount) return;
    try {
      var rawBal = await getBalance(currentAccount);
      var wei = BigInt(rawBal);
      var ether = Number(wei) / 1e18;
      balanceEl.textContent = ether.toLocaleString(undefined, { maximumFractionDigits: 2 }) + " QRL";
      balanceEl.classList.remove("hidden");
    } catch (e) {
      console.warn("Failed to fetch QRL balance:", e);
    }
  }

  function updateDisconnectedUI() {
    var connectBtn = document.getElementById("connectWalletBtn");
    var connectedBtn = document.getElementById("connectedWalletBtn");
    var iconEl = document.getElementById("walletIcon");
    var faucetBtn = document.getElementById("faucetClaimBtn");

    if (connectBtn) connectBtn.classList.remove("hidden");
    if (connectedBtn) connectedBtn.classList.add("hidden");
    if (iconEl) iconEl.classList.add("hidden");
    if (faucetBtn) { faucetBtn.classList.add("hidden"); faucetBtn.classList.remove("flex"); }

    var balanceEl = document.getElementById("walletBalance");
    if (balanceEl) { balanceEl.classList.add("hidden"); balanceEl.textContent = ""; }

    closeAccountMenu();
  }

  // ---- Account Dropdown Menu ----

  function toggleAccountMenu() {
    var menu = document.getElementById("accountMenu");
    if (!menu) return;
    menu.classList.toggle("hidden");
  }

  function closeAccountMenu() {
    var menu = document.getElementById("accountMenu");
    if (menu) menu.classList.add("hidden");
  }

  document.addEventListener("click", function (e) {
    var wrapper = document.getElementById("walletWrapper");
    var menu = document.getElementById("accountMenu");
    if (!wrapper || !menu) return;
    if (!wrapper.contains(e.target)) {
      menu.classList.add("hidden");
    }
  });

  // ---- Toast Notification ----

  function showToast(message, type) {
    var existing = document.querySelector(".toast");
    if (existing) existing.remove();

    var toast = document.createElement("div");
    toast.className = "toast";

    var bgClass =
      type === "error"
        ? "bg-error-container text-on-error-container"
        : type === "success"
          ? "bg-primary text-on-primary"
          : "bg-surface-container-highest text-on-surface";

    toast.innerHTML =
      '<div class="' + bgClass + ' px-6 py-3 rounded text-sm font-bold shadow-2xl">' +
      escapeHTML(message) +
      "</div>";
    document.body.appendChild(toast);

    requestAnimationFrame(function () {
      toast.classList.add("show");
    });

    setTimeout(function () {
      toast.classList.remove("show");
      setTimeout(function () { toast.remove(); }, 300);
    }, 3000);
  }

  // ---- Utilities ----

  function escapeHTML(str) {
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // ---- Initialize ----

  startEIP6963Discovery();
  tryAutoReconnect();

  // ---- Public API ----

  window.PQlyWallet = {
    connect: connect,
    disconnect: disconnectWallet,
    showPicker: showWalletPicker,
    closePicker: closeWalletPicker,
    toggleMenu: toggleAccountMenu,
    onReady: onReady,
    getAccount: function () { return currentAccount; },
    getWalletProvider: function () { return walletProvider; },
    readContract: readContract,
    writeContract: writeContract,
    readContractAt: readContractAt,
    writeContractAt: writeContractAt,
    sendTransaction: sendTransaction,
    waitForTransaction: waitForTransaction,
    rpcCall: rpcCall,
    getBalance: getBalance,
    ethCall: ethCall,
    zondToEvm: zondToEvm,
    evmToZond: evmToZond,
    refreshBalance: fetchAndDisplayBalance,
    showToast: showToast,
    getDiscoveredWallets: function () { return getAvailableWallets(); },
  };
})();
