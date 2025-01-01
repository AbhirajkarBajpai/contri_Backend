const mongoose = require('mongoose');

const GroupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  expenses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Expense' }],
  groupSettelmentDetails: [
    {
      user1: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      user2: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      amount: { type: Number, required: true },
      isSettled: { type: String, default: "No" },
    },
  ],
});

module.exports = mongoose.model('Group', GroupSchema);
