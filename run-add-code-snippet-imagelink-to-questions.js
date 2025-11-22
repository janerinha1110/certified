const { Pool } = require('pg');

async function addCodeSnippetImageLinkColumn() {
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
			SELECT column_name, data_type, is_nullable
			FROM information_schema.columns 
			WHERE table_name = 'questions' AND column_name = 'code_snippet_imageLink'
		`;

		const checkResult = await pool.query(checkColumnQuery);

		if (checkResult.rows.length > 0) {
			console.log('✅ Column code_snippet_imageLink already exists in questions table');
			console.log('📋 Column details:', checkResult.rows[0]);
			return;
		}

		console.log('⚠️  Column code_snippet_imageLink does not exist. Adding it now...');

		// Add the column as TEXT and nullable to avoid breaking existing flows
		const addColumnQuery = `
			ALTER TABLE questions ADD COLUMN code_snippet_imageLink TEXT;
		`;

		await pool.query(addColumnQuery);
		console.log('✅ Successfully added code_snippet_imageLink column to questions table');

		// Optional: add a descriptive comment for maintainers
		const addCommentQuery = `
			COMMENT ON COLUMN questions.code_snippet_imageLink IS 'URL to code snippet image for cybersecurity questions. Nullable.';
		`;

		await pool.query(addCommentQuery);
		console.log('✅ Added comment to code_snippet_imageLink column');

	} catch (error) {
		console.error('❌ Error checking/adding code_snippet_imageLink column:', error.message);
		throw error;
	} finally {
		await pool.end();
	}
}

addCodeSnippetImageLinkColumn()
	.then(() => {
		console.log('🎉 Migration check completed successfully!');
		process.exit(0);
	})
	.catch((error) => {
		console.error('💥 Migration check failed:', error.message);
		process.exit(1);
	});

