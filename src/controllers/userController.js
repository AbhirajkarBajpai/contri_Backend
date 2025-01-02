const User = require('../models/User');

exports.getUserGroups = async (req, res) => {
  try {
    const userId = req.user.id; 

    const user = await User.findById(userId).populate({
      path: 'groups',
      populate: {
        path: 'members',
        select: 'name',
      },
    });

    if (!user || !user.groups || user.groups.length === 0) {
      return res.status(404).json({ message: 'No groups found for this user.', groups:[], });
    }

    res.status(200).json({
      message: 'User groups fetched successfully.',
      groups: user.groups.map((group) => ({
        id: group._id,
        name: group.name,
        createdBy: group.createdBy,
        members: group.members,
        expensesCount: group.expenses.length,
      })),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
