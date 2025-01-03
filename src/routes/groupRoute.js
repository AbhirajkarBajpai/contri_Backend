const express = require('express');
const groupController = require('../controllers/groupController');
const authController = require('../controllers/authController');

const router = express.Router();

router.use(authController.protect); 

router.post('/createGroup',groupController.createGroup);
router.post('/addMembers/:groupId',groupController.addGroupMembers);
router.post('/removeMember/:groupId',groupController.removeGroupMember);
router.post('/deleteGroup/:groupId',groupController.deleteGroup);
router.get('/groupDebts/:groupId',groupController.getGroupDebts);
router.get('/groupDetail/:groupId/:pageNo',groupController.getGroupDetails);


// router.use(authController.protect);  ---> this will be required at time of [profile update , password reset etc etc]

module.exports = router;