const { query, pool } = require('../database');

async function runMigration() {
  console.log('🚀 Running migration: 001_add_subject_to_sessions');
  try {
    // 1) Add subject column if missing
    console.log('🔧 Adding subject column to sessions (if not exists)...');
    await query('ALTER TABLE sessions ADD COLUMN IF NOT EXISTS subject TEXT');

    // 2) Backfill subject from users table
    console.log('🔄 Backfilling subject values from users...');
    await query(`
      UPDATE sessions s
      SET subject = u.subject
      FROM users u
      WHERE s.user_id = u.id
        AND (s.subject IS NULL OR s.subject = '')
    `);

    // 3) Validate no NULL subjects remain
    const nullCheck = await query('SELECT COUNT(*)::int AS cnt FROM sessions WHERE subject IS NULL OR subject = \''\'');
    const remainingNulls = nullCheck.rows[0].cnt;
    console.log('📊 Remaining sessions without subject:', remainingNulls);

    if (remainingNulls === 0) {
      // 4) Enforce NOT NULL constraint if safe
      console.log('✅ Setting subject column to NOT NULL');
      await query('ALTER TABLE sessions ALTER COLUMN subject SET NOT NULL');
    } else {
      console.log('⚠️ Skipping NOT NULL because some sessions are missing subject. Please fix and rerun.');
    }

    console.log('✅ Migration completed successfully');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

runMigration();


