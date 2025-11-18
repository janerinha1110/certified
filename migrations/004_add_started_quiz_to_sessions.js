const { query, pool } = require('../database');

async function runMigration() {
  console.log('🚀 Running migration: 004_add_started_quiz_to_sessions');
  try {
    console.log('🔧 Adding started_quiz column to sessions (if not exists)...');
    await query(`
      ALTER TABLE sessions
      ADD COLUMN IF NOT EXISTS started_quiz BOOLEAN DEFAULT FALSE
    `);

    console.log('🔄 Backfilling NULL started_quiz values to FALSE...');
    await query(`UPDATE sessions SET started_quiz = FALSE WHERE started_quiz IS NULL`);

    console.log('✅ Setting NOT NULL constraint on started_quiz column...');
    await query(`ALTER TABLE sessions ALTER COLUMN started_quiz SET NOT NULL`);

    console.log('⚙️  Ensuring default remains FALSE for future inserts...');
    await query(`ALTER TABLE sessions ALTER COLUMN started_quiz SET DEFAULT FALSE`);

    console.log('💬 Adding comment to started_quiz column...');
    await query(`COMMENT ON COLUMN sessions.started_quiz IS 'Whether the quiz has been started for this session.'`);

    console.log('✅ Migration completed successfully');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

runMigration();

