// backend/services/advancedSimulationHelpers.js
function computeIRR(cashFlows, guessLow = -0.9999, guessHigh = 10, iterations = 80, tol = 1e-6) {
  function npv(rate) {
    return cashFlows.reduce((acc, cf, t) => acc + cf / Math.pow(1 + rate, t), 0);
  }
  let low = guessLow, high = guessHigh;
  let fLow = npv(low), fHigh = npv(high);
  if (fLow * fHigh > 0) return null;
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

module.exports = { computeIRR };
