const axios = require('axios');

class CreateV2TestService {
  constructor() {
    this.baseURL = 'https://certified-new.learntube.ai/create_v2_test';
  }

  async createV2Test(certifiedToken, certifiedUserSkillId) {
    try {
      console.log('🎯 Calling create_v2_test API...');
      console.log('📤 Request data:', { certifiedUserSkillId });
      console.log('🔑 Using token:', certifiedToken ? 'Token present' : 'No token');

      const requestData = {
        items: [
          {
            product_slug: "certificate_type_3",
            product_quantity: 1,
            entity_type: "skill",
            entity_id: parseInt(certifiedUserSkillId)
          }
        ],
        utm_source: "",
        scholarship_type: ""
      };

      console.log('📦 Final request payload:', JSON.stringify(requestData, null, 2));

      const response = await axios.post(this.baseURL, requestData, {
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9,de;q=0.8',
          'Authorization': `Bearer ${certifiedToken}`,
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

      console.log('📥 Create V2 Test API response:', response.data);

      if (response.data.result === 'success') {
        return {
          success: true,
          message: response.data.message || 'Create V2 Test successful',
          data: response.data.data
        };
      } else {
        return {
          success: false,
          message: response.data.message || 'Create V2 Test failed',
          data: response.data.data || null
        };
      }

    } catch (error) {
      console.error('❌ Error calling create_v2_test API:', error.message);
      
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
        
        return {
          success: false,
          message: `API Error: ${error.response.status} - ${error.response.data?.message || error.message}`,
          data: null
        };
      } else if (error.request) {
        console.error('No response received:', error.request);
        
        return {
          success: false,
          message: 'No response received from create_v2_test API',
          data: null
        };
      } else {
        console.error('Request setup error:', error.message);
        
        return {
          success: false,
          message: `Request error: ${error.message}`,
          data: null
        };
      }
    }
  }
}

module.exports = new CreateV2TestService();
