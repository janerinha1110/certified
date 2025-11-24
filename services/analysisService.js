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
        timeout: 30000,
        httpsAgent: new (require('https').Agent)({
          rejectUnauthorized: false // Ignore SSL certificate errors
        })
      });

      console.log('✅ Quiz Analysis API Response:', {
        status: response.status,
        result: response.data.result,
        message: response.data.message,
        hasAnalysis: !!response.data.data?.quiz_analysis,
        status_code: response.data.status_code,
        detail: response.data.detail
      });

      // Check for error in response body (even if HTTP status is 200)
      if (response.data.status_code && response.data.status_code !== 200) {
        const errorDetail = response.data.detail || response.data.message || 'Unknown error';
        console.error('⚠️ Quiz Analysis API returned error in response body:', {
          status_code: response.data.status_code,
          detail: errorDetail
        });
        return {
          success: false,
          message: errorDetail,
          data: null,
          error: `Quiz Analysis API failed with status_code ${response.data.status_code}: ${errorDetail}`
        };
      }

      // Check for success result
      if (response.data.result === 'success') {
        return {
          success: true,
          message: response.data.message,
          data: response.data.data
        };
      } else {
        // If result is not 'success' but no status_code error, treat as failure
        const errorMessage = response.data.message || response.data.detail || 'Unknown error';
        console.error('⚠️ Quiz Analysis API returned non-success result:', response.data);
        return {
          success: false,
          message: errorMessage,
          data: null,
          error: `Quiz Analysis API failed: ${errorMessage}`
        };
      }

    } catch (error) {
      console.error('❌ Quiz Analysis API Error:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', JSON.stringify(error.response.data, null, 2));
        const errorMessage = error.response.data?.message || error.response.data?.detail || error.response.data?.error || error.message;
        // Return failure result instead of throwing
        return {
          success: false,
          message: errorMessage,
          data: null,
          error: `Quiz Analysis API failed with status ${error.response.status}: ${errorMessage}`
        };
      }
      // Return failure result instead of throwing
      return {
        success: false,
        message: error.message,
        data: null,
        error: `Quiz Analysis API request failed: ${error.message}`
      };
    }
  }
}

module.exports = new AnalysisService();
