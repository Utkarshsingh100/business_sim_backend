require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

// DB + Models
const sequelize = require("./db");
const User = require("./models/User");
const Business = require("./models/Business");
const Transaction = require("./models/Transaction");
const Strategy = require("./models/Strategy");
const SimulationRun = require("./models/SimulationRun");
const { runSimulation } = require("./services/simulation");

// Optional if needed
const { Op } = require("sequelize");

// ---- ROUTES ----

// Health
app.get("/api/health", (req, res) => res.json({ ok: true, time: new Date() }));

// USERS
app.post("/api/users", async (req, res) => {
  const user = await User.create(req.body);
  res.json(user);
});
app.get("/api/users", async (req, res) => {
  res.json(await User.findAll());
});

// BUSINESS
app.post("/api/businesses", async (req, res) => {
  const business = await Business.create(req.body);
  res.json(business);
});
app.get("/api/businesses", async (req, res) => {
  res.json(await Business.findAll());
});

// TRANSACTIONS
app.post("/api/transactions", async (req, res) => {
  const tx = await Transaction.create(req.body);
  res.json(tx);
});
app.get("/api/transactions", async (req, res) => {
  res.json(await Transaction.findAll({ include: [Business] }));
});

// STRATEGIES
app.post("/api/strategies", async (req, res) => {
  const strat = await Strategy.create(req.body);
  res.json(strat);
});
app.get("/api/strategies", async (req, res) => {
  res.json(await Strategy.findAll());
});

// SINGLE SIMULATION
app.post("/api/simulate", async (req, res) => {
  try {
    const { businessId, strategyId, periods } = req.body;

    const results = await runSimulation(businessId, strategyId, periods);

    const savedRun = await SimulationRun.create({
      BusinessId: businessId,
      StrategyId: strategyId,
      results,
    });

    res.json({
      message: "Simulation completed and saved",
      simulationId: savedRun.id,
      results,
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

// VIEW ALL SIMULATIONS
app.get("/api/simulations", async (req, res) => {
  try {
    const runs = await SimulationRun.findAll({
      include: [Business, Strategy],
    });
    res.json(runs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch simulations" });
  }
});

// BUSINESS CRUD
app.put("/api/businesses/:id", async (req, res) => {
  const b = await Business.findByPk(req.params.id);
  if (!b) return res.status(404).json({ error: "Business not found" });
  await b.update(req.body);
  res.json(b);
});
app.delete("/api/businesses/:id", async (req, res) => {
  const b = await Business.findByPk(req.params.id);
  if (!b) return res.status(404).json({ error: "Business not found" });
  await b.destroy();
  res.json({ message: "Deleted successfully" });
});

// STRATEGY CRUD
app.put("/api/strategies/:id", async (req, res) => {
  const s = await Strategy.findByPk(req.params.id);
  if (!s) return res.status(404).json({ error: "Strategy not found" });
  await s.update(req.body);
  res.json(s);
});
app.delete("/api/strategies/:id", async (req, res) => {
  const s = await Strategy.findByPk(req.params.id);
  if (!s) return res.status(404).json({ error: "Strategy not found" });
  await s.destroy();
  res.json({ message: "Deleted successfully" });
});

// ROOT
app.get("/", (req, res) => {
  res.send("Backend API is running 🚀");
});

// HISTORY
app.get("/api/history", async (req, res) => {
  try {
    const runs = await SimulationRun.findAll({
      include: [Business, Strategy],
    });
    res.json(runs);
  } catch (err) {
    console.error("History fetch error:", err);
    res.status(500).json({ error: "Failed to fetch history" });
  }
});


// ---- START SERVER ----
const port = process.env.PORT || 3000;
sequelize.sync().then(() => {
  app.listen(port, () => console.log(`Backend running at http://localhost:${port}`));
});
