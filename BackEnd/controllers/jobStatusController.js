const db = require('../config/db');

exports.checkJobStatus = async (req, res) => {
    try {
        const { referenceNumber, email } = req.body;

        // Query using our JobStatusView
        const [results] = await db.query(`
            SELECT * FROM JobStatusView 
            WHERE ReferenceNumber = ? AND Email = ?
        `, [referenceNumber, email]);

        if (results.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No job found with the provided reference number and email'
            });
        }

        res.json({
            success: true,
            data: results[0]
        });

    } catch (error) {
        console.error('Error checking job status:', error);
        res.status(500).json({
            success: false,
            message: 'Error checking job status'
        });
    }
};