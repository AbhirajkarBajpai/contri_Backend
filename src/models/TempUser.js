const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const TempUserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phoneNo: { type: Number, unique: true, required: true },
  groups: [{ type: mongoose.Schema.Types.ObjectId, ref: "Group" }],
});

module.exports = mongoose.model("TempUser", TempUserSchema);
