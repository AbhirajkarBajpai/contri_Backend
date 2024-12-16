const express = require('express');
const authController = require('../controllers/authController');
const userController = require('../controllers/userController');

const router = express.Router();

router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.get('/logout', authController.logout);
router.get('/isUserLoggedIn', authController.isLoggedIn);
router.get('/getUserGroups', userController.getUserGroups);

// router.use(authController.protect);  ---> this will be required at time of [profile update , password reset etc etc]

module.exports = router;