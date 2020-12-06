const Models = require("./");

Models.Profile.belongsTo(Models.User, {
    allowNull: false
});

Models.User.hasMany(Models.Profile, { onDelete: "CASCADE" });