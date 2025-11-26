const { query, pool } = require('../database');

async function runMigration() {
  console.log('🚀 Running migration: 005_add_re_trigger_tracking_to_sessions');
  try {
    // Add re_trigger_api_called_at column if missing
    console.log('🔧 Adding re_trigger_api_called_at column to sessions (if not exists)...');
    await query('ALTER TABLE sessions ADD COLUMN IF NOT EXISTS re_trigger_api_called_at TIMESTAMP');

    console.log('✅ Migration completed successfully');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

runMigration();

