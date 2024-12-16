const express = require('express');
const expenseController = require('../controllers/expenseController');

const router = express.Router();

router.post('/addExpense',expenseController.addExpense);
router.post('/settel',expenseController.resolveExpense);


// router.use(authController.protect);  ---> this will be required at time of [profile update , password reset etc etc]

module.exports = router;