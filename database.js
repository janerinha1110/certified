const { Pool } = require('pg');
const config = require('./config');

// Create PostgreSQL connection pool
const pool = new Pool(config.supabase);

// Test database connection
pool.on('connect', (client) => {
  console.log('✅ Connected to Supabase PostgreSQL database');
  console.log('📊 Database:', client.database);
  console.log('🏠 Host:', client.host);
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
  console.error('🔍 Error details:', {
    code: err.code,
    errno: err.errno,
    syscall: err.syscall,
    hostname: err.hostname
  });
  // Don't exit the process - let it handle errors gracefully
  console.log('⚠️  Continuing despite database error...');
});

// Test connection on startup (non-blocking)
const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('🧪 Testing database connection...');
    
    // Set timezone to IST (Asia/Kolkata) for this connection
    await client.query("SET timezone = 'Asia/Kolkata'");
    console.log('🕐 Database timezone set to IST (Asia/Kolkata)');
    
    const result = await client.query('SELECT NOW() as current_time');
    console.log('✅ Database connection test successful:', result.rows[0].current_time);
    client.release();
  } catch (error) {
    console.error('❌ Database connection test failed:', error.message);
    console.error('🔍 Connection details:', {
      host: config.supabase.host,
      port: config.supabase.port,
      database: config.supabase.database,
      user: config.supabase.user
    });
    console.log('⚠️  Continuing without database connection test...');
    // Don't exit - let the server start and handle errors gracefully
  }
};

// Run connection test asynchronously (don't block server startup)
setTimeout(testConnection, 1000);

// Verify questions table exists
const verifyQuestionsTable = async () => {
  try {
    console.log('🔍 Verifying questions table...');
    
    // Check if questions table exists and has the expected columns
    const tableCheck = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'questions' 
      ORDER BY ordinal_position
    `);
    
    if (tableCheck.rows.length > 0) {
      console.log('✅ Questions table found with columns:', tableCheck.rows.map(r => r.column_name).join(', '));
    } else {
      console.log('⚠️  Questions table not found - will be created when needed');
    }
    
  } catch (error) {
    console.error('❌ Questions table verification failed:', error.message);
  }
};

// Verify questions table after connection test
setTimeout(verifyQuestionsTable, 2000);

// Helper function to execute queries with retry logic
// Sets timezone to IST for each query to ensure all timestamps are in IST
const query = async (text, params, retries = 3) => {
  const start = Date.now();
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const client = await pool.connect();
      try {
        // Set timezone to IST for this query session
        await client.query("SET timezone = 'Asia/Kolkata'");
        
        const res = await client.query(text, params);
        const duration = Date.now() - start;
        console.log('Executed query', { text, duration, rows: res.rowCount });
        return res;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error(`Database query error (attempt ${attempt}/${retries}):`, error.message);
      
      if (attempt === retries) {
        console.error('All retry attempts failed');
        throw error;
      }
      
      // Wait before retrying (exponential backoff)
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

module.exports = { pool, query };
