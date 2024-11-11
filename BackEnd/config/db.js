const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'cis3368.c3o2cmgcysp1.us-east-2.rds.amazonaws.com',
  user: 'admin',
  password: 'd0ntfa!lm3bro0',
  database: 'BlueRynoProjectDB_Test',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});


module.exports = pool;
