const { Pool } = require('pg');

async function addOrderIdColumn() {
  const pool = new Pool({
    host: 'aws-1-us-east-2.pooler.supabase.com',
    port: 6543,
    user: 'postgres.eyjtbudtwfzkxypnixsg',
    password: 'tG#esRKbVA6m-7p',
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔗 Connecting to database...');
    
    // Check if column already exists
    const checkColumnQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'sessions' AND column_name = 'order_id'
    `;
    
    const checkResult = await pool.query(checkColumnQuery);
    
    if (checkResult.rows.length > 0) {
      console.log('✅ Column order_id already exists in sessions table');
      return;
    }
    
    // Add the column
    const addColumnQuery = `
      ALTER TABLE sessions ADD COLUMN order_id INTEGER;
    `;
    
    await pool.query(addColumnQuery);
    console.log('✅ Successfully added order_id column to sessions table');
    
    // Add comment
    const addCommentQuery = `
      COMMENT ON COLUMN sessions.order_id IS 'Order ID returned from create_v2_test API response';
    `;
    
    await pool.query(addCommentQuery);
    console.log('✅ Added comment to order_id column');
    
  } catch (error) {
    console.error('❌ Error adding order_id column:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

addOrderIdColumn()
  .then(() => {
    console.log('🎉 Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration failed:', error.message);
    process.exit(1);
  });
