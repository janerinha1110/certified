const { Pool } = require('pg');

async function addScenarioColumn() {
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
			WHERE table_name = 'questions' AND column_name = 'scenario'
		`;

		const checkResult = await pool.query(checkColumnQuery);

		if (checkResult.rows.length > 0) {
			console.log('✅ Column scenario already exists in questions table');
			return;
		}

		// Add the column as TEXT and nullable to avoid breaking existing flows
		const addColumnQuery = `
			ALTER TABLE questions ADD COLUMN scenario TEXT;
		`;

		await pool.query(addColumnQuery);
		console.log('✅ Successfully added scenario column to questions table');

		// Optional: add a descriptive comment for maintainers
		const addCommentQuery = `
			COMMENT ON COLUMN questions.scenario IS 'Optional scenario/context for the question. Nullable.';
		`;

		await pool.query(addCommentQuery);
		console.log('✅ Added comment to scenario column');

	} catch (error) {
		console.error('❌ Error adding scenario column:', error.message);
		throw error;
	} finally {
		await pool.end();
	}
}

addScenarioColumn()
	.then(() => {
		console.log('🎉 Migration completed successfully!');
		process.exit(0);
	})
	.catch((error) => {
		console.error('💥 Migration failed:', error.message);
		process.exit(1);
	});


