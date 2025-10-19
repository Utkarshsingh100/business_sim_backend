// backend/services/simulation.js
const Business = require("../models/Business");
const Strategy = require("../models/Strategy");

async function runSimulation(businessId, strategyId, periods = 12) {
  const business = await Business.findByPk(businessId);
  const strategy = await Strategy.findByPk(strategyId);

  if (!business || !strategy) throw new Error("Invalid business or strategy");

  let results = [];
  let revenue = business.revenue;
  let cost = business.cost;

  for (let t = 1; t <= periods; t++) {
    revenue = revenue * (1 + strategy.growthRate);
    cost = cost * (1 + strategy.costRate);
    let profit = revenue - cost;

    results.push({ period: t, revenue, cost, profit });
  }

  return results;
}

module.exports = { runSimulation };
