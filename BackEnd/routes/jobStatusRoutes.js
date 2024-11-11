const express = require('express');
const router = express.Router();
const jobStatusController = require('../controllers/jobStatusController');

router.post('/status', jobStatusController.checkJobStatus);

module.exports = router;