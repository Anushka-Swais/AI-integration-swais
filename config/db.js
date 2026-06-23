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
  
  // ❌ SSL REMOVED: Your server explicitly does not support it
  
  // ✅ Keep these stability settings to prevent timeouts on big AI requests
  connectionTimeoutMillis: 15000, 
  idleTimeoutMillis: 30000,       
  keepAlive: true                 
});

pool.on('error', (err) => {
  console.error('🚨 Unexpected DB error:', err);
});

export default pool;