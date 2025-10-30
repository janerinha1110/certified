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
      
      // Helper function to process all questions (including those with code snippets)
      const processAllQuestions = (questionList) => {
        return questionList.map(q => {
          // Check if code_snippet exists and has content
          const hasCodeSnippet = q.code_snippet && q.code_snippet.trim() !== '';
          
          if (hasCodeSnippet) {
            console.log(`📝 Question ${q.q_id} includes code snippet: "${q.code_snippet.substring(0, 50)}..."`);
            // Add code snippet to the question text
            q.formatted_question = `${q.question}\n\n\`\`\`\n${q.code_snippet}\n\`\`\``;
          } else {
            q.formatted_question = q.question;
          }
          
          return q;
        });
      };
      
      // Collect all available questions (including those with code snippets)
      let allEasyQuestions = [];
      let allMediumQuestions = [];
      let allHardQuestions = [];
      
      // Extract easy questions (q_id 1-5)
      if (questionnaire.easy && Array.isArray(questionnaire.easy)) {
        const easyQIds = [1, 2, 3, 4, 5];
        const easyQuestions = questionnaire.easy.filter(q => easyQIds.includes(q.q_id));
        allEasyQuestions = processAllQuestions(easyQuestions);
        console.log(`📋 Found ${allEasyQuestions.length} easy questions (including those with code snippets)`);
      }

      // Extract medium questions (q_id 11-13)
      if (questionnaire.medium && Array.isArray(questionnaire.medium)) {
        const mediumQIds = [11, 12, 13];
        const mediumQuestions = questionnaire.medium.filter(q => mediumQIds.includes(q.q_id));
        allMediumQuestions = processAllQuestions(mediumQuestions);
        console.log(`📋 Found ${allMediumQuestions.length} medium questions (including those with code snippets)`);
      }

      // Extract hard questions (q_id 17-18)
      if (questionnaire.hard && Array.isArray(questionnaire.hard)) {
        const hardQIds = [17, 18];
        const hardQuestions = questionnaire.hard.filter(q => hardQIds.includes(q.q_id));
        allHardQuestions = processAllQuestions(hardQuestions);
        console.log(`📋 Found ${allHardQuestions.length} hard questions (including those with code snippets)`);
      }

      // Enforce exact distribution and order: 1-5 Easy, 6-8 Medium, 9-10 Hard
      const targetTotal = 10;
      const easyCount = Math.min(5, allEasyQuestions.length);
      const mediumCount = Math.min(3, allMediumQuestions.length);
      const hardCount = Math.min(2, allHardQuestions.length);
      
      const totalPlanned = easyCount + mediumCount + hardCount;
      if (totalPlanned !== targetTotal) {
        console.log(`⚠️  Planned distribution is ${totalPlanned} (Easy ${easyCount}, Medium ${mediumCount}, Hard ${hardCount}). Some categories may have insufficient questions.`);
      }
      
      // Add questions to the final array
      allEasyQuestions.slice(0, easyCount).forEach((q, index) => {
        questions.push({
          ...q,
          question_type: 'Easy',
          unique_quiz_id: `${q.q_id}`
        });
      });
      
      allMediumQuestions.slice(0, mediumCount).forEach((q, index) => {
        questions.push({
          ...q,
          question_type: 'Medium',
          unique_quiz_id: `${q.q_id}`
        });
      });
      
      allHardQuestions.slice(0, hardCount).forEach((q, index) => {
        questions.push({
          ...q,
          question_type: 'Hard',
          unique_quiz_id: `${q.q_id}`
        });
      });

      console.log(`📋 Final distribution (ordered): ${easyCount} Easy (1-5), ${mediumCount} Medium (6-8), ${hardCount} Hard (9-10) = ${questions.length} total questions`);
      
      // If we still don't have exactly 10 questions, log a warning
      if (questions.length !== targetTotal) {
        console.log(`⚠️  Warning: Could only get ${questions.length} questions (target: ${targetTotal})`);
      }
      
      return questions;
    } catch (error) {
      console.error('❌ Error extracting questions:', error.message);
      throw new Error(`Failed to extract questions: ${error.message}`);
    }
  }
}

module.exports = new GenerateQuizService();
