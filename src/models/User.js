const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const validator = require("validator");

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true, lowercase: true,
    validate: {
      validator: validator.isEmail, 
      message: "Please enter a valid email address"
    }
  },
  phoneNo: { type: Number, unique: true, required: true },
  password: {
    type: String,
    required: [true, "Please provide a password"],
    minlength: 8,
    select: false,
  },
  groups: [{ type: mongoose.Schema.Types.ObjectId, ref: "Group" }],
});

// Hash the password before saving
UserSchema.pre("save", async function (next) {
  // If the password hasn't been modified, move to the next middleware
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

UserSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

module.exports = mongoose.model("User", UserSchema);
