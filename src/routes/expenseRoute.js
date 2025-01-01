const express = require('express');
const expenseController = require('../controllers/expenseController');
const authController = require('../controllers/authController');

const router = express.Router();

router.use(authController.protect);

router.post('/addExpense',expenseController.addExpense);
router.get('/getExpense/:expenseId',expenseController.getExpenseDetails);
router.post('/settel',expenseController.resolveExpense);
router.post('/reqSettel',expenseController.requestResolve);


// router.use(authController.protect);  ---> this will be required at time of [profile update , password reset etc etc]

module.exports = router;