const axios = require('axios');
const config = require('../config');

class ContinueApiService {
  constructor() {
    this.baseURL = 'https://certified-new.learntube.ai/continue';
  }

  async continueQuiz(userData) {
    try {
      console.log('🔄 Calling Continue API...');
      console.log('📤 Request data:', {
        certified_user_skill_id: userData.certified_user_skill_id,
        email: userData.email,
        phone_number: userData.phone_number,
        name: userData.name,
        password: userData.password
      });

      const response = await axios.post(this.baseURL, {
        certified_user_skill_id: userData.certified_user_skill_id,
        email: userData.email,
        phone_number: userData.phone_number,
        name: userData.name,
        password: userData.password
      }, {
        headers: {
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
        },
        timeout: 30000
      });

      console.log('✅ Continue API Response:', {
        status: response.status,
        result: response.data.result,
        message: response.data.message,
        hasData: !!response.data.data
      });

      if (response.data.result === 'success') {
        return {
          success: true,
          token: response.data.data,
          message: response.data.message
        };
      } else {
        console.error('Continue API returned error:', response.data);
        throw new Error(`Continue API failed: ${response.data.message || 'Unknown error'}`);
      }

    } catch (error) {
      console.error('❌ Continue API Error:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', JSON.stringify(error.response.data, null, 2));
        const errorMessage = error.response.data?.message || error.response.data?.error || error.message;
        throw new Error(`Continue API failed with status ${error.response.status}: ${errorMessage}`);
      }
      throw new Error(`Continue API request failed: ${error.message}`);
    }
  }
}

module.exports = new ContinueApiService();
