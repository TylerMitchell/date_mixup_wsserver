const { DataTypes } = require('sequelize');
const db = require('../db');

const User = db.define('user', {
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    passwordhash: {
        type: DataTypes.STRING
    },
    firstName: {
        type: DataTypes.STRING,
        allowNull: true
    },
    lastName: {
        type: DataTypes.STRING,
        allowNull: true
    },
    isOrganizer: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
});

module.exports = User;