const Group = require("../models/Group");
const User = require("../models/User");
const Expense = require("../models/Expense");
const TempUser = require("../models/TempUser");
const redisClient = require("../../redisClient");

const createOrFetchTempUser = async (name, phoneNo) => {
  try {
    if (!name || !phoneNo) {
      return { message: "Name and Phone Number are required." };
    }
    let tempUser = await TempUser.findOne({ phoneNo });
    if (tempUser) {
      return {
        message: "User already exists.",
        userId: tempUser._id,
      };
    }
    tempUser = new TempUser({
      name,
      phoneNo,
      groups: [],
    });

    const savedUser = await tempUser.save();
    return {
      message: "TempUser created successfully!",
      userId: savedUser._id,
    };
  } catch (error) {
    console.error("Error handling TempUser:", error);
    return {
      message: "An error occurred while processing the TempUser.",
      error: error.message,
    };
  }
};

exports.createGroup = async (req, res) => {
  try {
    const { name, members } = req.body;
    const createdBy = req.user.id;
    if (!name || !members || members.length === 0) {
      return res
        .status(400)
        .json({ message: "Group name and members are required." });
    }
    const memberIds = [];
    memberIds.push({ memberId: createdBy, memberType: "User" });
    for (const member of members) {
      const { name: name, phone } = member;
      if (!name || !phone) {
        return res
          .status(400)
          .json({ message: "Each member must have a name and phone number." });
      }
      let user = await User.findOne({ phoneNo: phone });
      if (user) {
        memberIds.push({ memberId: user._id, memberType: "User" });
      } else {
        const tempUserResponse = await createOrFetchTempUser(name, phone);
        if (tempUserResponse.error) {
          return res.status(500).json({
            message: "Error creating or fetching TempUser.",
            error: tempUserResponse.error,
          });
        }
        memberIds.push({
          memberId: tempUserResponse.userId,
          memberType: "TempUser",
        });
      }
    }
    const group = new Group({ name, createdBy, members: memberIds });
    await group.save();
    await User.updateMany(
      { _id: { $in: memberIds.map((m) => m.memberId) } },
      { $addToSet: { groups: group._id } }
    );
    await TempUser.updateMany(
      { _id: { $in: memberIds.map((m) => m.memberId) } },
      { $addToSet: { groups: group._id } }
    );
    res.status(201).json({ message: "Group created successfully", group });
  } catch (error) {
    console.error("Error creating group:", error);
    res.status(500).json({
      message: "An error occurred while creating the group.",
      error: error.message,
    });
  }
};

// exports.createGroup = async (req, res) => {
//   try {
//     const { name, members } = req.body;
//     const createdBy = req.user.id;

//     const validMembers = await User.find({ _id: { $in: members } });
//     if (validMembers.length !== members.length) {
//       return res.status(400).json({ message: "Some members are invalid." });
//     }

//     const group = new Group({ name, createdBy, members });
//     await group.save();

//     await User.updateMany(
//       { _id: { $in: members } },
//       { $addToSet: { groups: group._id } }
//     );

//     res.status(201).json({ message: "Group created successfully", group });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

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

    await User.updateMany(
      { _id: { $in: group.members.map((m) => m.memberId) } },
      { $pull: { groups: groupId } }
    );

    await TempUser.updateMany(
      { _id: { $in: group.members.map((m) => m.memberId) } },
      { $pull: { groups: groupId } }
    );

    await Expense.deleteMany({ group: groupId });
    await group.deleteOne();

    //Delete group data from Redis
    const groupExpenseKey = `GroupExpenseInfo:${groupId}`;
    const groupInfoKey = `GroupInfo:${groupId}`;

    const groupExpenseExists = await redisClient.exists(groupExpenseKey);
    if (groupExpenseExists) {
      await redisClient.del(groupExpenseKey);
    }
    const groupInfoExists = await redisClient.exists(groupInfoKey);
    if (groupInfoExists) {
      await redisClient.del(groupInfoKey);
    }

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
    const { groupId, pageNo } = req.params;
    const limit = 5;
    const page = parseInt(pageNo) || 1;
    const skip = (page - 1) * limit;

    // Redis Keys
    const groupExpenseKey = `GroupExpenseInfo:${groupId}`;
    const groupInfoKey = `GroupInfo:${groupId}`;

    const [cachedGroupExpenses, cachedGroupInfo] = await Promise.all([
      redisClient.get(groupExpenseKey),
      redisClient.get(groupInfoKey),
    ]);

    if (cachedGroupExpenses && cachedGroupInfo) {
      console.log("fetch from cache");
      const groupExpenseInfo = JSON.parse(cachedGroupExpenses);
      const groupInfo = JSON.parse(cachedGroupInfo);
      const currPageExpenses = groupExpenseInfo.expenses.slice(
        skip,
        skip + limit
      );
      const totalExpenses = groupExpenseInfo.expenses.length;
      const totalPages = Math.ceil(totalExpenses / limit);

      return res.status(200).json({
        message: "Group details fetched successfully (from cache).",
        group: {
          ...groupInfo,
          expenses: currPageExpenses,
          groupSettelmentDetails: groupExpenseInfo.groupSettelmentDetails,
        },
        pagination: {
          currentPage:
            currPageExpenses.length > 0 ? page : page === 1 ? page : page - 1,
          totalPages,
          totalExpenses,
        },
      });
    }

    // If not  in cache
    const group = await Group.findById(groupId)
      .populate("createdBy", "name")
      .populate({
        path: "expenses",
      });

    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }

    const totalExpenses = group.expenses.length;
    const totalPages = Math.ceil(totalExpenses / limit);
    const currPageExpenses = group.expenses.slice(skip, skip + limit);

    let groupmembers = await Promise.all(
      group.members.map(async (member) => {
        const model = member.memberType === "User" ? User : TempUser;
        return await model.findById(member.memberId, "name");
      })
    );

    const groupExpenseInfo = {
      groupSettelmentDetails: group.groupSettelmentDetails,
      expenses: group.expenses,
    };

    const Info = { ...groupExpenseInfo, expenses: currPageExpenses };

    const groupInfo = {
      id: group._id,
      name: group.name,
      createdBy: group.createdBy,
      members: groupmembers,
    };

    await Promise.all([
      redisClient.set(groupExpenseKey, JSON.stringify(groupExpenseInfo), {
        EX: 1800,
      }),
      redisClient.set(groupInfoKey, JSON.stringify(groupInfo), { EX: 1800 }),
    ]);

    res.status(200).json({
      message: "Group details fetched successfully (from DB).",
      group: {
        ...groupInfo,
        ...Info,
      },
      pagination: {
        currentPage:
          currPageExpenses.length > 0 ? page : page === 1 ? page : page - 1,
        totalPages,
        totalExpenses,
      },
    });
  } catch (error) {
    console.error("Error in getGroupDetails:", error);
    res.status(500).json({ message: error.message });
  }
};

// exports.getGroupDetails = async (req, res) => {
//   try {
//     const { groupId, pageNo } = req.params;
//     console.log(pageNo);
//     const limit = 5;
//     const page = parseInt(pageNo) || 1;
//     const skip = (page - 1) * limit;

//     // Fetch group details
//     const group = await Group.findById(groupId)
//       .populate("createdBy", "name")
//       .populate({
//         path: "expenses",
//         populate: {
//           path: "splitDetails.userPaid splitDetails.user2",
//           select: "name",
//         },
//       });

//     if (!group) {
//       return res.status(404).json({ message: "Group not found." });
//     }

//     const totalExpenses = group.expenses.length;
//     const totalPages = Math.ceil(totalExpenses / limit);

//     const currPageExpenses = group.expenses.slice(skip, skip + limit);

//     // Fetch group members
//     let groupmembers = await Promise.all(
//       group.members.map(async (member) => {
//         const model = member.memberType === "User" ? User : TempUser;
//         return await model.findById(member.memberId, "name");
//       })
//     );

//     // Return group details with pagination info
//     res.status(200).json({
//       message: "Group details fetched successfully.",
//       group: {
//         id: group._id,
//         name: group.name,
//         createdBy: group.createdBy,
//         members: groupmembers,
//         expenses: currPageExpenses,
//         groupSettelmentDetails: group.groupSettelmentDetails,
//       },
//       pagination: {
//         currentPage:
//           currPageExpenses.length > 0 ? page : page === 1 ? page : page - 1,
//         totalPages,
//         totalExpenses,
//       },
//     });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };
