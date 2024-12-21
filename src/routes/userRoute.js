const express = require('express');
const authController = require('../controllers/authController');
const userController = require('../controllers/userController');

const router = express.Router();

router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.get('/logout', authController.logout);
router.get('/isUserLoggedIn', authController.isLoggedIn);
router.use(authController.protect); 
router.get('/getUserGroups', userController.getUserGroups);

module.exports = router;