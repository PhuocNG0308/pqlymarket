/**
 * PQlymarket - Main Application Logic (Client-Side)
 * Handles UI interactions, market operations, and dynamic updates
 */

(function () {
  "use strict";

  // ---- Event Binding ----

  function init() {
    bindWalletButtons();
    bindMarketButtons();
    bindSearch();
    bindPortfolio();
    bindLeaderboard();
    bindCreateMarket();
    bindGovernance();
    checkCreatorStatus();
    bindMultiOutcomeMarket();
  }

  /**
   * Wallet connect buttons (portfolio page connect button)
   */
  function bindWalletButtons() {
    var portfolioConnectBtn = document.getElementById("portfolioConnectBtn");
    if (portfolioConnectBtn) {
      portfolioConnectBtn.addEventListener("click", async function () {
        var account = await PQlyWallet.connect();
        if (account) {
          document.getElementById("portfolioNoWallet").classList.add("hidden");
          document
            .getElementById("portfolioContent")
            .classList.remove("hidden");
          loadPortfolio(account);
        }
      });
    }
  }

  /**
   * Market buy buttons (Yes/No)
   */
  function bindMarketButtons() {
    // Featured market buttons
    document.querySelectorAll(".btn-yes, .btn-no").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var marketId = this.getAttribute("data-market-id");
        var side = this.classList.contains("btn-yes") ? "yes" : "no";
        handleBet(marketId, side);
      });
    });

    // Market detail buy buttons
    var buyYesBtn = document.querySelector(".btn-buy-yes");
    if (buyYesBtn) {
      buyYesBtn.addEventListener("click", function () {
        var marketId = this.getAttribute("data-market-id");
        var outcomeIndex = parseInt(this.getAttribute("data-outcome-index") || "0", 10);
        var amount = document.getElementById("yesAmount").value;
        if (!amount || parseFloat(amount) <= 0) {
          PQlyWallet.showToast("Enter a valid amount", "error");
          return;
        }
        executeBuy(marketId, true, amount, outcomeIndex);
      });
    }

    var buyNoBtn = document.querySelector(".btn-buy-no");
    if (buyNoBtn) {
      buyNoBtn.addEventListener("click", function () {
        var marketId = this.getAttribute("data-market-id");
        var outcomeIndex = parseInt(this.getAttribute("data-outcome-index") || "0", 10);
        var amount = document.getElementById("noAmount").value;
        if (!amount || parseFloat(amount) <= 0) {
          PQlyWallet.showToast("Enter a valid amount", "error");
          return;
        }
        executeBuy(marketId, false, amount, outcomeIndex);
      });
    }

    // Sell buttons
    var sellYesBtn = document.querySelector(".btn-sell-yes");
    if (sellYesBtn) {
      sellYesBtn.addEventListener("click", function () {
        var marketId = this.getAttribute("data-market-id");
        var outcomeIndex = parseInt(this.getAttribute("data-outcome-index") || "0", 10);
        var amount = document.getElementById("sellYesAmount").value;
        if (!amount || parseFloat(amount) <= 0) {
          PQlyWallet.showToast("Enter a valid amount", "error");
          return;
        }
        executeSell(marketId, true, amount, outcomeIndex);
      });
    }

    var sellNoBtn = document.querySelector(".btn-sell-no");
    if (sellNoBtn) {
      sellNoBtn.addEventListener("click", function () {
        var marketId = this.getAttribute("data-market-id");
        var outcomeIndex = parseInt(this.getAttribute("data-outcome-index") || "0", 10);
        var amount = document.getElementById("sellNoAmount").value;
        if (!amount || parseFloat(amount) <= 0) {
          PQlyWallet.showToast("Enter a valid amount", "error");
          return;
        }
        executeSell(marketId, false, amount, outcomeIndex);
      });
    }

    // Claim button
    var claimBtn = document.querySelector(".btn-claim");
    if (claimBtn) {
      claimBtn.addEventListener("click", function () {
        var marketId = this.getAttribute("data-market-id");
        executeClaim(marketId);
      });
    }

    // Load user shares on market detail page
    loadUserShares();

    // Real-time estimation for buy/sell inputs
    var anyMarketBtn = document.querySelector(".btn-buy-yes") || document.querySelector(".btn-sell-yes");
    if (anyMarketBtn) {
      var mid = parseInt(anyMarketBtn.getAttribute("data-market-id"), 10);
      fetchPoolReserves(mid).then(function () {
        bindEstimation(mid);
      });
    }
  }

  /**
   * Handle quick bet from featured/card
   */
  async function handleBet(marketId, side) {
    var account = PQlyWallet.getAccount();
    if (!account) {
      account = await PQlyWallet.connect();
      if (!account) return;
    }
    // Navigate to market detail for full buy flow
    window.location.href = "/market/" + marketId;
  }

  /**
   * Execute a buy transaction
   */
  async function executeBuy(marketId, isYes, amount, outcomeIndex) {
    var account = PQlyWallet.getAccount();
    if (!account) {
      account = await PQlyWallet.connect();
      if (!account) return;
    }

    // Default outcomeIndex to 0 for binary markets
    if (outcomeIndex === undefined || outcomeIndex === null) outcomeIndex = 0;

    try {
      PQlyWallet.showToast("Submitting transaction...", "info");

      // Get market address from factory
      var marketResult = await PQlyWallet.readContract("MarketFactory", "markets", [marketId]);
      var marketAddr = marketResult[0];

      // Get PredictionMarket ABI
      var resp = await fetch("/api/abi/PredictionMarket");
      var data = await resp.json();

      // Buy shares: buyShares(outcomeIndex, isYes, minShares)
      var value = "0x" + ethers.parseEther(amount).toString(16);
      var tx = await PQlyWallet.writeContractAt(marketAddr, data.abi, "buyShares", [outcomeIndex, isYes, 0], { value: value });

      PQlyWallet.showToast("Transaction sent. Waiting for confirmation...", "info");
      await tx.wait();
      PQlyWallet.showToast("Shares purchased successfully!", "success");

      // Reload page to update prices
      setTimeout(function () {
        window.location.reload();
      }, 1500);
    } catch (err) {
      console.error("Buy failed:", err);
      PQlyWallet.showToast(
        err.reason || err.message || "Transaction failed",
        "error"
      );
    }
  }

  /**
   * Execute a sell transaction
   */
  async function executeSell(marketId, isYes, sharesStr, outcomeIndex) {
    var account = PQlyWallet.getAccount();
    if (!account) {
      account = await PQlyWallet.connect();
      if (!account) return;
    }

    // Default outcomeIndex to 0 for binary markets
    if (outcomeIndex === undefined || outcomeIndex === null) outcomeIndex = 0;

    try {
      PQlyWallet.showToast("Submitting sell transaction...", "info");

      var marketResult = await PQlyWallet.readContract("MarketFactory", "markets", [marketId]);
      var marketAddr = marketResult[0];

      var resp = await fetch("/api/abi/PredictionMarket");
      var data = await resp.json();

      var shares = ethers.parseEther(sharesStr);
      // sellShares(outcomeIndex, isYes, shares, minPayout)
      var tx = await PQlyWallet.writeContractAt(marketAddr, data.abi, "sellShares", [outcomeIndex, isYes, shares, 0]);

      PQlyWallet.showToast("Sell transaction sent. Waiting...", "info");
      await tx.wait();
      PQlyWallet.showToast("Shares sold successfully!", "success");

      setTimeout(function () {
        window.location.reload();
      }, 1500);
    } catch (err) {
      console.error("Sell failed:", err);
      PQlyWallet.showToast(
        err.reason || err.message || "Sell transaction failed",
        "error"
      );
    }
  }

  /**
   * Execute claim winnings
   */
  async function executeClaim(marketId) {
    var account = PQlyWallet.getAccount();
    if (!account) {
      account = await PQlyWallet.connect();
      if (!account) return;
    }

    try {
      PQlyWallet.showToast("Claiming winnings...", "info");

      var marketResult = await PQlyWallet.readContract("MarketFactory", "markets", [marketId]);
      var marketAddr = marketResult[0];

      var resp = await fetch("/api/abi/PredictionMarket");
      var data = await resp.json();

      var tx = await PQlyWallet.writeContractAt(marketAddr, data.abi, "claimWinnings", []);
      PQlyWallet.showToast("Transaction sent. Waiting...", "info");
      await tx.wait();
      PQlyWallet.showToast("Winnings claimed!", "success");

      setTimeout(function () {
        window.location.reload();
      }, 1500);
    } catch (err) {
      console.error("Claim failed:", err);
      PQlyWallet.showToast(
        err.reason || err.message || "Claim failed",
        "error"
      );
    }
  }

  /**
   * Load user's share balances on market detail page
   */
  async function loadUserShares() {
    var yesEl = document.getElementById("userYesShares");
    var noEl = document.getElementById("userNoShares");
    if (!yesEl || !noEl) return;

    PQlyWallet.onReady(function (account) {
      if (account) loadUserSharesForAccount(account);
    });
  }

  async function loadUserSharesForAccount(account) {
    try {
      var config = window.__PQLY_CONFIG__ || {};
      var ctAddr = config.contracts && config.contracts.ConditionalToken;
      if (!ctAddr) return;

      var resp = await fetch("/api/abi/ConditionalToken");
      var data = await resp.json();

      // Extract marketId from sell button
      var sellBtn = document.querySelector(".btn-sell-yes") || document.querySelector(".btn-sell-no");
      if (!sellBtn) return;
      var marketId = parseInt(sellBtn.getAttribute("data-market-id"), 10);
      var outcomeIndex = parseInt(sellBtn.getAttribute("data-outcome-index") || "0", 10);

      var MAX_OUTCOMES = 20;
      var yesTokenId = marketId * MAX_OUTCOMES * 2 + outcomeIndex * 2;
      var noTokenId = marketId * MAX_OUTCOMES * 2 + outcomeIndex * 2 + 1;

      var yesBal = (await PQlyWallet.readContractAt(ctAddr, data.abi, "balanceOf", [account, yesTokenId]))[0];
      var noBal = (await PQlyWallet.readContractAt(ctAddr, data.abi, "balanceOf", [account, noTokenId]))[0];

      var yesEl = document.getElementById("userYesShares");
      var noEl = document.getElementById("userNoShares");
      if (yesEl) yesEl.textContent = parseFloat(ethers.formatEther(yesBal)).toFixed(4);
      if (noEl) noEl.textContent = parseFloat(ethers.formatEther(noBal)).toFixed(4);

      // Store raw balances for validation
      window.__userYesBal = yesBal;
      window.__userNoBal = noBal;
    } catch (err) {
      console.error("Failed to load user shares:", err);
    }
  }

  // ---- Real-time estimation for buy/sell ----

  var FEE_BPS = 200n;
  var BPS = 10000n;
  var poolReserves = { yes: 0n, no: 0n };

  /**
   * Fetch pool reserves (yesShares, noShares) via server API.
   * Does not require wallet — works for all visitors.
   */
  async function fetchPoolReserves(marketId, outcomeIndex) {
    if (outcomeIndex === undefined) outcomeIndex = 0;
    try {
      var resp = await fetch("/api/market-reserves/" + marketId + "?outcome=" + outcomeIndex);
      var data = await resp.json();
      if (data.success) {
        poolReserves.yes = BigInt(data.yesShares);
        poolReserves.no = BigInt(data.noShares);
      }
    } catch (err) {
      console.error("Failed to fetch pool reserves:", err);
    }
  }

  /**
   * Estimate shares received for a given QRL amount (buy).
   * AMM formula: netAmount = amount - fee; shares = poolOut - (poolOut * poolIn) / (poolIn + netAmount)
   */
  function estimateBuyShares(amountWei, isYes) {
    var poolOut = isYes ? poolReserves.yes : poolReserves.no;
    var poolIn = isYes ? poolReserves.no : poolReserves.yes;
    if (poolOut === 0n || poolIn === 0n) return { shares: 0n, avgPrice: 0 };

    var fee = (amountWei * FEE_BPS) / BPS;
    var netAmount = amountWei - fee;
    if (netAmount <= 0n) return { shares: 0n, avgPrice: 0 };

    var shares = poolOut - (poolOut * poolIn) / (poolIn + netAmount);
    if (shares <= 0n) return { shares: 0n, avgPrice: 0 };

    // Average price = cost / shares (in QRL per share)
    var amountF = parseFloat(ethers.formatEther(amountWei));
    var sharesF = parseFloat(ethers.formatEther(shares));
    var avgPrice = sharesF > 0 ? amountF / sharesF : 0;

    return { shares: shares, avgPrice: avgPrice };
  }

  /**
   * Estimate payout for selling a given number of shares.
   * AMM formula: payout = poolOut - (poolOut * poolIn) / (poolIn + shares); payout -= fee
   */
  function estimateSellPayout(sharesWei, isYes) {
    var poolIn = isYes ? poolReserves.yes : poolReserves.no;
    var poolOut = isYes ? poolReserves.no : poolReserves.yes;
    if (poolOut === 0n || poolIn === 0n) return 0n;

    var rawPayout = poolOut - (poolOut * poolIn) / (poolIn + sharesWei);
    var fee = (rawPayout * FEE_BPS) / BPS;
    var payout = rawPayout - fee;
    return payout > 0n ? payout : 0n;
  }

  function showWarn(elId, msg) {
    var el = document.getElementById(elId);
    if (!el) return;
    if (msg) { el.textContent = msg; el.classList.remove("hidden"); }
    else { el.textContent = ""; el.classList.add("hidden"); }
  }

  var estDebounceTimers = {};

  function bindEstimation(marketId) {
    // Buy YES estimation
    var yesInput = document.getElementById("yesAmount");
    if (yesInput) {
      yesInput.addEventListener("input", function () {
        clearTimeout(estDebounceTimers.yBuy);
        estDebounceTimers.yBuy = setTimeout(function () { updateBuyEstimate(yesInput, true); }, 200);
      });
    }

    // Buy NO estimation
    var noInput = document.getElementById("noAmount");
    if (noInput) {
      noInput.addEventListener("input", function () {
        clearTimeout(estDebounceTimers.nBuy);
        estDebounceTimers.nBuy = setTimeout(function () { updateBuyEstimate(noInput, false); }, 200);
      });
    }

    // Sell YES estimation
    var sellYesInput = document.getElementById("sellYesAmount");
    if (sellYesInput) {
      sellYesInput.addEventListener("input", function () {
        clearTimeout(estDebounceTimers.ySell);
        estDebounceTimers.ySell = setTimeout(function () { updateSellEstimate(sellYesInput, true); }, 200);
      });
    }

    // Sell NO estimation
    var sellNoInput = document.getElementById("sellNoAmount");
    if (sellNoInput) {
      sellNoInput.addEventListener("input", function () {
        clearTimeout(estDebounceTimers.nSell);
        estDebounceTimers.nSell = setTimeout(function () { updateSellEstimate(sellNoInput, false); }, 200);
      });
    }
  }

  async function updateBuyEstimate(input, isYes) {
    var prefix = isYes ? "Yes" : "No";
    var sharesEl = document.getElementById("est" + prefix + "Shares");
    var priceEl = document.getElementById("est" + prefix + "AvgPrice");
    var warnId = "warn" + prefix + "Buy";

    var val = parseFloat(input.value);
    if (!val || val <= 0) {
      if (sharesEl) sharesEl.textContent = "\u2014";
      if (priceEl) priceEl.textContent = "\u2014";
      showWarn(warnId, "");
      return;
    }

    // Check QRL balance
    var account = PQlyWallet.getAccount();
    if (account) {
      try {
        var rawBal = await PQlyWallet.getBalance(account);
        var balWei = BigInt(rawBal);
        var amtWei = ethers.parseEther(val.toString());
        if (amtWei > balWei) {
          showWarn(warnId, "Insufficient QRL balance (" + parseFloat(ethers.formatEther(balWei)).toFixed(4) + " QRL)");
        } else {
          showWarn(warnId, "");
        }
      } catch (_) { showWarn(warnId, ""); }
    }

    try {
      var amountWei = ethers.parseEther(val.toString());
      var est = estimateBuyShares(amountWei, isYes);
      if (sharesEl) sharesEl.textContent = parseFloat(ethers.formatEther(est.shares)).toFixed(4);
      if (priceEl) priceEl.textContent = (est.avgPrice * 100).toFixed(1) + "\u00A2";
    } catch (e) {
      if (sharesEl) sharesEl.textContent = "\u2014";
      if (priceEl) priceEl.textContent = "\u2014";
    }
  }

  function updateSellEstimate(input, isYes) {
    var prefix = isYes ? "Yes" : "No";
    var payoutEl = document.getElementById("sell" + prefix + "Payout");
    var warnId = "warn" + prefix + "Sell";

    var val = parseFloat(input.value);
    if (!val || val <= 0) {
      if (payoutEl) payoutEl.textContent = "\u2014";
      showWarn(warnId, "");
      return;
    }

    // Check if user has enough shares
    var userBal = isYes ? (window.__userYesBal || 0n) : (window.__userNoBal || 0n);
    try {
      var sharesWei = ethers.parseEther(val.toString());
      if (BigInt(userBal) > 0n && sharesWei > BigInt(userBal)) {
        var maxShares = parseFloat(ethers.formatEther(BigInt(userBal))).toFixed(4);
        showWarn(warnId, "Insufficient shares (you have " + maxShares + ")");
      } else {
        showWarn(warnId, "");
      }

      var payout = estimateSellPayout(sharesWei, isYes);
      if (payoutEl) payoutEl.textContent = parseFloat(ethers.formatEther(payout)).toFixed(4) + " QRL";
    } catch (e) {
      if (payoutEl) payoutEl.textContent = "\u2014";
    }
  }

  /**
   * Search functionality
   */
  function bindSearch() {
    var searchInput = document.getElementById("searchInput");
    if (!searchInput) return;

    var debounceTimer;
    searchInput.addEventListener("input", function () {
      clearTimeout(debounceTimer);
      var query = this.value.toLowerCase().trim();

      debounceTimer = setTimeout(function () {
        filterMarkets(query);
      }, 300);
    });
  }

  /**
   * Filter market cards by search query
   */
  function filterMarkets(query) {
    var grid = document.getElementById("marketsGrid");
    if (!grid) return;

    var cards = grid.children;
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var text = card.textContent.toLowerCase();
      if (!query || text.indexOf(query) !== -1) {
        card.style.display = "";
      } else {
        card.style.display = "none";
      }
    }
  }

  /**
   * Portfolio page — check wallet connection after auto-reconnect delay
   */
  function bindPortfolio() {
    if (!document.getElementById("portfolioNoWallet")) return;

    PQlyWallet.onReady(function (account) {
      if (account) {
        document.getElementById("portfolioNoWallet").classList.add("hidden");
        document.getElementById("portfolioContent").classList.remove("hidden");
        loadPortfolio(account);
      } else {
        document.getElementById("portfolioNoWallet").classList.remove("hidden");
      }
    });
  }

  /**
   * Load portfolio data from chain via API
   */
  async function loadPortfolio(account) {
    try {
      // Fetch QRL balance directly via RPC
      try {
        var rawBal = await PQlyWallet.getBalance(account);
        var wei = BigInt(rawBal);
        var formattedBal = Number(wei) / 1e18;
        document.getElementById("portfolioQrlBalance").textContent = 
          formattedBal.toLocaleString(undefined, { maximumFractionDigits: 2 }) + " QRL";
      } catch (_e) {}

      var resp = await fetch("/api/portfolio/" + account);
      var data = await resp.json();

      if (!data.success) {
        document.getElementById("portfolioValue").textContent = "0.00 QRL";
        document.getElementById("portfolioPnL").textContent = "0.00 QRL";
        document.getElementById("portfolioPositions").textContent = "0";
        return;
      }

      var positions = data.data;
      var totalValue = 0;
      var totalPnL = 0;
      var activeCount = 0;

      // Populate positions table
      var tbody = document.getElementById("positionsBody");
      if (positions.length === 0) {
        tbody.innerHTML =
          '<tr><td colspan="6" class="py-8 text-center text-on-surface-variant text-xs">No positions yet. Start trading!</td></tr>';
      } else {
        var rows = "";
        positions.forEach(function (p) {
          var shares = parseFloat(p.shares) || 0;
          var price = p.currentPrice / 100;
          var value = shares * price;
          totalValue += value;
          if (!p.marketResolved) activeCount++;

          var costBasis = parseFloat(p.costBasis) || 0;
          var avgPrice = shares > 0 ? (costBasis / shares) : 0;
          var pnl = parseFloat(p.unrealizedPnL) || 0;
          totalPnL += pnl;

          var sideClass = p.side === "YES" ? "text-green-400" : "text-red-400";
          var pnlClass = pnl >= 0 ? "text-green-400" : "text-red-400";
          var pnlSign = pnl >= 0 ? "+" : "";
          var questionText = p.question.length > 50 ? p.question.substring(0, 50) + "..." : p.question;

          rows +=
            '<tr class="border-t border-outline-variant/5 hover:bg-surface-container-high transition-colors">' +
            '<td class="py-4 text-xs"><a href="/market/' + p.marketId + '" class="text-primary hover:underline">' + questionText + "</a></td>" +
            '<td class="py-4 ' + sideClass + ' font-bold text-xs">' + p.side + "</td>" +
            '<td class="py-4 text-right font-mono text-xs">' + p.shares + "</td>" +
            '<td class="py-4 text-right text-on-surface-variant text-xs">' + (avgPrice > 0 ? (avgPrice * 100).toFixed(1) + "%" : "—") + "</td>" +
            '<td class="py-4 text-right text-xs">' + p.currentPrice + "%</td>" +
            '<td class="py-4 text-right font-bold text-xs ' + pnlClass + '">' + pnlSign + pnl.toFixed(4) + " QRL</td>" +
            "</tr>";
        });
        tbody.innerHTML = rows;
      }

      document.getElementById("portfolioValue").textContent =
        totalValue.toFixed(4) + " QRL";
      var pnlEl = document.getElementById("portfolioPnL");
      var pnlSign = totalPnL >= 0 ? "+" : "";
      pnlEl.textContent = pnlSign + totalPnL.toFixed(4) + " QRL";
      pnlEl.className = pnlEl.className.replace(/text-\S+/g, "");
      pnlEl.classList.add("text-2xl", "font-black", totalPnL >= 0 ? "text-green-400" : "text-red-400");
      document.getElementById("portfolioPositions").textContent =
        activeCount.toString();
    } catch (err) {
      console.error("Failed to load portfolio:", err);
    }
  }

  // ---- Leaderboard Page ----

  var lbCurrentPeriod = "all";
  var lbCurrentType = "volume";

  function bindLeaderboard() {
    var body = document.getElementById("leaderboardBody");
    if (!body) return;

    // Period tab clicks
    document.querySelectorAll(".lb-period-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        lbCurrentPeriod = btn.dataset.period;
        document.querySelectorAll(".lb-period-btn").forEach(function (b) {
          b.classList.remove("bg-primary", "text-on-primary");
          b.classList.add("text-on-surface-variant");
        });
        btn.classList.add("bg-primary", "text-on-primary");
        btn.classList.remove("text-on-surface-variant");
        loadLeaderboard();
      });
    });

    // Type toggle clicks
    document.querySelectorAll(".lb-type-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        lbCurrentType = btn.dataset.type;
        document.querySelectorAll(".lb-type-btn").forEach(function (b) {
          b.classList.remove("bg-primary", "text-on-primary");
          b.classList.add("text-on-surface-variant");
        });
        btn.classList.add("bg-primary", "text-on-primary");
        btn.classList.remove("text-on-surface-variant");
        // Update metric column header
        document.getElementById("lbMetricHeader").textContent =
          lbCurrentType === "volume" ? "Volume" : "Profit";
        loadLeaderboard();
      });
    });

    // Initial load
    loadLeaderboard();
  }

  async function loadLeaderboard() {
    var tbody = document.getElementById("leaderboardBody");
    if (!tbody) return;

    tbody.innerHTML =
      '<tr><td colspan="5" class="py-12 text-center text-on-surface-variant text-xs">Loading...</td></tr>';

    try {
      var resp = await fetch(
        "/api/leaderboard?period=" + lbCurrentPeriod + "&type=" + lbCurrentType
      );
      var data = await resp.json();

      if (!data.success || !data.data || data.data.length === 0) {
        tbody.innerHTML =
          '<tr><td colspan="5" class="py-12 text-center text-on-surface-variant text-xs">' +
          '<span class="material-symbols-outlined text-5xl mb-4 block">leaderboard</span>' +
          "No trading activity yet. Be the first to trade!</td></tr>";
        return;
      }

      var rows = "";
      data.data.forEach(function (l, i) {
        var rank = i + 1;
        var rankClass =
          rank <= 3
            ? "text-primary font-black text-lg"
            : "text-on-surface-variant";
        var addrShort = l.addressShort || (l.address.substring(0, 10) + "..." + l.address.slice(-6));
        var metricValue =
          lbCurrentType === "volume"
            ? l.totalVolume
            : l.profit ? l.profit + " QRL" : "0 QRL";
        var metricClass =
          lbCurrentType === "profit"
            ? l.profit && l.profit.startsWith("-")
              ? "text-red-400 font-bold"
              : "text-green-400 font-bold"
            : "text-primary font-bold";

        rows +=
          '<tr class="border-t border-outline-variant/5 hover:bg-surface-container-high transition-colors cursor-pointer" onclick="window.location=\'/profile/' +
          l.address +
          '\'">' +
          '<td class="py-4"><span class="' + rankClass + '">#' + rank + "</span></td>" +
          '<td class="py-4 font-mono text-xs"><a href="/profile/' + l.address + '" class="text-primary hover:underline">' + addrShort + "</a></td>" +
          '<td class="py-4 text-right ' + metricClass + '">' + metricValue + "</td>" +
          '<td class="py-4 text-right">' + l.trades + "</td>" +
          '<td class="py-4 text-right text-on-surface-variant">' + l.markets + "</td>" +
          "</tr>";
      });
      tbody.innerHTML = rows;
    } catch (err) {
      console.error("Failed to load leaderboard:", err);
      tbody.innerHTML =
        '<tr><td colspan="5" class="py-12 text-center text-error text-xs">Failed to load leaderboard</td></tr>';
    }
  }

  // ---- Create Market Page ----

  function bindCreateMarket() {
    var createConnectBtn = document.getElementById("createConnectBtn");
    if (createConnectBtn) {
      createConnectBtn.addEventListener("click", async function () {
        var account = await PQlyWallet.connect();
        if (account) checkCreateAuth(account);
      });
    }

    var submitBtn = document.getElementById("submitCreateMarket");
    if (submitBtn) {
      submitBtn.addEventListener("click", executeCreateMarket);
    }

    // Group creation
    var submitGroupBtn = document.getElementById("submitCreateGroup");
    if (submitGroupBtn) {
      submitGroupBtn.addEventListener("click", executeCreateGroup);
    }

    var addOutcomeBtn = document.getElementById("addOutcomeBtn");
    if (addOutcomeBtn) {
      addOutcomeBtn.addEventListener("click", function () {
        var container = document.getElementById("outcomeLabelsContainer");
        if (!container) return;
        var count = container.children.length + 1;
        var div = document.createElement("div");
        div.className = "flex gap-2";
        div.innerHTML = '<input type="text" placeholder="Outcome ' + count + '" class="outcome-label-input flex-1 bg-surface-container-highest text-on-surface px-4 py-3 text-sm border-none focus:outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-neutral-600" />'
          + '<button type="button" class="text-error hover:text-on-error hover:bg-error px-2 transition-all" onclick="this.parentElement.remove()"><span class="material-symbols-outlined text-sm">close</span></button>';
        container.appendChild(div);
      });
    }

    // Auto-detect category from question
    var qInput = document.getElementById("marketQuestion");
    if (qInput) {
      qInput.addEventListener("input", function () {
        var q = this.value.toLowerCase();
        var catEl = document.getElementById("marketCategory");
        if (!catEl) return;
        if (q.match(/\bbtc\b|bitcoin/)) catEl.textContent = "BTC";
        else if (q.match(/\bqrl\b|quantum/)) catEl.textContent = "QRL";
        else if (q.match(/\beth\b|ethereum/)) catEl.textContent = "Crypto";
        else catEl.textContent = "General";
      });
    }

    // Check auth on page load when wallet state is known
    if (document.getElementById("createForm")) {
      PQlyWallet.onReady(function (account) {
        if (account) {
          checkCreateAuth(account);
        } else {
          var noWallet = document.getElementById("createNoWallet");
          if (noWallet) noWallet.classList.remove("hidden");
        }
      });
    }
  }

  async function checkCreateAuth(account) {
    try {
      var resp = await fetch("/api/is-creator/" + account);
      var data = await resp.json();

      var noWallet = document.getElementById("createNoWallet");
      var notAuth = document.getElementById("createNotAuthorized");
      var form = document.getElementById("createForm");

      if (noWallet) noWallet.classList.add("hidden");

      if (data.isCreator) {
        if (notAuth) notAuth.classList.add("hidden");
        if (form) form.classList.remove("hidden");
      } else {
        if (notAuth) notAuth.classList.remove("hidden");
        if (form) form.classList.add("hidden");
      }
    } catch (err) {
      console.error("Creator check failed:", err);
    }
  }

  // Handle "Request Authorization" button
  var requestAuthBtn = document.getElementById("requestAuthBtn");
  if (requestAuthBtn) {
    requestAuthBtn.addEventListener("click", async function () {
      var account = PQlyWallet.getAccount();
      if (!account) return;
      var statusEl = document.getElementById("authStatus");
      requestAuthBtn.disabled = true;
      requestAuthBtn.textContent = "Authorizing...";
      if (statusEl) { statusEl.textContent = "Sending authorization transaction..."; statusEl.classList.remove("hidden"); }
      try {
        var resp = await fetch("/api/authorize-creator", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: account }),
        });
        var data = await resp.json();
        if (data.success) {
          if (statusEl) { statusEl.textContent = "Authorized! Reloading..."; statusEl.className = "text-primary text-xs mt-4"; }
          setTimeout(function () { window.location.reload(); }, 1500);
        } else {
          if (statusEl) { statusEl.textContent = "Failed: " + (data.error || "Unknown error"); statusEl.classList.remove("hidden"); }
          requestAuthBtn.disabled = false;
          requestAuthBtn.textContent = "Request Authorization";
        }
      } catch (err) {
        if (statusEl) { statusEl.textContent = "Error: " + err.message; statusEl.classList.remove("hidden"); }
        requestAuthBtn.disabled = false;
        requestAuthBtn.textContent = "Request Authorization";
      }
    });
  }

  async function executeCreateMarket() {
    var account = PQlyWallet.getAccount();
    if (!account) {
      account = await PQlyWallet.connect();
      if (!account) return;
    }

    var question = document.getElementById("marketQuestion").value.trim();
    var endDateStr = document.getElementById("marketEndDate").value;

    if (!question) {
      PQlyWallet.showToast("Enter a market question", "error");
      return;
    }
    if (!endDateStr) {
      PQlyWallet.showToast("Select a resolution date", "error");
      return;
    }

    var endTime = Math.floor(new Date(endDateStr).getTime() / 1000);
    if (endTime <= Math.floor(Date.now() / 1000)) {
      PQlyWallet.showToast("End date must be in the future", "error");
      return;
    }

    try {
      PQlyWallet.showToast("Creating market...", "info");

      var tx = await PQlyWallet.writeContract("MarketFactory", "createBinaryMarket", [question, endTime]);

      PQlyWallet.showToast("Transaction sent. Waiting for confirmation...", "info");
      await tx.wait();
      PQlyWallet.showToast("Market created successfully!", "success");

      setTimeout(function () {
        window.location.href = "/";
      }, 1500);
    } catch (err) {
      console.error("Create market failed:", err);
      PQlyWallet.showToast(
        err.reason || err.message || "Failed to create market",
        "error"
      );
    }
  }

  // ---- Governance Page ----

  function bindGovernance() {
    var govConnectBtn = document.getElementById("govConnectBtn");
    if (govConnectBtn) {
      govConnectBtn.addEventListener("click", async function () {
        var account = await PQlyWallet.connect();
        if (account) initGovernanceUI(account);
      });
    }

    // Toggle panels
    document.querySelectorAll(".gov-market-header").forEach(function (header) {
      header.addEventListener("click", function () {
        var idx = this.getAttribute("data-toggle");
        var panel = document.getElementById("govPanel-" + idx);
        var chevron = document.getElementById("chevron-" + idx);
        if (panel) panel.classList.toggle("hidden");
        if (chevron) {
          chevron.textContent = panel.classList.contains("hidden") ? "expand_more" : "expand_less";
        }
      });
    });

    // Propose buttons
    document.querySelectorAll(".gov-propose-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var marketId = this.getAttribute("data-market");
        var outcome = parseInt(this.getAttribute("data-outcome"), 10);
        executeGovernanceAction("propose", marketId, outcome);
      });
    });

    // Dispute buttons
    document.querySelectorAll(".gov-dispute-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var marketId = this.getAttribute("data-market");
        var outcome = parseInt(this.getAttribute("data-outcome"), 10);
        executeGovernanceAction("dispute", marketId, outcome);
      });
    });

    // Vote buttons
    document.querySelectorAll(".gov-vote-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var marketId = this.getAttribute("data-market");
        var outcome = parseInt(this.getAttribute("data-outcome"), 10);
        var amountInput = document.querySelector('.gov-vote-amount[data-market="' + marketId + '"]');
        var amount = amountInput ? amountInput.value : "0";
        if (!amount || parseFloat(amount) <= 0) {
          PQlyWallet.showToast("Enter PQL amount to vote", "error");
          return;
        }
        executeGovernanceAction("vote", marketId, outcome, amount);
      });
    });

    // Finalize buttons
    document.querySelectorAll(".gov-finalize-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var marketId = this.getAttribute("data-market");
        executeGovernanceAction("finalize", marketId);
      });
    });

    // Claim buttons
    document.querySelectorAll(".gov-claim-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var marketId = this.getAttribute("data-market");
        executeGovernanceAction("claim", marketId);
      });
    });

    // Auto-init when wallet state is known
    if (document.getElementById("govMarketsList")) {
      PQlyWallet.onReady(function (account) {
        if (account) {
          initGovernanceUI(account);
        } else {
          var noWallet = document.getElementById("govNoWallet");
          if (noWallet) noWallet.classList.remove("hidden");
        }
      });
    }
  }

  async function initGovernanceUI(account) {
    var noWallet = document.getElementById("govNoWallet");
    var list = document.getElementById("govMarketsList");
    var bar = document.getElementById("govWalletBar");

    if (noWallet) noWallet.classList.add("hidden");
    if (list) list.classList.remove("hidden");
    if (bar) bar.classList.remove("hidden");

    // Show wallet address
    var addrEl = document.getElementById("govWalletAddr");
    if (addrEl) addrEl.textContent = account.substring(0, 6) + "..." + account.substring(account.length - 4);

    // Load PQL balance
    try {
      var resp = await fetch("/api/pql-balance/" + account);
      var data = await resp.json();
      var balEl = document.getElementById("govPqlBalance");
      if (balEl && data.balance) balEl.textContent = parseFloat(data.balance).toFixed(2) + " PQL";
    } catch (err) {
      console.error("PQL balance fetch failed:", err);
    }

    // Load governance status for each market
    document.querySelectorAll("[data-market-id]").forEach(function (el) {
      var marketId = el.getAttribute("data-market-id");
      loadGovernanceStatus(marketId);
    });
  }

  async function loadGovernanceStatus(marketId) {
    try {
      var resp = await fetch("/api/governance/" + marketId);
      var data = await resp.json();

      var statusEl = document.getElementById("govStatus-" + marketId);
      var proposeEl = document.getElementById("govProposeSection-" + marketId);
      var disputeEl = document.getElementById("govDisputeSection-" + marketId);
      var voteEl = document.getElementById("govVoteSection-" + marketId);
      var finalizeEl = document.getElementById("govFinalizeSection-" + marketId);
      var claimEl = document.getElementById("govClaimSection-" + marketId);

      if (!statusEl) return;

      var p = data.proposal || {};
      // State: 0=None, 1=Proposed, 2=Disputed, 3=Finalized
      var state = p.stateNum || 0;
      var stateNames = ["No Proposal", "Proposed", "Disputed (Voting)", "Finalized"];
      var stateColors = ["text-on-surface-variant", "text-primary", "text-tertiary", "text-tertiary"];

      var html = '<div class="flex items-center justify-between">';
      html += '<div>';
      html += '<p class="text-xs font-bold ' + stateColors[state] + '">' + stateNames[state] + '</p>';
      if (state >= 1) {
        html += '<p class="text-[10px] text-on-surface-variant mt-1">Proposed: ' + (p.proposedOutcome || "?") + ' by ' + (p.proposer ? p.proposer.substring(0, 10) + "..." : "?") + '</p>';
      }
      if (state === 2) {
        html += '<p class="text-[10px] text-on-surface-variant">Counter: ' + (p.counterOutcome || "?") + ' | YES votes: ' + (p.yesVotes || "0") + ' | NO votes: ' + (p.noVotes || "0") + '</p>';
      }
      if (state === 3 || data.isResolved) {
        html += '<p class="text-[10px] text-tertiary font-bold">Final outcome: ' + (data.outcome || p.proposedOutcome || "?") + '</p>';
      }
      html += '</div>';
      html += '</div>';
      statusEl.innerHTML = html;

      // Show/hide action sections based on state
      if (proposeEl) proposeEl.classList.toggle("hidden", state !== 0);
      if (disputeEl) disputeEl.classList.toggle("hidden", state !== 1);
      if (voteEl) voteEl.classList.toggle("hidden", state !== 2);
      if (finalizeEl) finalizeEl.classList.toggle("hidden", state < 1 || state >= 3);
      if (claimEl) claimEl.classList.toggle("hidden", state !== 3);
    } catch (err) {
      console.error("Gov status load failed for market " + marketId, err);
      var statusEl = document.getElementById("govStatus-" + marketId);
      if (statusEl) statusEl.innerHTML = '<p class="text-xs text-error">Failed to load governance data</p>';
    }
  }

  async function executeGovernanceAction(action, marketId, outcome, pqlAmount) {
    var account = PQlyWallet.getAccount();
    if (!account) {
      account = await PQlyWallet.connect();
      if (!account) return;
    }

    try {
      var cfg = window.__PQLY_CONFIG__ || {};
      var govAddr = cfg.contracts.GovernanceOracle;
      var tx;

      if (action === "propose") {
        var stakeAmount = await PQlyWallet.readContract("GovernanceOracle", "getRequiredStake", [parseInt(marketId, 10)]);
        PQlyWallet.showToast("Approving PQL stake...", "info");
        var approveTx = await PQlyWallet.writeContract("PqlToken", "approve", [govAddr, stakeAmount]);
        await approveTx.wait();

        PQlyWallet.showToast("Submitting proposal...", "info");
        tx = await PQlyWallet.writeContract("GovernanceOracle", "proposeOutcome", [parseInt(marketId, 10), outcome, stakeAmount]);
      } else if (action === "dispute") {
        var stakeAmount = await PQlyWallet.readContract("GovernanceOracle", "getRequiredStake", [parseInt(marketId, 10)]);
        PQlyWallet.showToast("Approving PQL stake...", "info");
        var approveTx = await PQlyWallet.writeContract("PqlToken", "approve", [govAddr, stakeAmount]);
        await approveTx.wait();

        PQlyWallet.showToast("Submitting dispute...", "info");
        tx = await PQlyWallet.writeContract("GovernanceOracle", "disputeOutcome", [parseInt(marketId, 10), outcome, stakeAmount]);
      } else if (action === "vote") {
        var voteAmount = ethers.parseEther(pqlAmount);
        PQlyWallet.showToast("Approving PQL for voting...", "info");
        var approveTx = await PQlyWallet.writeContract("PqlToken", "approve", [govAddr, voteAmount]);
        await approveTx.wait();

        PQlyWallet.showToast("Casting vote...", "info");
        tx = await PQlyWallet.writeContract("GovernanceOracle", "vote", [parseInt(marketId, 10), outcome, voteAmount]);
      } else if (action === "finalize") {
        PQlyWallet.showToast("Finalizing...", "info");
        var resp = await fetch("/api/governance/" + marketId);
        var data = await resp.json();
        if (data.state === 1) {
          tx = await PQlyWallet.writeContract("GovernanceOracle", "finalizeProposal", [parseInt(marketId, 10)]);
        } else if (data.state === 2) {
          tx = await PQlyWallet.writeContract("GovernanceOracle", "finalizeDispute", [parseInt(marketId, 10)]);
        } else {
          PQlyWallet.showToast("Nothing to finalize", "error");
          return;
        }
      } else if (action === "claim") {
        PQlyWallet.showToast("Claiming voter stake...", "info");
        tx = await PQlyWallet.writeContract("GovernanceOracle", "claimVoterStake", [parseInt(marketId, 10)]);
      }

      if (tx) {
        PQlyWallet.showToast("Transaction sent. Waiting...", "info");
        await tx.wait();
        PQlyWallet.showToast("Action completed!", "success");
        // Refresh governance status
        loadGovernanceStatus(marketId);
        // Refresh PQL balance
        var balResp = await fetch("/api/pql-balance/" + account);
        var balData = await balResp.json();
        var balEl = document.getElementById("govPqlBalance");
        if (balEl && balData.balance) balEl.textContent = parseFloat(balData.balance).toFixed(2) + " PQL";
      }
    } catch (err) {
      console.error("Governance action failed:", err);
      PQlyWallet.showToast(
        err.reason || err.message || "Governance action failed",
        "error"
      );
    }
  }

  // ---- Multi-Outcome Market Page ----

  function bindMultiOutcomeMarket() {
    var multiOutcomes = document.getElementById("multiOutcomes");
    if (!multiOutcomes) return;

    var marketData = window.__MARKET_DATA__;
    if (!marketData) return;

    // Outcome row toggle — expand/collapse trade panel
    multiOutcomes.querySelectorAll(".outcome-row").forEach(function (row) {
      row.addEventListener("click", function (e) {
        if (e.target.closest("button")) return;
        var idx = this.getAttribute("data-outcome-index");
        var panel = document.getElementById("outcomePanel-" + idx);
        if (panel) panel.classList.toggle("hidden");
      });
    });

    // Buy YES quick buttons
    multiOutcomes.querySelectorAll(".multi-buy-yes").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var idx = this.getAttribute("data-outcome-index");
        var panel = document.getElementById("outcomePanel-" + idx);
        if (panel) {
          panel.classList.remove("hidden");
          // Set side to YES
          panel.querySelectorAll(".outcome-side-btn").forEach(function (sb) {
            if (sb.getAttribute("data-side") === "yes") {
              sb.classList.add("bg-primary", "text-on-primary", "active");
              sb.classList.remove("bg-surface-container-highest", "text-on-surface-variant");
            } else {
              sb.classList.remove("bg-primary", "text-on-primary", "active");
              sb.classList.add("bg-surface-container-highest", "text-on-surface-variant");
            }
          });
        }
      });
    });

    // Buy NO quick buttons
    multiOutcomes.querySelectorAll(".multi-buy-no").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var idx = this.getAttribute("data-outcome-index");
        var panel = document.getElementById("outcomePanel-" + idx);
        if (panel) {
          panel.classList.remove("hidden");
          panel.querySelectorAll(".outcome-side-btn").forEach(function (sb) {
            if (sb.getAttribute("data-side") === "no") {
              sb.classList.add("bg-primary", "text-on-primary", "active");
              sb.classList.remove("bg-surface-container-highest", "text-on-surface-variant");
            } else {
              sb.classList.remove("bg-primary", "text-on-primary", "active");
              sb.classList.add("bg-surface-container-highest", "text-on-surface-variant");
            }
          });
        }
      });
    });

    // Side toggle buttons inside expanded panels
    multiOutcomes.querySelectorAll(".outcome-side-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var idx = this.getAttribute("data-outcome-index");
        var panel = document.getElementById("outcomePanel-" + idx);
        if (!panel) return;
        panel.querySelectorAll(".outcome-side-btn").forEach(function (sb) {
          sb.classList.remove("bg-primary", "text-on-primary", "active");
          sb.classList.add("bg-surface-container-highest", "text-on-surface-variant");
        });
        this.classList.add("bg-primary", "text-on-primary", "active");
        this.classList.remove("bg-surface-container-highest", "text-on-surface-variant");
      });
    });

    // Buy buttons inside expanded panels
    multiOutcomes.querySelectorAll(".outcome-buy-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var mid = this.getAttribute("data-market-id");
        var idx = parseInt(this.getAttribute("data-outcome-index"), 10);
        var panel = document.getElementById("outcomePanel-" + idx);
        if (!panel) return;

        var activeBtn = panel.querySelector(".outcome-side-btn.active");
        var isYes = activeBtn ? activeBtn.getAttribute("data-side") === "yes" : true;
        var amountInput = panel.querySelector(".outcome-buy-amount");
        var amount = amountInput ? amountInput.value : "";

        if (!amount || parseFloat(amount) <= 0) {
          PQlyWallet.showToast("Enter a valid amount", "error");
          return;
        }
        executeBuy(mid, isYes, amount, idx);
      });
    });

    // Sell buttons inside expanded panels
    multiOutcomes.querySelectorAll(".outcome-sell-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var mid = this.getAttribute("data-market-id");
        var idx = parseInt(this.getAttribute("data-outcome-index"), 10);
        var panel = document.getElementById("outcomePanel-" + idx);
        if (!panel) return;

        var activeBtn = panel.querySelector(".outcome-side-btn.active");
        var isYes = activeBtn ? activeBtn.getAttribute("data-side") === "yes" : true;
        var amountInput = panel.querySelector(".outcome-sell-amount");
        var amount = amountInput ? amountInput.value : "";

        if (!amount || parseFloat(amount) <= 0) {
          PQlyWallet.showToast("Enter a valid shares amount", "error");
          return;
        }
        executeSell(mid, isYes, amount, idx);
      });
    });

    // Claim buttons for resolved outcomes
    multiOutcomes.querySelectorAll(".multi-claim").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var mid = this.getAttribute("data-market-id");
        executeClaim(mid);
      });
    });

    // Load user shares for all outcomes on wallet ready
    PQlyWallet.onReady(function (account) {
      if (account) loadMultiOutcomeUserShares(account, marketData);
    });
  }

  /**
   * Load share balances for all outcomes in a multi-outcome market
   */
  async function loadMultiOutcomeUserShares(account, marketData) {
    try {
      var config = window.__PQLY_CONFIG__ || {};
      var ctAddr = config.contracts && config.contracts.ConditionalToken;
      if (!ctAddr) return;

      var resp = await fetch("/api/abi/ConditionalToken");
      var data = await resp.json();

      var MAX_OUTCOMES = 20;
      var mid = marketData.id;

      for (var i = 0; i < marketData.outcomes.length; i++) {
        var idx = marketData.outcomes[i].outcomeIndex;
        var yesTokenId = mid * MAX_OUTCOMES * 2 + idx * 2;
        var noTokenId = mid * MAX_OUTCOMES * 2 + idx * 2 + 1;

        try {
          var yesBal = (await PQlyWallet.readContractAt(ctAddr, data.abi, "balanceOf", [account, yesTokenId]))[0];
          var noBal = (await PQlyWallet.readContractAt(ctAddr, data.abi, "balanceOf", [account, noTokenId]))[0];

          var yesEls = document.querySelectorAll('.outcome-yes-shares[data-outcome-index="' + idx + '"]');
          var noEls = document.querySelectorAll('.outcome-no-shares[data-outcome-index="' + idx + '"]');

          yesEls.forEach(function (el) { el.textContent = parseFloat(ethers.formatEther(yesBal)).toFixed(4); });
          noEls.forEach(function (el) { el.textContent = parseFloat(ethers.formatEther(noBal)).toFixed(4); });
        } catch (_e) { /* skip */ }
      }
    } catch (err) {
      console.error("Failed to load multi-outcome user shares:", err);
    }
  }

  // ---- Creator Status Check (navbar) ----

  // Called from wallet.js updateConnectedUI after manual connect
  window.checkCreatorStatusForAccount = async function (account) {
    var navCreate = document.getElementById("navCreateMarket");
    if (!navCreate || !account) return;
    try {
      var resp = await fetch("/api/is-creator/" + account);
      var data = await resp.json();
      if (data.isCreator || data.isOwner) {
        navCreate.classList.remove("hidden");
      } else {
        navCreate.classList.add("hidden");
      }
    } catch (_e) {}
  };

  async function checkCreatorStatus() {
    var navCreate = document.getElementById("navCreateMarket");
    if (!navCreate) return;

    PQlyWallet.onReady(async function (account) {
      if (!account) return;
      window.checkCreatorStatusForAccount(account);
    });
  }

  // Initialize
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

/**
 * Toggle create mode between standalone and group
 */
function setCreateMode(mode) {
  var standaloneFields = document.getElementById("standaloneFields");
  var groupFields = document.getElementById("groupFields");
  var modeStandalone = document.getElementById("modeStandalone");
  var modeGroup = document.getElementById("modeGroup");

  if (mode === "group") {
    if (standaloneFields) standaloneFields.classList.add("hidden");
    if (groupFields) groupFields.classList.remove("hidden");
    if (modeStandalone) { modeStandalone.classList.remove("bg-primary", "text-on-primary"); modeStandalone.classList.add("bg-surface-container-highest", "text-on-surface-variant"); }
    if (modeGroup) { modeGroup.classList.add("bg-primary", "text-on-primary"); modeGroup.classList.remove("bg-surface-container-highest", "text-on-surface-variant"); }
  } else {
    if (standaloneFields) standaloneFields.classList.remove("hidden");
    if (groupFields) groupFields.classList.add("hidden");
    if (modeStandalone) { modeStandalone.classList.add("bg-primary", "text-on-primary"); modeStandalone.classList.remove("bg-surface-container-highest", "text-on-surface-variant"); }
    if (modeGroup) { modeGroup.classList.remove("bg-primary", "text-on-primary"); modeGroup.classList.add("bg-surface-container-highest", "text-on-surface-variant"); }
  }
}

/**
 * Execute create multi-outcome market on-chain (single contract deploy)
 */
async function executeCreateGroup() {
  var account = PQlyWallet.getAccount();
  if (!account) {
    account = await PQlyWallet.connect();
    if (!account) return;
  }

  var title = document.getElementById("groupTitle").value.trim();
  var endDateStr = document.getElementById("groupEndDate").value;

  if (!title) {
    PQlyWallet.showToast("Enter a market question", "error");
    return;
  }
  if (!endDateStr) {
    PQlyWallet.showToast("Select a resolution date", "error");
    return;
  }

  var endTime = Math.floor(new Date(endDateStr).getTime() / 1000);
  if (endTime <= Math.floor(Date.now() / 1000)) {
    PQlyWallet.showToast("End date must be in the future", "error");
    return;
  }

  // Collect outcome labels
  var inputs = document.querySelectorAll(".outcome-label-input");
  var labels = [];
  inputs.forEach(function (inp) {
    var v = inp.value.trim();
    if (v) labels.push(v);
  });

  if (labels.length < 2) {
    PQlyWallet.showToast("Add at least 2 outcome labels", "error");
    return;
  }

  if (labels.length > 20) {
    PQlyWallet.showToast("Maximum 20 outcomes allowed", "error");
    return;
  }

  try {
    PQlyWallet.showToast("Creating multi-outcome market (" + labels.length + " outcomes)...", "info");

    // Single transaction: createMarket(question, labels[], endTime)
    var tx = await PQlyWallet.writeContract("MarketFactory", "createMarket", [title, labels, endTime]);

    PQlyWallet.showToast("Transaction sent. Waiting for confirmation...", "info");
    await tx.wait();
    PQlyWallet.showToast("Multi-outcome market created!", "success");

    setTimeout(function () {
      window.location.href = "/";
    }, 1500);
  } catch (err) {
    console.error("Create multi-outcome market failed:", err);
    PQlyWallet.showToast(
      err.reason || err.message || "Failed to create market",
      "error"
    );
  }
}

/**
 * Check faucet eligibility when wallet connects. Show/hide the claim button.
 * Uses cookie to remember claim across sessions, plus on-chain check as fallback.
 */
async function checkFaucetEligibility() {
  var account = PQlyWallet.getAccount();
  var btn = document.getElementById("faucetClaimBtn");
  if (!btn || !account) return;

  // Cookie check: if already claimed from this browser, hide immediately
  if (document.cookie.split(";").some(function (c) { return c.trim().startsWith("faucet_claimed="); })) {
    btn.classList.add("hidden");
    btn.classList.remove("flex");
    return;
  }

  try {
    var resp = await fetch("/api/faucet/status?address=" + account);
    var status = await resp.json();
    if (status.eligible) {
      btn.classList.remove("hidden");
      btn.classList.add("flex");
      btn.disabled = false;
      var btnText = document.getElementById("faucetBtnText");
      if (btnText) {
        var amountDisplay = status.claimAmount ? parseFloat(status.claimAmount).toFixed(0) : "400";
        var amountText = amountDisplay >= 1000 ? (amountDisplay / 1000).toFixed(0) + "k" : amountDisplay;
        btnText.textContent = "Claim " + amountText + " QRL";
      }
    } else {
      btn.classList.add("hidden");
      btn.classList.remove("flex");
      // If on-chain says claimed, set cookie so we don't check again
      if (status.claimed) {
        document.cookie = "faucet_claimed=1; max-age=31536000; path=/; SameSite=Lax";
      }
    }
  } catch (_e) {
    btn.classList.add("hidden");
  }
}

/**
 * Faucet claim — server-side, gas-free for the user.
 * POST /api/faucet/claim, server calls claimFor(address) using deployer key.
 */
async function claimFromFaucet() {
  var account = PQlyWallet.getAccount();
  if (!account) {
    PQlyWallet.showToast("Connect wallet first", "error");
    return;
  }

  var btn = document.getElementById("faucetClaimBtn");
  var btnText = document.getElementById("faucetBtnText");
  if (btn) btn.disabled = true;
  if (btnText) btnText.textContent = "Claiming...";

  try {
    var resp = await fetch("/api/faucet/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: account }),
    });
    var data = await resp.json();

    if (data.success) {
      PQlyWallet.showToast(data.amount + " QRL claimed! TX: " + data.txHash.substring(0, 10) + "...", "success");
      // Set cookie so button stays hidden across sessions and wallets
      document.cookie = "faucet_claimed=1; max-age=31536000; path=/; SameSite=Lax";
      // Hide the button after successful claim
      if (btn) {
        btn.classList.add("hidden");
        btn.classList.remove("flex");
      }
      // Refresh displayed balance
      PQlyWallet.refreshBalance();
    } else {
      PQlyWallet.showToast(data.error || "Claim failed", "error");
      if (btnText) btnText.textContent = "Claim QRL";
      if (btn) btn.disabled = false;
    }
  } catch (err) {
    console.error("Faucet claim failed:", err);
    PQlyWallet.showToast("Network error", "error");
    if (btnText) btnText.textContent = "Claim QRL";
    if (btn) btn.disabled = false;
  }
}
