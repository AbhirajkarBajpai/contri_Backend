const { promisify } = require("util");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Group = require("../models/Group");
const TempUser = require("../models/TempUser");
const catchAsync = require("../utils/CatchAsync");

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);
  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: true,
    sameSite: "None",
  };
  // if (process.env.NODE_ENV === "production") cookieOptions.secure = true;

  res.cookie("jwt", token, cookieOptions);

  // Remove password from output
  user.password = undefined;

  res.status(statusCode).json({
    status: "success",
    token,
    data: {
      user,
    },
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  if (req.body.password.length < 8) {
    return res.status(400).json({
      status: "fail",
      message: "Password must be at least eight characters long",
    });
  }

  console.log("data recieved", req.body);

  const tempUser = await TempUser.findOne({ phoneNo: req.body.phoneNo });

  let assignedGroups = [];
  if (tempUser) {
    assignedGroups = tempUser.groups;
  }

  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    phoneNo: req.body.phoneNo,
    password: req.body.password,
    groups: assignedGroups,
  });

  if (tempUser) {
    await Group.updateMany(
      { _id: { $in: assignedGroups } },
      { $addToSet: { members: newUser._id } } // Add the new user ID.
    );
    await Group.updateMany(
      { _id: { $in: assignedGroups } },
      { $pull: { members: tempUser._id } } // Remove the temporary user ID.
    );
    await TempUser.deleteOne({ _id: tempUser._id });
    console.log(`Temporary user with ID ${tempUser._id} removed.`);
  }
  createSendToken(newUser, 201, res);
});

// exports.login = catchAsync(async (req, res, next) => {
//   const { email, password } = req.body;
//   if (!email || !password) {
//     return res.status(404).json({
//       status: "fail",
//       message: "Please provide email and password!",
//     });
//   }
//   const user = await User.findOne({ email }).select("+password");
//   if (!user || !(await user.correctPassword(password, user.password))) {
//     return res.status(404).json({
//       status: "fail",
//       message: "Incorrect email or password",
//     });
//   }
//   createSendToken(user, 200, res);
// });

exports.login = catchAsync(async (req, res, next) => {
  const { emailOrPhoneNo, password } = req.body;
  if (!emailOrPhoneNo || !password) {
    return res.status(400).json({
      status: "fail",
      message: "Please provide email/phone number and password!",
    });
  }

  // Determine if the input is an email or phone number
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailOrPhoneNo);

  // Find the user based on email or phone number
  const query = isEmail
    ? { email: emailOrPhoneNo }
    : { phoneNo: emailOrPhoneNo };
  const user = await User.findOne(query).select("+password");
  if (!user) {
    return res.status(404).json({
      status: "fail",
      message: "Email/PhoneNo not found",
    });
  }

  const isPassCorr = await user.correctPassword(password, user.password);

  if (!isPassCorr) {
    return res.status(400).json({
      status: "fail",
      message: "password incorrect!",
    });
  }
  createSendToken(user, 200, res);
});

exports.logout = (req, res) => {
  res.cookie("jwt", "loggedout", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
    secure: true,
    sameSite: "None",
  });
  console.log("I am reached to logout");
  res.status(200).json({ status: "success" });
};

exports.protect = catchAsync(async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return res.status(401).json({
      status: "fail",
      message: "You are Not Logged In Please Log In to Access!",
    });
  }
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  // Check if user still exists
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return res.status(401).json({
      status: "fail",
      message: "The User Belonging To This Token Do No Longer Exist!",
    });
  }

  // Check if user changed password after the token was issued
  // if (currentUser.changedPasswordAfter(decoded.iat)) {
  //   return res.status(401).json({
  //     status: "fail",
  //     message: "User Recently Changed Password , Login Again!",
  //   });
  // }

  // GRANT ACCESS TO PROTECTED ROUTE
  req.user = currentUser;
  res.locals.user = currentUser;
  next();
});

exports.isLoggedIn = async (req, res, next) => {
  if (req.cookies.jwt) {
    try {
      // Verify token
      const decoded = await promisify(jwt.verify)(
        req.cookies.jwt,
        process.env.JWT_SECRET
      );

      // Finding userId
      const currentUser = await User.findById(decoded.id);
      if (!currentUser) {
        return res.status(400).json({ message: "User not found." });
      }

      // Check if the user changed the password after the token was issued
      // if (currentUser.changedPasswordAfter(decoded.iat)) {
      //   return res.status(400).json({ message: "Password changed. Please log in again." });
      // }

      console.log("Successfully Logged In");
      return res
        .status(200)
        .json({ userId: currentUser._id, user: currentUser });
    } catch (err) {
      console.log(err);
      return res
        .status(400)
        .json({ message: "Invalid token. Please log in again." });
    }
  }
  // If no JWT token
  return res.status(400).json({ message: "User not logged in." });
};

// exports.isLoggedIn = async (req, res, next) => {
//   if (req.cookies.jwt) {
//     try {
//       const decoded = await promisify(jwt.verify)(
//         req.cookies.jwt,
//         process.env.JWT_SECRET
//       );

//       const currentUser = await User.findById(decoded.id);
//       if (!currentUser) {
//         return next();
//       }

//       //Check if user changed password after the token was issued
//       if (currentUser.changedPasswordAfter(decoded.iat)) {
//         return next();
//       }

//       // THERE IS A LOGGED IN USER
//       console.log("Successfully Logged In");
//       res.locals.user = currentUser;
//       return next();
//     } catch (err) {
//       return next();
//     }
//   }
//   next();
// };
