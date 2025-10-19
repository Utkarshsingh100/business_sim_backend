// backend/db.js
const { Sequelize } = require("sequelize");

// For now: SQLite (file saved in backend/database.sqlite)
const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: "database.sqlite"
});

module.exports = sequelize;
