import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const { Pool } = pkg;

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT),
  
  // ✅ SSL ADDED: AWS RDS strictly requires encrypted connections
  ssl: {
    rejectUnauthorized: false
  },
  
  // ✅ Keep these stability settings to prevent timeouts on big AI requests
  connectionTimeoutMillis: 15000, 
  idleTimeoutMillis: 30000,       
  keepAlive: true                 
});

// ✅ NEW: Test the database connection on server startup
pool.connect((err, client, release) => {
  if (err) {
    console.error('🚨 CRITICAL: Failed to connect to AWS RDS Database!');
    console.error('Check your .env credentials and ensure your AWS Security Group allows inbound traffic on port 5432.');
    console.error('Error details:', err.message);
  } else {
    console.log('✅ Successfully connected to AWS RDS PostgreSQL Database!');
    release(); // Release the client back to the pool
  }
});

// Handle unexpected errors on idle clients
pool.on('error', (err) => {
  console.error('🚨 Unexpected DB error:', err);
});

export default pool;