const Expense = require("../models/Expense");
const Group = require("../models/Group");

exports.addExpense = async (req, res) => {
  try {
    const { groupId, amount, description, manualSplits, selectedUsers } =
      req.body;
    const createdBy = req.user.id;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found." });

    const members = group.members.map((member) => member.memberId.toString());

    const isValidUsers = selectedUsers.every((userId) =>
      members.includes(userId)
    );

    if (!isValidUsers)
      return res
        .status(400)
        .json({ message: "Invalid users selected for splitting." });

    const isValidSplit = manualSplits.every((split) => {
      return selectedUsers.includes(split.user);
    });
    if (!isValidSplit)
      return res.status(400).json({ message: "Invalid manual split details." });

    const groupSettelmentDetails = group.groupSettelmentDetails || [];

    const splitDetails = calculateSplitWithManuals(
      amount,
      manualSplits,
      selectedUsers,
      createdBy
    );

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
          if (existingSettlement.isSettled === "Yes") {
            existingSettlement.amount = amount;
            existingSettlement.isSettled = "No";
          } else {
            existingSettlement.amount += amount;
          }
        } else {
          if (existingSettlement.isSettled === "Yes") {
            existingSettlement.amount = -amount;
            existingSettlement.isSettled = "No";
          } else {
            existingSettlement.amount -= amount;
          }
        }
      } else {
        groupSettelmentDetails.push({
          user1: userPaid,
          user2: user2,
          amount,
        });
      }
    });

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
  const splitDetails = manualSplits.map((split) => ({
    userPaid: paidBy,
    user2: split.user,
    amount: -split.amount,
  }));

  const totalManualAmount = manualSplits.reduce(
    (sum, split) => sum + split.amount,
    0
  );

  const remainingAmount = amount - totalManualAmount;

  if (remainingAmount > 0) {
    const totalCurrInclUser =
      selectedUsers.length -
      manualSplits.filter((split) => !split.isInclude).length;
    const equalSplitAmount = remainingAmount / totalCurrInclUser;
    selectedUsers.forEach((userId) => {
      if (
        manualSplits.some((split) => split.user === userId && split.isInclude)
      ) {
        const existingSplit = splitDetails.find(
          (split) => split.user2 === userId
        );
        existingSplit.amount -= equalSplitAmount;
      } else if (!manualSplits.some((split) => split.user === userId)) {
        splitDetails.push({
          userPaid: paidBy,
          user2: userId,
          amount: -equalSplitAmount,
        });
      } else {
        console.log("something Wrong!");
      }
    });
  }

  return splitDetails;
}

exports.getExpenseDetails = async (req, res) => {
  try {
    const expenseId = req.params.expenseId;
    const expense = await Expense.findById(expenseId);
    if (!expense) {
      return res.status(404).json({ message: "Requested Expense Not Found!" });
    }
    res.status(200).json({
      message: "Expense fetched successfully.",
      data: {
        description: expense.description,
        createdBy: expense.createdBy,
        amount: expense.amount,
        splitDetails: expense.splitDetails,
        date: expense.date,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

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
    // const isPayingUserUser1 = settlement.user1.toString() === payingUserId;
    // const amountToSettle = Math.min(Math.abs(settlement.amount), amount);

    if (settlement.isSettled === "No" || settlement.isSettled === "Requested") {
      settlement.isSettled = "Yes";
    } else {
      return res.status(200).json({
        message: "Settlement resolved Already!",
      });
    }

    // Remove settlement if the amount becomes 0
    // if (settlement.amount === 0) {
    //   group.groupSettelmentDetails = group.groupSettelmentDetails.filter(
    //     (detail) => detail !== settlement
    //   );
    // }

    await group.save();

    res.status(200).json({
      message: "Settlement resolved successfully.",
      groupSettelmentDetails: group.groupSettelmentDetails,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.requestResolve = async (req, res) => {
  try {
    const { groupId, payingUserId, receivingUserId } = req.body;

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

    if (settlement.isSettled === "No") {
      settlement.isSettled = "Requested";
    } else {
      return res.status(200).json({
        message: "Settlement either resolved or requested Already!",
      });
    }

    await group.save();

    res.status(200).json({
      message: "Settlement resolved requested successfully.",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteExpense = async (req, res) => {
  try {
    const expenseId = req.params.expenseId;
    const expense = await Expense.findById(expenseId);
    if (!expense) {
      return res.status(404).json({ message: "Requested Expense Not Found!" });
    }
    const groupId = expense.group;
    const group = await Group.findById(groupId);
    if(!group) return res.status(400).json({message:"Group Not Found"});
    const expenseSplit = expense.splitDetails;
    const groupSettelmentDetails = group.groupSettelmentDetails || [];

    expenseSplit.forEach(({ userPaid, user2, amount }) => {
      const existingSettlement = groupSettelmentDetails.find(
        (settlement) =>
          (settlement.user1.toString() === userPaid.toString() &&
            settlement.user2.toString() === user2.toString()) ||
          (settlement.user1.toString() === user2.toString() &&
            settlement.user2.toString() === userPaid.toString())
      );

      if (existingSettlement) {
        if (existingSettlement.user1.toString() === userPaid.toString()) {
          if (
            existingSettlement.isSettled === "Yes" ||
            existingSettlement.isSettled === "Requested"
          ) {
            console.log("already Settled or requested");
          } else {
            existingSettlement.amount -= amount;
          }
        } else {
          if (
            existingSettlement.isSettled === "Yes" ||
            existingSettlement.isSettled === "Requested"
          ) {
            console.log("already Settled or requested");
          } else {
            existingSettlement.amount += amount;
          }
        }
      }
    });

    group.groupSettelmentDetails = groupSettelmentDetails.filter(
      (settlement) => settlement.amount !== 0
    );

    group.expenses = group.expenses.filter(
      (exp) => exp._id.toString() !== expense._id.toString()
    );
    await group.save();
    await expense.deleteOne();
    res.status(200).json({
      message: "Expense Successfully Deleted!",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
