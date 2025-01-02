const mongoose = require('mongoose');

const ExpenseSchema = new mongoose.Schema({
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  description: { type: String },
  splitDetails: [
    {
      userPaid: { type: mongoose.Schema.Types.ObjectId },
      user2: { type: mongoose.Schema.Types.ObjectId },
      amount: { type: Number, required: true },
    },
  ],
  date: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Expense', ExpenseSchema);
