const { query } = require('../database');
const axios = require('axios');

class ReTriggerService {
  constructor() {
    this.apiUrl = 'https://xgfy-czuw-092q.m2.xano.io/api:Jb3ejqkw/re-trigger';
  }

  async checkAndTriggerReTriggerAPI() {
    try {
      console.log('🕐 [Re-Trigger Cron] Starting check for sessions created 5 minutes ago...');

      // Optimization: First check if any sessions exist in the target time window
      const countQuery = `
        SELECT COUNT(*)::int AS session_count
        FROM sessions s
        WHERE s.created_at >= NOW() - INTERVAL '6 minutes'
          AND s.created_at < NOW() - INTERVAL '5 minutes'
          AND s.re_trigger_api_called_at IS NULL
      `;

      const countResult = await query(countQuery);
      const sessionCount = countResult.rows[0]?.session_count || 0;

      if (sessionCount === 0) {
        console.log('✅ [Re-Trigger Cron] No sessions found in the 5-6 minute window. Skipping processing.');
        return { processed: 0, triggered: 0, errors: 0 };
      }

      console.log(`📊 [Re-Trigger Cron] Found ${sessionCount} session(s) in the target time window. Processing...`);

      // Query sessions created between 5-6 minutes ago
      // Join with users to get name and phone
      // Left join with questions to check if first question exists and is answered
      const sessionsQuery = `
        SELECT 
          s.id AS session_id,
          s.user_id,
          u.name,
          u.phone,
          s.created_at AS session_created_at,
          q.id AS first_question_id,
          q.answered AS first_question_answered
        FROM sessions s
        INNER JOIN users u ON s.user_id = u.id
        LEFT JOIN questions q ON s.id = q.session_id AND q.question_no = 1
        WHERE s.created_at >= NOW() - INTERVAL '6 minutes'
          AND s.created_at < NOW() - INTERVAL '5 minutes'
          AND s.re_trigger_api_called_at IS NULL
          AND (q.id IS NULL OR q.answered = false)
        ORDER BY s.created_at ASC
      `;

      const sessionsResult = await query(sessionsQuery);
      const sessions = sessionsResult.rows;

      if (sessions.length === 0) {
        console.log('✅ [Re-Trigger Cron] No sessions found that need re-trigger (all have answered first question or already processed).');
        return { processed: 0, triggered: 0, errors: 0 };
      }

      console.log(`📋 [Re-Trigger Cron] Found ${sessions.length} session(s) that need re-trigger API call.`);

      let triggeredCount = 0;
      let errorCount = 0;

      // Process each session
      for (const session of sessions) {
        try {
          const { session_id, name, phone, session_created_at } = session;

          // Validate required fields
          if (!phone || !name) {
            console.error(`⚠️  [Re-Trigger Cron] Skipping session ${session_id}: missing phone or name`, {
              phone: phone || 'MISSING',
              name: name || 'MISSING'
            });
            errorCount++;
            continue;
          }

          console.log(`📞 [Re-Trigger Cron] Calling re-trigger API for session ${session_id} (user: ${name}, phone: ${phone})...`);

          // Call the external re-trigger API
          const response = await axios.post(
            this.apiUrl,
            {
              phone: phone,
              name: name
            },
            {
              headers: {
                'Content-Type': 'application/json'
              },
              timeout: 10000 // 10 second timeout
            }
          );

          // Check if API call was successful
          if (response.status === 200 || response.status === 201) {
            // Update the session to mark that re-trigger API has been called
            const updateQuery = `
              UPDATE sessions
              SET re_trigger_api_called_at = NOW()
              WHERE id = $1
            `;
            await query(updateQuery, [session_id]);

            console.log(`✅ [Re-Trigger Cron] Successfully called re-trigger API for session ${session_id}`);
            triggeredCount++;
          } else {
            console.error(`⚠️  [Re-Trigger Cron] Unexpected response status ${response.status} for session ${session_id}`);
            errorCount++;
          }
        } catch (error) {
          console.error(`❌ [Re-Trigger Cron] Error processing session ${session.session_id}:`, error.message);
          if (error.response) {
            console.error(`   Response status: ${error.response.status}`);
            console.error(`   Response data:`, error.response.data);
          }
          errorCount++;
          // Continue processing other sessions even if one fails
        }
      }

      console.log(`✅ [Re-Trigger Cron] Completed. Processed: ${sessions.length}, Triggered: ${triggeredCount}, Errors: ${errorCount}`);
      return {
        processed: sessions.length,
        triggered: triggeredCount,
        errors: errorCount
      };
    } catch (error) {
      console.error('❌ [Re-Trigger Cron] Fatal error in checkAndTriggerReTriggerAPI:', error.message);
      console.error('   Stack:', error.stack);
      return {
        processed: 0,
        triggered: 0,
        errors: 1
      };
    }
  }
}

module.exports = new ReTriggerService();

