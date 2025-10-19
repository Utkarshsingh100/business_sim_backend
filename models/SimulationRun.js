const { DataTypes } = require("sequelize");
const sequelize = require("../db");
const Business = require("./Business");
const Strategy = require("./Strategy");

const SimulationRun = sequelize.define("SimulationRun", {
  results: {
    type: DataTypes.JSON, // store whole simulation as JSON
    allowNull: false,
  }
});

// Relations
Business.hasMany(SimulationRun);
SimulationRun.belongsTo(Business);

Strategy.hasMany(SimulationRun);
SimulationRun.belongsTo(Strategy);

module.exports = SimulationRun;
