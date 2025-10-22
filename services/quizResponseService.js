const { query } = require('../database');
const continueApiService = require('./continueApi');
const saveUserResponseService = require('./saveUserResponseService');
const certificateClaimService = require('./certificateClaimService');
const analysisService = require('./analysisService');
const createV2TestService = require('./createV2TestService');

class QuizResponseService {
  async submitQuizResponse(userData) {
    try {
      console.log('📝 Processing quiz response submission...');
      
      // Get user data from database
      const userQuery = `
        SELECT id, name, email, phone, subject, created_at
        FROM users 
        WHERE email = $1
        ORDER BY created_at DESC 
        LIMIT 1
      `;
      const userResult = await query(userQuery, [userData.email]);
      
      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }
      
      const user = userResult.rows[0];
      console.log('👤 Found user:', { id: user.id, name: user.name, email: user.email });
      
      // Get the most recent session for this user
      const sessionQuery = `
        SELECT id, certified_user_id, certified_token, certified_token_expires_at, created_at
        FROM sessions 
        WHERE user_id = $1
        ORDER BY created_at DESC 
        LIMIT 1
      `;
      const sessionResult = await query(sessionQuery, [user.id]);
      
      if (sessionResult.rows.length === 0) {
        throw new Error('No session found for user');
      }
      
      const session = sessionResult.rows[0];
      console.log('🎯 Found session:', { 
        id: session.id, 
        certified_user_id: session.certified_user_id,
        has_token: !!session.certified_token
      });
      
      // Use the provided certified_user_skill_id or fall back to session's certified_user_id
      const certifiedUserSkillId = userData.certified_user_skill_id || parseInt(session.certified_user_id);
      
      // Prepare data for continue API
      const continueApiData = {
        certified_user_skill_id: certifiedUserSkillId,
        email: user.email,
        phone_number: user.phone.startsWith('+') ? user.phone : `+${user.phone}`,
        name: user.name,
        password: user.email // Password is the email itself
      };
      
      console.log('📤 Calling continue API with data:', continueApiData);
      
      // Call the continue API
      const continueResult = await continueApiService.continueQuiz(continueApiData);
      
      console.log('📥 Continue API result:', continueResult);
      
      if (!continueResult.success) {
        console.error('Continue API failed:', continueResult);
        throw new Error(`Continue API failed: ${continueResult.message}`);
      }
      
      console.log('✅ Continue API successful, updating session token...');
      
      // Update the certified_token in sessions table
      const updateTokenQuery = `
        UPDATE sessions 
        SET certified_token = $1
        WHERE id = $2
        RETURNING id, certified_token
      `;
      const updateResult = await query(updateTokenQuery, [continueResult.token, session.id]);
      
      if (updateResult.rows.length === 0) {
        throw new Error('Failed to update session token');
      }
      
      console.log('✅ Session token updated successfully');
      
      // Now call save_user_response API
      console.log('📝 Calling save_user_response API...');
      
      // Get all questions for this session to build quiz attempt object
      const questionsQuery = `
        SELECT id, question_no, quiz_id, question, answer, correct_answer, answered, created_at
        FROM questions 
        WHERE session_id = $1
        ORDER BY question_no ASC
      `;
      const questionsResult = await query(questionsQuery, [session.id]);
      
      // Build quiz attempt object
      const quizAttemptArray = questionsResult.rows.map(q => {
        // Extract option text from question
        const questionText = q.question || '';
        
        // Parse options more accurately
        const options = {};
        const optionRegex = /([A-D])\.\s*([^\n]+)/g;
        let match;
        
        while ((match = optionRegex.exec(questionText)) !== null) {
          const optionLetter = match[1].toLowerCase();
          const optionText = match[2].trim();
          options[optionLetter] = optionText;
        }
        
        // Get user answer text based on the answer letter
        let userAnswerText = 'No answer';
        if (q.answer && options[q.answer.toLowerCase()]) {
          userAnswerText = options[q.answer.toLowerCase()];
        }
        
        const isCorrect = q.answer === q.correct_answer ? 1 : 0;
        
        return {
          quiz_id: parseInt(q.quiz_id),
          user_answer: userAnswerText,
          is_correct: isCorrect
        };
      });
      
      // Calculate quiz score and completion time
      const correctAnswers = quizAttemptArray.filter(q => q.is_correct === 1).length;
      const quizScore = Math.round((correctAnswers / quizAttemptArray.length) * 100);
      
      const sessionStartTime = new Date(session.created_at);
      const currentTime = new Date();
      const quizCompletionTimeInSeconds = Math.round((currentTime - sessionStartTime) / 1000);
      
      // Prepare save user response data
      const saveUserResponseData = {
        certified_user_skill_quiz_id: certifiedUserSkillId,
        quiz_attempt_object: quizAttemptArray,
        quiz_completion_time_in_seconds: quizCompletionTimeInSeconds,
        quiz_score: quizScore
      };
      
      // Call save_user_response API
      const saveResponseResult = await saveUserResponseService.saveUserResponse(saveUserResponseData);
      
      if (!saveResponseResult.success) {
        console.error('Save user response failed:', saveResponseResult);
        // Don't throw error, continue with certificate claim
      }
      
      console.log('✅ Save user response API completed');
      
      // Now call certificate claim API
      console.log('🏆 Calling certificate claim API...');
      
      const certificateResult = await certificateClaimService.claimCertificate(
        certifiedUserSkillId,
        continueResult.token
      );
      
      if (!certificateResult.success) {
        console.error('Certificate claim failed:', certificateResult);
        // Don't throw error, just log it
      }
      
      console.log('✅ Certificate claim API completed');
      
      // Now call create_v2_test API
      console.log('🎯 Calling create_v2_test API...');
      
      const createV2TestResult = await createV2TestService.createV2Test(
        continueResult.token,
        certifiedUserSkillId
      );
      
      if (!createV2TestResult.success) {
        console.error('Create V2 Test failed:', createV2TestResult);
        // Don't throw error, just log it
      }
      
      console.log('✅ Create V2 Test API completed');
      
      // Now call quiz analysis API
      console.log('📊 Calling quiz analysis API...');
      
      const analysisResult = await analysisService.getQuizAnalysis(
        certifiedUserSkillId,
        continueResult.token
      );
      
      if (!analysisResult.success) {
        console.error('Quiz analysis failed:', analysisResult);
        // Don't throw error, just log it
      }
      
      console.log('✅ Quiz analysis API completed');
      
      // Update session as quiz completed and analysis generated (only if analysis was successful)
      const analysisGenerated = analysisResult.success;
      const orderId = createV2TestResult.success && createV2TestResult.data ? createV2TestResult.data.id : null;
      const updateQuizCompletedQuery = `
        UPDATE sessions 
        SET quiz_completed = true, quiz_analysis_generated = $1, quiz_attempt_object = $2, order_id = $3
        WHERE id = $4
      `;
      await query(updateQuizCompletedQuery, [analysisGenerated, JSON.stringify(quizAttemptArray), orderId, session.id]);
      
      return {
        result: "success",
        message: 'Quiz response submitted successfully',
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone
          },
          session: {
            id: session.id,
            certified_user_id: session.certified_user_id,
            token_updated: true,
            quiz_completed: true,
            quiz_analysis_generated: analysisGenerated,
            order_id: orderId
          },
          quiz_attempt: quizAttemptArray,
          quiz_results: {
            score: quizScore,
            correct_answers: correctAnswers,
            total_questions: quizAttemptArray.length,
            completion_time_seconds: quizCompletionTimeInSeconds
          },
          save_user_response: saveResponseResult,
          certificate_claim: certificateResult,
          create_v2_test: createV2TestResult,
          quiz_analysis: analysisResult
        }
      };
      
    } catch (error) {
      console.error('❌ Error submitting quiz response:', error.message);
      throw new Error(`Failed to submit quiz response: ${error.message}`);
    }
  }
}

module.exports = new QuizResponseService();
