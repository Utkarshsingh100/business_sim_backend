// backend/models/User.js
const { DataTypes } = require("sequelize");
const sequelize = require("../db");

const User = sequelize.define("User", {
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  balance: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  }
});

module.exports = User;
