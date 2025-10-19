// backend/services/advancedSimulation.js
// Advanced simulation engine: deterministic + simple stochastic element for risk index

const Business = require("../models/Business");
const Strategy = require("../models/Strategy");

/**
 * helper: compute IRR using binary search (safer than Newton for simple cases)
 * cashFlows: array of numbers (CF0 at t=0 usually negative initial investment, then returns)
 * returns IRR as decimal (e.g. 0.15) or null if not found
 */
function computeIRR(cashFlows, guessLow = -0.9999, guessHigh = 10, iterations = 80, tol = 1e-6) {
  function npv(rate) {
    return cashFlows.reduce((acc, cf, t) => acc + cf / Math.pow(1 + rate, t), 0);
  }
  let low = guessLow, high = guessHigh;
  let fLow = npv(low), fHigh = npv(high);
  if (fLow * fHigh > 0) {
    // can't guarantee root in range
    return null;
  }
  for (let i = 0; i < iterations; i++) {
    const mid = (low + high) / 2;
    const fMid = npv(mid);
    if (Math.abs(fMid) < tol) return mid;
    if (fLow * fMid <= 0) {
      high = mid;
      fHigh = fMid;
    } else {
      low = mid;
      fLow = fMid;
    }
  }
  return (low + high) / 2;
}

/**
 * compute ROI = (sum of net profit over period) / initialInvestment
 * if initialInvestment is zero, return null
 */
function computeROI(totalNetProfit, initialInvestment) {
  if (!initialInvestment || initialInvestment === 0) return null;
  return totalNetProfit / initialInvestment;
}

/**
 * compute break-even period (first period where cumulative profit >= initialInvestment)
 * returns integer period (1-based) or null if never breaks even within simulated periods
 */
function computeBreakEven(cumulativeProfits, initialInvestment) {
  if (!initialInvestment || initialInvestment <= 0) return null;
  for (let i = 0; i < cumulativeProfits.length; i++) {
    if (cumulativeProfits[i] >= initialInvestment) return i + 1;
  }
  return null;
}

/**
 * compute volatility (std dev) of profits as simple risk index
 */
function computeRiskIndex(profits) {
  if (!profits || profits.length === 0) return 0;
  const mean = profits.reduce((a, b) => a + b, 0) / profits.length;
  const variance = profits.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / profits.length;
  const std = Math.sqrt(variance);
  // Normalize risk index to something human readable:
  // riskIndex = std / avgRevenue (if avgRevenue>0) else absolute std
  return { std, mean, riskIndex: std };
}

/**
 * Simulate finance over `periods`.
 * options can include overrides for growthRate, costRate, priceDelta, marketingSpend, initialInvestment, debt (list of objects)
 *
 * business snapshot: { revenue, cost, profit, initialInvestement, cashBalance, debt etc }
 *
 * debt schedule example:
 * debt: { principal:1000, annualRate:0.08, periodsToRepay:4, startPeriod:1 }
 * or an array of such objects
 */
async function runAdvancedSimulation({
  businessId = null,
  strategyId = null,
  periods = 12,
  overrides = {}, // user-provided levers
  scenario = "generic", // startup|manufacturing|retail|generic
  stochastic = false // whether to add noise to revenue to model market volatility
}) {
  // get base records
  const business = businessId ? await Business.findByPk(businessId) : null;
  const strategy = strategyId ? await Strategy.findByPk(strategyId) : null;

  if (businessId && !business) throw new Error("Business not found");
  if (strategyId && !strategy) throw new Error("Strategy not found");

  // base starting values (fallbacks if business missing)
  let revenue = business ? Number(business.revenue) : Number(overrides.revenue || 1000);
  let cost = business ? Number(business.cost) : Number(overrides.cost || 500);
  const initialInvestment = Number(overrides.initialInvestment ?? business?.initialInvestment ?? 0);
  let cash = Number(overrides.cashBalance ?? business?.cashBalance ?? 0);

  // get strategy parameters (fallback)
  const growthRateBase = (strategy ? Number(strategy.growthRate) : Number(overrides.growthRate ?? 0.05));
  const costRateBase = (strategy ? Number(strategy.costRate) : Number(overrides.costRate ?? 0.02));

  // scenario defaults
  const scenarioDefaults = {
    startup: { growthRateBoost: 0.05, costVolatility: 0.15 },
    manufacturing: { growthRateBoost: 0.02, costVolatility: 0.08 },
    retail: { growthRateBoost: 0.03, costVolatility: 0.10 },
    generic: { growthRateBoost: 0.0, costVolatility: 0.1 }
  };
  const sDefaults = scenarioDefaults[scenario] || scenarioDefaults.generic;

  // debt handling: array of debts
  const debts = (overrides.debts || business?.debts || []).map(d => ({
    principal: Number(d.principal || d.amount || 0),
    annualRate: Number(d.annualRate || d.rate || 0),
    periodsToRepay: Number(d.periodsToRepay || d.term || 0),
    startPeriod: Number(d.startPeriod || 1),
    remaining: Number(d.principal || d.amount || 0)
  }));

  // one-time investments (array)
  const oneTimeInvestments = overrides.oneTimeInvestments || [];

  // marketing spend/price delta
  const marketingPerPeriod = Number(overrides.marketingPerPeriod || 0);
  const priceDeltaPercent = Number(overrides.priceDeltaPercent || 0); // e.g. 0.05 => +5% price increases revenue
  const extraRevenueFromMarketing = (m) => m * (overrides.marketingMultiplier ?? 2); // naive

  // store results per period
  const results = [];
  let cumulativeProfit = 0;

  // For IRR we will build cashFlows: assume CF0 = -initialInvestment, then cash flow per period = netProfit - debtPayment + investments?
  const cashFlows = [];
  cashFlows.push(-initialInvestment);

  for (let t = 1; t <= periods; t++) {
    // apply strategy growth and scenario boost
    const growthRate = growthRateBase + (overrides.growthRateDelta ?? 0) + (sDefaults.growthRateBoost || 0);
    const costRate = costRateBase + (overrides.costRateDelta ?? 0);

    // revenue growth
    revenue = revenue * (1 + growthRate);

    // price change applies multiplicatively
    revenue = revenue * (1 + priceDeltaPercent);

    // marketing adds revenue
    if (marketingPerPeriod > 0) {
      revenue += extraRevenueFromMarketing(marketingPerPeriod);
    }

    // optional stochastic noise
    if (stochastic) {
      // small random perturbation proportional to scenario volatility
      const vol = sDefaults.costVolatility || 0.1;
      const noise = (Math.random() * 2 - 1) * vol * revenue; // +/- vol*revenue
      revenue = Math.max(0, revenue + noise);
    }

    // cost growth
    cost = cost * (1 + costRate);
    // add marketing expense (counts as cost)
    cost += marketingPerPeriod;

    // apply any one-time investments scheduled this period
    let investmentThisPeriod = 0;
    for (const inv of oneTimeInvestments) {
      if (inv.period === t) {
        investmentThisPeriod += Number(inv.amount || 0);
      }
    }
    // profit before financing
    const profit = revenue - cost;

    // debt payments this period
    let debtPaymentTotal = 0;
    for (const d of debts) {
      if (t >= d.startPeriod && d.remaining > 0) {
        // simple equal principal + interest amortization (approx)
        const n = d.periodsToRepay;
        if (n <= 0) continue;
        const rate = d.annualRate; // treat as per-period for simplicity, user can scale
        // compute annuity payment
        const payment = (d.principal * rate) / (1 - Math.pow(1 + rate, -n));
        // don't overpay last period
        const paymentAmount = Math.min(payment, d.remaining + d.remaining * rate);
        d.remaining = Math.max(0, d.remaining - (paymentAmount - d.remaining * rate));
        debtPaymentTotal += paymentAmount;
      }
    }

    // net cash flow this period (profit - investment - debt payments)
    const netThisPeriod = profit - investmentThisPeriod - debtPaymentTotal;

    cash += netThisPeriod;

    cumulativeProfit += profit;

    // push for IRR and KPIs: here we treat cash flows as netThisPeriod (could include debt etc)
    cashFlows.push(netThisPeriod);

    results.push({
      period: t,
      revenue: Number(revenue),
      cost: Number(cost),
      profit: Number(profit),
      investment: Number(investmentThisPeriod),
      debtPayment: Number(debtPaymentTotal),
      netCashFlow: Number(netThisPeriod),
      cashBalance: Number(cash),
      cumulativeProfit: Number(cumulativeProfit),
      debts: debts.map(d => ({ remaining: d.remaining, principal: d.principal }))
    });
  }

  // KPIs
  const totalNetProfit = results.reduce((acc, r) => acc + r.profit, 0);
  const ROI = computeROI(totalNetProfit, initialInvestment);
  const irr = computeIRR(cashFlows);
  const breakEven = computeBreakEven(results.map(r => r.cumulativeProfit), initialInvestment);
  const risk = computeRiskIndex(results.map(r => r.profit));

  return {
    meta: {
      periods,
      scenario,
      overrides,
      initialInvestment,
      startingRevenue: Number(business?.revenue ?? overrides.revenue ?? revenue),
      startingCost: Number(business?.cost ?? overrides.cost ?? cost)
    },
    results,
    kpis: {
      totalNetProfit,
      ROI,
      IRR: irr,
      breakEvenPeriod: breakEven,
      riskIndex: risk.riskIndex,
      profitStdDev: risk.std,
      profitMean: risk.mean,
      cashFlows
    }
  };
}

module.exports = { runAdvancedSimulation };
