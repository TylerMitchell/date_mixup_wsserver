const { DataTypes } = require('sequelize');
const db = require('../db');

const Profile = db.define('profile', {
    screenName: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false
    },
    age: {
        type: DataTypes.INTEGER
    },
    gender: {
        type: DataTypes.STRING
    },
    bio: {
        type: DataTypes.TEXT
    }
});

module.exports = Profile;