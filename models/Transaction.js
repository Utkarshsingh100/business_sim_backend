// backend/models/Transaction.js
const { DataTypes } = require("sequelize");
const sequelize = require("../db");
const Business = require("./Business");

const Transaction = sequelize.define("Transaction", {
  type: {
    type: DataTypes.ENUM("income", "expense"),
    allowNull: false,
  },
  amount: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  description: {
    type: DataTypes.STRING,
  }
});

// Relation: One Business → Many Transactions
Business.hasMany(Transaction);
Transaction.belongsTo(Business);

module.exports = Transaction;
