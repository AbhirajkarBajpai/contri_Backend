const Group = require("../models/Group");
const User = require("../models/User");
const Expense = require("../models/Expense");

exports.createGroup = async (req, res) => {
  try {
    const { name, members } = req.body;
    const createdBy = req.user.id;

    const validMembers = await User.find({ _id: { $in: members } });
    if (validMembers.length !== members.length) {
      return res.status(400).json({ message: "Some members are invalid." });
    }

    const group = new Group({ name, createdBy, members });
    await group.save();

    await User.updateMany(
      { _id: { $in: members } },
      { $addToSet: { groups: group._id } } // $addToSet to prevent duplicates
    );

    res.status(201).json({ message: "Group created successfully", group });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.addGroupMembers = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { members } = req.body;

    // Fetch the group
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }

    // Fetch and validate new members
    const validMembers = await User.find({ _id: { $in: members } });
    if (validMembers.length !== members.length) {
      return res.status(400).json({ message: "Some members are invalid." });
    }

    // Check for duplicate members
    const existingMembers = group.members.map((member) => member.toString());
    const newMembers = members.filter(
      (memberId) => !existingMembers.includes(memberId)
    );

    if (newMembers.length === 0) {
      return res
        .status(400)
        .json({ message: "All members are already part of the group." });
    }

    // Add new members to the group
    group.members.push(...newMembers);
    await group.save();

    await User.updateMany(
      { _id: { $in: members } },
      { $addToSet: { groups: groupId } } // $addToSet to prevent duplicates
    );

    res.status(200).json({
      message: "New members added successfully.",
      members: group.members,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.removeGroupMember = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { memberId } = req.body;
    const userId = req.user.id; 
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }

    // Check if the requesting user is the creator of the group
    if (group.createdBy.toString() !== userId) {
      return res.status(403).json({
        message: "You are not authorized to remove members.",
      });
    }

    // Check if member exists in group
    const memberIndex = group.members.findIndex(
      (member) => member.toString() === memberId
    );

    if (memberIndex === -1) {
      return res
        .status(400)
        .json({ message: "Member not found in the group." });
    }

    // Remove the member from group
    group.members.splice(memberIndex, 1);

    // Remove the member's debts from the group settlement details
    group.groupSettelmentDetails = group.groupSettelmentDetails.filter(
      (debt) =>
        debt.user1.toString() !== memberId && debt.user2.toString() !== memberId
    );

    // Update the user's groups array
    await User.findByIdAndUpdate(memberId, {
      $pull: { groups: groupId },
    });

    // Save the group
    await group.save();

    res.status(200).json({
      message: "Member removed successfully, and debts cleared.",
      members: group.members,
      groupSettelmentDetails: group.groupSettelmentDetails,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }

    if (group.createdBy.toString() !== userId) {
      return res.status(403).json({
        message: "You are not authorized to delete this group.",
      });
    }
    // Remove the group from each member's groups array
    await User.updateMany(
      { _id: { $in: group.members } },
      { $pull: { groups: groupId } }
    );

    // Delete all expenses related to the group
    await Expense.deleteMany({ group: groupId });
    // Delete the group
    await group.deleteOne();
    res.status(200).json({ message: "Group deleted successfully." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getGroupDebts = async (req, res) => {
  try {
    const { groupId } = req.params;
    // Fetch the group with only the settlement details
    const group = await Group.findById(groupId)
      .select("groupSettelmentDetails")
      .lean();
    if (!group)
      return res
        .status(404)
        .json({ success: false, message: "Group not found." });

    const debts = group.groupSettelmentDetails || [];
    res.status(200).json({
      success: true,
      message: "Group final debts sent!.",
      data: debts,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getGroupDetails = async (req, res) => {
  try {
    const { groupId } = req.params;

    // Fetch the group with members populated
    const group = await Group.findById(groupId)
      .populate("members", "name email")
      .populate({
        path: "expenses",
        populate: {
          path: "splitDetails.userPaid splitDetails.user2", // Populate payer and receiver details in expenses
          select: "name email", // Include name and email of users in expense details
        },
      });

    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }

    // Formatting then sending
    res.status(200).json({
      message: "Group details fetched successfully.",
      group: {
        id: group._id,
        name: group.name,
        createdBy: group.createdBy,
        members: group.members,
        expenses: group.expenses,
        groupSettelmentDetails: group.groupSettelmentDetails,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
