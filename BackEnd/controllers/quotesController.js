const db = require('../config/db');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: 'smtp.mail.me.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    },
    tls: {
        rejectUnauthorized: true
    }
});

// GET all quotes
exports.getAllQuotes = (req, res) => {
    const sql = 'SELECT * FROM Quotes';
    db.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching quotes:', err);
            return res.status(500).send('Error fetching quotes');
        }
        res.json(results);
    });
};

// GET a specific quote by QuoteID
exports.getQuoteById = (req, res) => {
    const quoteId = req.params.id;
    const sql = 'SELECT * FROM Quotes WHERE QuoteID = ?';
    db.query(sql, [quoteId], (err, result) => {
        if (err) {
            console.error('Error fetching quote:', err);
            return res.status(500).send('Error fetching quote');
        }
        if (result.length === 0) {
            return res.status(404).send('Quote not found');
        }
        res.json(result[0]);
    });
};

// POST a new quote
exports.createQuote = async (req, res) => {
    try {
        // Parse form data
        let formData, customerInfo, quoteInfo;
        if (req.body.data) {
            formData = JSON.parse(req.body.data);
            const {
                firstName, lastName, phone, email,
                address1, address2, city, state, zipcode,
                hoaApproval, cityApproval, material, fenceLength
            } = formData;
            customerInfo = { firstName, lastName, phone, email, address1, address2, city, state, zipcode };
            quoteInfo = { hoaApproval, cityApproval, material, fenceLength };
        } else {
            const { CustomerID, QuoteDate, TotalAmount, Status, EmailSent, Completed } = req.body;
            if (!CustomerID || !QuoteDate || !TotalAmount || !Status || EmailSent === undefined || Completed === undefined) {
                return res.status(400).send('Missing required fields');
            }
            quoteInfo = { CustomerID, QuoteDate, TotalAmount, Status, EmailSent, Completed };
        }

        // Handle customer creation/update
        let customerId;
        if (customerInfo) {
            const checkCustomerSql = 'SELECT CustomerID FROM Customers WHERE Email = ?';
            const [customerResult] = await db.query(checkCustomerSql, [customerInfo.email]);

            if (customerResult.length > 0) {
                customerId = customerResult[0].CustomerID;
                const updateCustomerSql = `
                    UPDATE Customers 
                    SET FirstName = ?, LastName = ?, PhoneNumber = ?, 
                        Address = ?, City = ?, State = ?, ZipCode = ?
                    WHERE CustomerID = ?`;
                await db.query(updateCustomerSql, [
                    customerInfo.firstName, 
                    customerInfo.lastName, 
                    customerInfo.phone,
                    customerInfo.address1 + (customerInfo.address2 ? ' ' + customerInfo.address2 : ''),
                    customerInfo.city, 
                    customerInfo.state, 
                    customerInfo.zipcode,
                    customerId
                ]);
            } else {
                const insertCustomerSql = `
                    INSERT INTO Customers (FirstName, LastName, PhoneNumber, Email, 
                                        Address, City, State, ZipCode)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
                const [newCustomer] = await db.query(insertCustomerSql, [
                    customerInfo.firstName, 
                    customerInfo.lastName, 
                    customerInfo.phone, 
                    customerInfo.email,
                    customerInfo.address1 + (customerInfo.address2 ? ' ' + customerInfo.address2 : ''),
                    customerInfo.city, 
                    customerInfo.state, 
                    customerInfo.zipcode
                ]);
                customerId = newCustomer.insertId;
            }
        }

        // Process photos
        let photoPaths = [];
        if (req.files && req.files.length > 0) {
            photoPaths = req.files.map(file => file.filename);
        }

        // Create quote
        const insertQuoteSql = `
            INSERT INTO Quotes (
                CustomerID, QuoteDate, Status, EmailSent,
                MaterialType, FenceLength, HOAApproval, 
                CityApproval, PhotoPaths, Address, Address2
            ) VALUES (
                ?, CURDATE(), 'Pending', 0,
                ?, ?, ?, ?, ?,
                ?, ?
            )`;

        const quoteValues = [
            customerId,
            quoteInfo.material,
            quoteInfo.fenceLength,
            quoteInfo.hoaApproval,
            quoteInfo.cityApproval,
            photoPaths.join(','),
            customerInfo.address1,
            customerInfo.address2 || null
        ];

        // Insert quote and get the ID
        const [quoteResult] = await db.query(insertQuoteSql, quoteValues);
        const quoteId = quoteResult.insertId;

        // Generate and save reference number
        const referenceNumber = `QT-${new Date().getFullYear()}${String(quoteId).padStart(4, '0')}`;
        await db.query('UPDATE Quotes SET ReferenceNumber = ? WHERE QuoteID = ?', [referenceNumber, quoteId]);

        // Verify reference number was saved
        const [verifyRef] = await db.query('SELECT ReferenceNumber FROM Quotes WHERE QuoteID = ?', [quoteId]);
        
        if (!verifyRef[0]?.ReferenceNumber) {
            throw new Error('Failed to save reference number');
        }

        // Handle email sending
        if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
            try {
                const customerEmail = {
                    from: {
                        name: 'Blue Rhyno Fencing',
                        address: process.env.EMAIL_USER
                    },
                    to: customerInfo.email,
                    subject: 'Quote Request Confirmation - Blue Rhyno Fencing',
                    html: `
                        <h2>Thank you for your quote request!</h2>
                        <p>Dear ${customerInfo.firstName},</p>
                        <p>We have received your quote request for a ${quoteInfo.material} fence.</p>
                        <p>Your quote reference number is: ${referenceNumber}</p>
                        <h3>Details of your request:</h3>
                        <ul>
                            <li>Material: ${quoteInfo.material}</li>
                            <li>Fence Length: ${quoteInfo.fenceLength} meters</li>
                            <li>HOA Approval: ${quoteInfo.hoaApproval}</li>
                            <li>City Approval: ${quoteInfo.cityApproval}</li>
                        </ul>
                        <p>If you need to check the status of your quote, please visit our website and use your email and quote reference number.</p>
                    `
                };

                const businessEmail = {
                    from: {
                        name: 'Blue Rhyno Quote System',
                        address: process.env.EMAIL_USER
                    },
                    to: process.env.BUSINESS_EMAIL,
                    subject: `New Quote Request #${referenceNumber}`,
                    html: `
                        <h2>New Quote Request Received</h2>
                        <h3>Customer Information:</h3>
                        <ul>
                            <li>Name: ${customerInfo.firstName} ${customerInfo.lastName}</li>
                            <li>Email: ${customerInfo.email}</li>
                            <li>Phone: ${customerInfo.phone}</li>
                            <li>Address: ${customerInfo.address1} ${customerInfo.address2 || ''}</li>
                            <li>City: ${customerInfo.city}</li>
                            <li>State: ${customerInfo.state}</li>
                            <li>Zip: ${customerInfo.zipcode}</li>
                        </ul>
                        <h3>Project Details:</h3>
                        <ul>
                            <li>Material: ${quoteInfo.material}</li>
                            <li>Fence Length: ${quoteInfo.fenceLength} meters</li>
                            <li>HOA Approval: ${quoteInfo.hoaApproval}</li>
                            <li>City Approval: ${quoteInfo.cityApproval}</li>
                        </ul>
                        <p>Photos have been uploaded and saved.</p>
                    `
                };

                await Promise.all([
                    transporter.sendMail(customerEmail),
                    transporter.sendMail(businessEmail)
                ]);

                await db.query('UPDATE Quotes SET EmailSent = 1 WHERE QuoteID = ?', [quoteId]);
            } catch (emailError) {
                console.error('Error sending emails:', emailError);
            }
        }

        // Send successful response
        res.status(200).json({
            success: true,
            message: 'Quote request submitted successfully',
            quoteId: quoteId,
            referenceNumber: referenceNumber
        });

    } catch (error) {
        console.error('Error in createQuote:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process quote request'
        });
    }
};

// PUT to update a quote
exports.updateQuote = (req, res) => {
    const quoteId = req.params.id;
    const { Status, TotalAmount } = req.body;

    if (!TotalAmount || !Status) {
        return res.status(400).send('Missing required fields');
    }

    const sql = 'UPDATE Quotes SET `Status` = ?, `TotalAmount` = ? WHERE QuoteID = ?';
    db.query(sql, [Status, TotalAmount, quoteId], (err, result) => {
        if (err) {
            console.error('Error updating quote:', err);
            return res.status(500).send('Error updating quote');
        }
        if (result.affectedRows === 0) {
            return res.status(404).send('Quote not found');
        }
        res.send('Quote updated');
    });
};

// DELETE a quote
exports.deleteQuote = (req, res) => {
    const quoteId = req.params.id;

    const queryDb = (sql, params) => {
        return new Promise((resolve, reject) => {
            db.query(sql, params, (err, result) => {
                if (err) return reject(err);
                resolve(result);
            });
        });
    };

    queryDb('DELETE FROM Projects WHERE QuoteID = ?', [quoteId])
        .then(() => {
            return queryDb('SELECT InvoiceID FROM Invoice WHERE QuoteID = ?', [quoteId]);
        })
        .then((invoiceResult) => {
            const invoiceIds = invoiceResult.map((row) => row.InvoiceID);
            if (invoiceIds.length === 0) {
                return queryDb('DELETE FROM Quotes WHERE QuoteID = ?', [quoteId]);
            } else {
                return queryDb('DELETE FROM Payments WHERE InvoiceID IN (?)', [invoiceIds])
                    .then(() => queryDb('DELETE FROM Invoice WHERE QuoteID = ?', [quoteId]))
                    .then(() => queryDb('DELETE FROM Quotes WHERE QuoteID = ?', [quoteId]));
            }
        })
        .then((result) => {
            if (result.affectedRows === 0) {
                return res.status(404).send('Quote not found');
            }
            res.send('Quote, related projects, invoices, and payments deleted');
        })
        .catch((err) => {
            console.error('Error deleting quote:', err);
            res.status(500).send('Error deleting quote and related records');
        });
};

// Email construction for rejection of a quote 
exports.rejectQuote = async (req, res) => {
    const { quoteId } = req.params;
    const { reason } = req.body;

    try {
        // Get quote and customer details
        const [quote] = await db.query(`
            SELECT q.*, c.Email, c.FirstName, c.LastName 
            FROM Quotes q
            JOIN Customers c ON q.CustomerID = c.CustomerID
            WHERE q.QuoteID = ?
        `, [quoteId]);

        if (quote.length === 0) {
            return res.status(404).json({ success: false, message: 'Quote not found' });
        }

        // Update quote status
        await db.query(
            'UPDATE Quotes SET Status = ?, RejectionReason = ? WHERE QuoteID = ?',
            ['Rejected', reason, quoteId]
        );

        // Send email notification
        const emailContent = `
            <h2>Quote Request Update</h2>
            <p>Dear ${quote[0].FirstName},</p>
            <p>We regret to inform you that we are unable to proceed with your fence quote request at this time.</p>
            <p><strong>Reason:</strong> ${reason}</p>
            <h3>Quote Details:</h3>
            <ul>
                <li>Reference Number: ${quote[0].ReferenceNumber}</li>
                <li>Material Type: ${quote[0].MaterialType}</li>
                <li>Fence Length: ${quote[0].FenceLength} ft</li>
                <li>Location: ${quote[0].Address}${quote[0].Address2 ? ', ' + quote[0].Address2 : ''}</li>
            </ul>
            <p>We appreciate your interest in our services and encourage you to contact us for future projects.</p>
            <p>Best regards,<br>Blue Ryno Fencing Team</p>
        `;

        await sendEmail({
            to: quote[0].Email,
            subject: 'Blue Ryno Fencing - Quote Request Update',
            html: emailContent
        });

        res.json({ success: true, message: 'Quote rejected and customer notified' });

    } catch (error) {
        console.error('Error rejecting quote:', error);
        res.status(500).json({ success: false, message: 'Error rejecting quote' });
    }
};