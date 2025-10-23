const axios = require('axios');
const config = require('../config');

class GenerateQuizService {
  constructor() {
    this.baseURL = 'https://certified-new.learntube.ai/generate';
  }

  async generateQuiz(certifiedUserSkillId) {
    try {
      const url = this.baseURL;
      
      const headers = {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9,de;q=0.8',
        'Connection': 'keep-alive',
        'Content-Type': 'application/json',
        'Origin': 'https://certified.learntube.ai',
        'Referer': 'https://certified.learntube.ai/',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-site',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
        'sec-ch-ua': '"Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
        'sec-ch-ua-mobile': '?1',
        'sec-ch-ua-platform': '"Android"'
      };

      const data = {
        certified_user_skill_id: certifiedUserSkillId,
        is_new_ui: true
      };

      console.log('🌐 Calling generate quiz API for skill ID:', certifiedUserSkillId);

      const response = await axios.post(url, data, {
        headers,
        timeout: 15000, // 15 second timeout
        httpsAgent: new (require('https').Agent)({
          rejectUnauthorized: false // Ignore SSL certificate errors
        })
      });

      console.log('✅ Generate quiz API response received');
      return response.data;
    } catch (error) {
      console.error('❌ Generate Quiz API Error:', error.message);
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
      }
      throw new Error(`Failed to generate quiz: ${error.message}`);
    }
  }

  extractQuestions(quizData) {
    try {
      const questions = [];
      
      if (!quizData.data || !quizData.data.quiz_question_answer || !quizData.data.quiz_question_answer.questionaire) {
        throw new Error('Invalid quiz data structure');
      }

      const questionnaire = quizData.data.quiz_question_answer.questionaire;
      
      // Helper function to filter questions without code snippets
      const filterQuestionsWithoutCodeSnippets = (questionList, targetCount) => {
        const filteredQuestions = questionList.filter(q => {
          // Check if code_snippet is empty - must be null, undefined, empty string, or only whitespace
          const isEmptyCodeSnippet = !q.code_snippet || q.code_snippet.trim() === '';
          const hasCodeSnippet = !isEmptyCodeSnippet;
          
          if (hasCodeSnippet) {
            console.log(`⚠️  Skipping question ${q.q_id} - has code snippet: "${q.code_snippet.substring(0, 50)}..."`);
          }
          return isEmptyCodeSnippet; // Only include questions with empty code_snippet
        });
        
        // If we don't have enough questions, try to get more from the available pool
        if (filteredQuestions.length < targetCount) {
          console.log(`⚠️  Only found ${filteredQuestions.length} questions without code snippets, need ${targetCount}`);
          // Take all available questions without code snippets
          return filteredQuestions.slice(0, targetCount);
        }
        
        return filteredQuestions.slice(0, targetCount);
      };
      
      // Extract 5 easy questions (q_id 1-5) - skip those with code snippets
      if (questionnaire.easy && Array.isArray(questionnaire.easy)) {
        const easyQIds = [1, 2, 3, 4, 5];
        const easyQuestions = questionnaire.easy.filter(q => easyQIds.includes(q.q_id));
        const filteredEasyQuestions = filterQuestionsWithoutCodeSnippets(easyQuestions, 5);
        
        filteredEasyQuestions.forEach((q, index) => {
          questions.push({
            ...q,
            question_type: 'Easy',
            unique_quiz_id: `${q.q_id}` // Use just the q_id number
          });
        });
        console.log(`📋 Extracted ${filteredEasyQuestions.length} easy questions with q_ids: ${filteredEasyQuestions.map(q => q.q_id).join(', ')}`);
      }

      // Extract 3 medium questions (q_id 11-13) - skip those with code snippets
      if (questionnaire.medium && Array.isArray(questionnaire.medium)) {
        const mediumQIds = [11, 12, 13];
        const mediumQuestions = questionnaire.medium.filter(q => mediumQIds.includes(q.q_id));
        const filteredMediumQuestions = filterQuestionsWithoutCodeSnippets(mediumQuestions, 3);
        
        filteredMediumQuestions.forEach((q, index) => {
          questions.push({
            ...q,
            question_type: 'Medium',
            unique_quiz_id: `${q.q_id}` // Use just the q_id number
          });
        });
        console.log(`📋 Extracted ${filteredMediumQuestions.length} medium questions with q_ids: ${filteredMediumQuestions.map(q => q.q_id).join(', ')}`);
      }

      // Extract 2 hard questions (q_id 17-18) - skip those with code snippets
      if (questionnaire.hard && Array.isArray(questionnaire.hard)) {
        const hardQIds = [17, 18];
        const hardQuestions = questionnaire.hard.filter(q => hardQIds.includes(q.q_id));
        const filteredHardQuestions = filterQuestionsWithoutCodeSnippets(hardQuestions, 2);
        
        filteredHardQuestions.forEach((q, index) => {
          questions.push({
            ...q,
            question_type: 'Hard',
            unique_quiz_id: `${q.q_id}` // Use just the q_id number
          });
        });
        console.log(`📋 Extracted ${filteredHardQuestions.length} hard questions with q_ids: ${filteredHardQuestions.map(q => q.q_id).join(', ')}`);
      }

      const easyCount = questions.filter(q => q.question_type === 'Easy').length;
      const mediumCount = questions.filter(q => q.question_type === 'Medium').length;
      const hardCount = questions.filter(q => q.question_type === 'Hard').length;
      console.log(`📋 Extracted ${questions.length} questions (${easyCount} Easy, ${mediumCount} Medium, ${hardCount} Hard)`);
      
      // If we don't have exactly 10 questions, log a warning
      if (questions.length !== 10) {
        console.log(`⚠️  Warning: Expected 10 questions but got ${questions.length}. Some questions may have been skipped due to code snippets.`);
      }
      
      return questions;
    } catch (error) {
      console.error('❌ Error extracting questions:', error.message);
      throw new Error(`Failed to extract questions: ${error.message}`);
    }
  }
}

module.exports = new GenerateQuizService();
