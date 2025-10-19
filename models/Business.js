// backend/models/Business.js
const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const Business = sequelize.define("Business", {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  revenue: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  cost: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  profit: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  }
});

module.exports = Business;
