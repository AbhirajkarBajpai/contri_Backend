const mongoose = require('mongoose');

const GroupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members: [ {
    memberId: { type: mongoose.Schema.Types.ObjectId, required: true },
    memberType: { type: String, enum: ['User', 'TempUser'], required: true },
  },],
  expenses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Expense' }],
  groupSettelmentDetails: [
    {
      user1: { type: mongoose.Schema.Types.ObjectId },
      user2: { type: mongoose.Schema.Types.ObjectId },
      amount: { type: Number, required: true },
      isSettled: { type: String, default: "No" },
    },
  ],
});

module.exports = mongoose.model('Group', GroupSchema);
