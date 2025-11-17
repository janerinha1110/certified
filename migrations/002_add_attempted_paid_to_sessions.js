const { query, pool } = require('../database');

async function runMigration() {
  console.log('🚀 Running migration: 002_add_attempted_paid_to_sessions');
  try {
    console.log('🔧 Adding attempted column to sessions (if not exists)...');
    await query(`
      ALTER TABLE sessions
      ADD COLUMN IF NOT EXISTS attempted BOOLEAN DEFAULT FALSE
    `);

    console.log('🔧 Adding paid column to sessions (if not exists)...');
    await query(`
      ALTER TABLE sessions
      ADD COLUMN IF NOT EXISTS paid BOOLEAN DEFAULT FALSE
    `);

    console.log('🔄 Backfilling NULL attempted/paid values to FALSE...');
    await query(`UPDATE sessions SET attempted = FALSE WHERE attempted IS NULL`);
    await query(`UPDATE sessions SET paid = FALSE WHERE paid IS NULL`);

    console.log('✅ Setting NOT NULL constraints on attempted and paid columns...');
    await query(`ALTER TABLE sessions ALTER COLUMN attempted SET NOT NULL`);
    await query(`ALTER TABLE sessions ALTER COLUMN paid SET NOT NULL`);

    console.log('⚙️  Ensuring defaults remain FALSE for future inserts...');
    await query(`ALTER TABLE sessions ALTER COLUMN attempted SET DEFAULT FALSE`);
    await query(`ALTER TABLE sessions ALTER COLUMN paid SET DEFAULT FALSE`);

    console.log('💬 Adding comments to attempted and paid columns...');
    await query(`COMMENT ON COLUMN sessions.attempted IS 'Whether the session has been attempted.'`);
    await query(`COMMENT ON COLUMN sessions.paid IS 'Whether the session/order has been paid for.'`);

    console.log('✅ Migration completed successfully');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

runMigration();


