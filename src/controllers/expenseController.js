const Expense = require("../models/Expense");
const Group = require("../models/Group");

exports.addExpense = async (req, res) => {
  try {
    const { groupId, amount, description, manualSplits, selectedUsers } =
      req.body;
    const createdBy = req.user.id;

    // Fetch the group
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found." });

    const members = group.members.map((member) => member.toString());

    // Validate selected users are group members
    const isValidUsers = selectedUsers.every((userId) =>
      members.includes(userId)
    );
    if (!isValidUsers)
      return res
        .status(400)
        .json({ message: "Invalid users selected for splitting." });

    // Validate manual splits against selected users
    const isValidSplit = manualSplits.every((split) =>
      selectedUsers.includes(split.user)
    );
    if (!isValidSplit)
      return res.status(400).json({ message: "Invalid manual split details." });

    const groupSettelmentDetails = group.groupSettelmentDetails || [];

    const splitDetails = calculateSplitWithManuals(
      amount,
      manualSplits,
      selectedUsers,
      createdBy
    );

    // managing entire group net split
    splitDetails.forEach(({ userPaid, user2, amount }) => {
      const existingSettlement = groupSettelmentDetails.find(
        (settlement) =>
          (settlement.user1.toString() === userPaid.toString() &&
            settlement.user2.toString() === user2.toString()) ||
          (settlement.user1.toString() === user2.toString() &&
            settlement.user2.toString() === userPaid.toString())
      );

      if (existingSettlement) {
        if (existingSettlement.user1.toString() === userPaid.toString()) {
          existingSettlement.amount += amount;
        } else {
          existingSettlement.amount -= amount;
        }
      } else {
        groupSettelmentDetails.push({
          user1: userPaid,
          user2: user2,
          amount,
        });
      }
    });

    // Filter out settlements with zero amount
    group.groupSettelmentDetails = groupSettelmentDetails.filter(
      (settlement) => settlement.amount !== 0
    );

    // Create the expense
    const expense = new Expense({
      group: groupId,
      createdBy,
      amount,
      description,
      splitDetails,
    });
    await expense.save();

    // Add the expense to the group
    group.expenses.push(expense._id);
    await group.save();

    res.status(201).json({ message: "Expense added successfully", expense });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

function calculateSplitWithManuals(
  amount,
  manualSplits,
  selectedUsers,
  paidBy
) {
  // Initialize split details with manual splits
  const splitDetails = manualSplits.map((split) => ({
    userPaid: paidBy,
    user2: split.user,
    amount: -split.amount, // Manual splits are considered as credits (negative)
  }));

  // Calculate the total amount already allocated via manual splits
  const totalManualAmount = manualSplits.reduce(
    (sum, split) => sum + split.amount,
    0
  );

  // Calculate the remaining amount to split (if `isInclude` is true)
  const remainingAmount = amount - totalManualAmount;

  if (manualSplits.some((split) => split.isInclude) && remainingAmount > 0) {
    // Calculate equal split for remaining amount among the selected users
    const equalSplitAmount = remainingAmount / selectedUsers.length;

    // Update split details for each selected user
    selectedUsers.forEach((userId) => {
      const existingSplit = splitDetails.find((split) => split.user === userId);
      if (existingSplit) {
        // If user already has a manual split, add the equal split to it
        existingSplit.amount -= equalSplitAmount;
      } else {
        // Otherwise, create a new split entry
        splitDetails.push({
          userPaid: paidBy,
          user2: split.user,
          amount: -equalSplitAmount,
        });
      }
    });
  }

  // Ensure each selected user has a split detail
  selectedUsers.forEach((userId) => {
    if (!splitDetails.find((split) => split.user === userId)) {
      splitDetails.push({ userPaid: paidBy, user2: split.user, amount: 0 });
    }
  });

  return splitDetails;
}

exports.resolveExpense = async (req, res) => {
  try {
    const { groupId, payingUserId, receivingUserId, amount } = req.body;

    // Fetch the group
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }

    // Check settlement details between users
    const settlement = group.groupSettelmentDetails.find(
      (detail) =>
        (detail.user1.toString() === payingUserId &&
          detail.user2.toString() === receivingUserId) ||
        (detail.user1.toString() === receivingUserId &&
          detail.user2.toString() === payingUserId)
    );

    if (!settlement) {
      return res
        .status(400)
        .json({ message: "No settlement exists between these users." });
    }

    // Adjust the settlement amount
    const isPayingUserUser1 = settlement.user1.toString() === payingUserId;
    const amountToSettle = Math.min(Math.abs(settlement.amount), amount);

    if (isPayingUserUser1) {
      settlement.amount -= amountToSettle;
    } else {
      settlement.amount += amountToSettle;
    }

    // Remove settlement if the amount becomes 0
    if (settlement.amount === 0) {
      group.groupSettelmentDetails = group.groupSettelmentDetails.filter(
        (detail) => detail !== settlement
      );
    }

    await group.save();

    res.status(200).json({
      message: "Settlement resolved successfully.",
      groupSettelmentDetails: group.groupSettelmentDetails,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
