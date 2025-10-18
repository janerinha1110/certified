const axios = require('axios');

class AnalysisService {
  constructor() {
    this.baseURL = 'https://certified-new.learntube.ai/analysis';
  }

  async getQuizAnalysis(certifiedUserSkillQuizId, authToken) {
    try {
      console.log('📊 Calling Quiz Analysis API...');
      console.log('📤 Request params:', {
        certified_user_skill_quiz_id: certifiedUserSkillQuizId
      });

      const response = await axios.get(this.baseURL, {
        params: {
          certified_user_skill_quiz_id: certifiedUserSkillQuizId
        },
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9,de;q=0.8',
          'Authorization': `Bearer ${authToken}`,
          'Connection': 'keep-alive',
          'Origin': 'https://certified.learntube.ai',
          'Referer': 'https://certified.learntube.ai/',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-site',
          'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
          'sec-ch-ua': '"Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
          'sec-ch-ua-mobile': '?1',
          'sec-ch-ua-platform': '"Android"'
        },
        timeout: 30000
      });

      console.log('✅ Quiz Analysis API Response:', {
        status: response.status,
        result: response.data.result,
        message: response.data.message,
        hasAnalysis: !!response.data.data?.quiz_analysis
      });

      if (response.data.result === 'success') {
        return {
          success: true,
          message: response.data.message,
          data: response.data.data
        };
      } else {
        console.error('Quiz Analysis API returned error:', response.data);
        throw new Error(`Quiz Analysis API failed: ${response.data.message || 'Unknown error'}`);
      }

    } catch (error) {
      console.error('❌ Quiz Analysis API Error:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', JSON.stringify(error.response.data, null, 2));
        const errorMessage = error.response.data?.message || error.response.data?.error || error.message;
        throw new Error(`Quiz Analysis API failed with status ${error.response.status}: ${errorMessage}`);
      }
      throw new Error(`Quiz Analysis API request failed: ${error.message}`);
    }
  }
}

module.exports = new AnalysisService();
