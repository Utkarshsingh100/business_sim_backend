// backend/models/Strategy.js
const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const Strategy = sequelize.define("Strategy", {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.STRING,
  },
  growthRate: {
    type: DataTypes.FLOAT, // % revenue growth
    defaultValue: 0.05,
  },
  costRate: {
    type: DataTypes.FLOAT, // % cost increase
    defaultValue: 0.02,
  }
});

module.exports = Strategy;
