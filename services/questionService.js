const { query } = require('../database');

class QuestionService {
  async createQuestions(questions, sessionId, userId) {
    try {
      console.log(`📝 Creating ${questions.length} questions for session ${sessionId}`);
      
      // First, verify that the session exists and belongs to the user
      const sessionCheckQuery = `
        SELECT id, user_id
        FROM sessions
        WHERE id = $1 AND user_id = $2
      `;
      const sessionCheck = await query(sessionCheckQuery, [sessionId, userId]);
      
      if (sessionCheck.rows.length === 0) {
        console.error(`❌ Session ${sessionId} not found or doesn't belong to user ${userId}`);
        throw new Error(`Session ${sessionId} not found or doesn't belong to user ${userId}`);
      }
      
      console.log(`✅ Verified session ${sessionId} exists and belongs to user ${userId}`);
      
      const createdQuestions = [];
      
      for (let i = 0; i < questions.length; i++) {
        const questionData = questions[i];
        // Format the question with options
        const formattedQuestion = this.formatQuestion(questionData, i + 1, questions.length);
        
        const questionQuery = `
          INSERT INTO questions(
            session_id, 
            user_id, 
            question, 
            answer, 
            correct_answer, 
            answered,
            question_no,
            quiz_id,
            scenario
          ) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING id, session_id, user_id, question, answer, correct_answer, answered, created_at, question_no, quiz_id, scenario
        `;
        
        // Build scenario only for question 6 (first Medium) and 9 (first Hard)
        let scenarioValue = null;
        const textContext = questionData.text_context || questionData.textContext || null;
        const isScenarioPosition = (i + 1 === 6) || (i + 1 === 9);
        if (isScenarioPosition && textContext) {
          // Store only text_context
          scenarioValue = String(textContext);
        }

        try {
          const result = await query(questionQuery, [
            sessionId,
            userId,
            formattedQuestion,
            '', // answer starts empty
            questionData.correct_answer,
            false, // answered starts as false
            i + 1, // question number (1-based)
            questionData.unique_quiz_id || questionData.q_id || null, // unique quiz_id or fallback to q_id
            scenarioValue
          ]);
          
          createdQuestions.push(result.rows[0]);
          console.log(`📝 Created question ${i + 1}/${questions.length} (question_no: ${i + 1}, quiz_id: ${questionData.unique_quiz_id || questionData.q_id}): ${questionData.question.substring(0, 50)}...`);
        } catch (insertError) {
          // Check if it's a foreign key constraint violation
          if (insertError.message && insertError.message.includes('foreign key constraint')) {
            console.error(`❌ Foreign key constraint violation when inserting question ${i + 1}. Session ${sessionId} may have been deleted.`);
            // Re-verify session exists
            const recheckSession = await query(sessionCheckQuery, [sessionId, userId]);
            if (recheckSession.rows.length === 0) {
              throw new Error(`Session ${sessionId} was deleted during question insertion. Cannot continue.`);
            } else {
              // Session exists, but foreign key still fails - might be a different issue
              throw new Error(`Foreign key constraint violation: ${insertError.message}`);
            }
          } else {
            throw insertError;
          }
        }
      }
      
      console.log(`✅ Successfully created ${createdQuestions.length} questions`);
      return createdQuestions;
    } catch (error) {
      console.error('Error creating questions:', error);
      throw new Error(`Failed to create questions: ${error.message}`);
    }
  }

  formatQuestion(questionData, questionNo, totalQuestions) {
    // Format the question with options as requested
    const { formatted_question, option_a, option_b, option_c, option_d } = questionData;
    
    // Use formatted_question if available (includes code snippets), otherwise fallback to question
    const questionText = formatted_question || questionData.question;
    
    // Generate progress emojis - green squares for answered, grey squares for pending
    // For question 1: 🟩⬜⬜⬜⬜⬜⬜⬜⬜⬜ (1 green, 9 grey)
    // For question 2: 🟩🟩⬜⬜⬜⬜⬜⬜⬜⬜ (2 green, 8 grey)
    const progressEmojis = '🟩'.repeat(questionNo) + '⬜'.repeat(totalQuestions - questionNo);
    
    return `*Question ${questionNo} / ${totalQuestions}*

${progressEmojis}

🧠 ${questionText}

A) ${option_a}

B) ${option_b}

C) ${option_c}

D) ${option_d}`;
  }

  async getQuestionsBySession(sessionId) {
    try {
      const questionsQuery = `
        SELECT id, session_id, user_id, question, answer, correct_answer, answered, created_at, updated_at, question_no, quiz_id
        FROM questions 
        WHERE session_id = $1 
        ORDER BY question_no ASC
      `;
      
      const result = await query(questionsQuery, [sessionId]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching questions:', error);
      throw new Error(`Failed to fetch questions: ${error.message}`);
    }
  }

  async updateQuestionAnswer(questionId, answer) {
    try {
      const updateQuery = `
        UPDATE questions 
        SET answer = $1, answered = true, updated_at = NOW()
        WHERE id = $2
        RETURNING id, question, answer, correct_answer, answered
      `;
      
      const result = await query(updateQuery, [answer, questionId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error updating question answer:', error);
      throw new Error(`Failed to update question answer: ${error.message}`);
    }
  }

  async saveAnswerAndGetNext(questionId, answer, sessionId) {
    try {
      // First, update the current question with the answer
      const updateQuery = `
        UPDATE questions 
        SET answer = $1, answered = true, updated_at = NOW()
        WHERE id = $2 AND session_id = $3
        RETURNING id, question_no, question, answer, correct_answer, answered
      `;
      
      const updateResult = await query(updateQuery, [answer, questionId, sessionId]);
      
      if (updateResult.rows.length === 0) {
        throw new Error('Question not found or session mismatch');
      }
      
      const currentQuestion = updateResult.rows[0];
      console.log(`📝 Answer saved for question ${currentQuestion.question_no}: ${answer}`);
      
      // Get the next question in order
      const nextQuestionQuery = `
        SELECT id, question_no, question, answer, correct_answer, answered, scenario
        FROM questions 
        WHERE session_id = $1 AND question_no = $2
        ORDER BY question_no ASC
      `;
      
      const nextQuestionNo = currentQuestion.question_no + 1;
      const nextQuestionResult = await query(nextQuestionQuery, [sessionId, nextQuestionNo]);
      
      if (nextQuestionResult.rows.length === 0) {
        // No more questions - quiz is complete
        console.log('🎉 Quiz completed! All questions answered.');
        return {
          status: 'complete',
          question: '',
          question_id: '',
          current_question_no: currentQuestion.question_no,
          total_questions: 10
        };
      }
      
      const nextQuestion = nextQuestionResult.rows[0];
      console.log(`📝 Next question retrieved: question_no ${nextQuestion.question_no}`);
      
      return {
        status: 'pending',
        question: nextQuestion.question,
        question_id: nextQuestion.id,
        question_no: nextQuestion.question_no,
        current_question_no: currentQuestion.question_no,
        total_questions: 10,
        scenario: (nextQuestion.question_no === 6 || nextQuestion.question_no === 9)
          ? (nextQuestion.scenario && String(nextQuestion.scenario).trim() !== '' ? nextQuestion.scenario : null)
          : null,
        has_scenario: (nextQuestion.question_no === 6 || nextQuestion.question_no === 9)
          ? !!(nextQuestion.scenario && String(nextQuestion.scenario).trim() !== '')
          : false
      };
      
    } catch (error) {
      console.error('Error saving answer and getting next question:', error);
      throw new Error(`Failed to save answer: ${error.message}`);
    }
  }
}

module.exports = new QuestionService();
