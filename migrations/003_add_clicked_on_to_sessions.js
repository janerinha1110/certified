const { query, pool } = require('../database');

async function runMigration() {
  console.log('🚀 Running migration: 003_add_clicked_on_to_sessions');
  try {
    // 1) Create enum type if it doesn't exist
    console.log('🔧 Creating clicked_on_enum type (if not exists)...');
    await query(`
      DO $$ BEGIN
        CREATE TYPE clicked_on_enum AS ENUM ('unlock_cert', 'know_more');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // 2) Add clicked_on column to sessions table
    console.log('🔧 Adding clicked_on column to sessions (if not exists)...');
    await query(`
      ALTER TABLE sessions
      ADD COLUMN IF NOT EXISTS clicked_on clicked_on_enum
    `);

    // 3) Add comment to the column
    console.log('💬 Adding comment to clicked_on column...');
    await query(`
      COMMENT ON COLUMN sessions.clicked_on IS 'Tracks which button was clicked: unlock_cert or know_more'
    `);

    console.log('✅ Migration completed successfully');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

runMigration();

