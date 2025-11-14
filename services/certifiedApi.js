const axios = require('axios');
const config = require('../config');

class CertifiedApiService {
  constructor() {
    this.baseURL = config.certifiedApi.url;
    this.cpo = config.certifiedApi.cpo;
  }

  async createNewEntry(subjectName) {
    try {
      console.log('🎯 Creating certified entry for subject:', subjectName);
      
      const url = `${this.baseURL}?__cpo=${this.cpo}`;
      
      const headers = {
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'en-US,en;q=0.9,de;q=0.8',
        'content-type': 'application/json',
        'origin': 'https://certified-new.learntube.ai',
        'priority': 'u=1, i',
        'referer': 'https://certified-new.learntube.ai/1/course-page?__cpo=aHR0cHM6Ly9jZXJ0aWZpZWQubGVhcm50dWJlLmFp',
        'sec-ch-ua': '"Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
        'sec-ch-ua-mobile': '?1',
        'sec-ch-ua-platform': '"Android"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'user-agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36'
      };

      const cookies = [
        '__cpc=UzhHa3hFSnZDQ1gxR01MRDlDWVUxWHBjQ3JWclpmQXFZeis5L0x2bHhQWEFhb1ZpL011QXhjLzRUR1IzVzBzcmo4UlR1ejd1a0phOGlyd1V3bmh4WXJvdk1PeHdEcXhPcEdzcU1nQUlrVmo2RGVTYWM4ZXhONGI5ZHd4aHo2NU9ueGU3bW5HNFhnSUJGSVZVc0M1VDRRPT0%3D',
        '_hjSessionUser_3671702@learntube.ai=eyJpZCI6ImE1ZDdiMmQ2LTNlMTItNTE3My05ODg2LWJlZjcxOGE5NWQ2ZCIsImNyZWF0ZWQiOjE3NjA2OTQ2Njk0OTcsImV4aXN0aW5nIjpmYWxzZX0=',
        '_hjSession_3671702@learntube.ai=eyJpZCI6IjRkOTk3MmYxLTU1NGQtNGE0Ni1hNWRiLWNjYzAyMjdlYzkyMiIsImMiOjE3NjA2OTQ2Njk0OTgsInMiOjAsInIiOjAsInNiIjowLCJzciI6MCwic2UiOjAsImZzIjoxLCJzcCI6MH0=',
        '_fbp@ai=fb.0.1760694670198.276412690366639702',
        '__cpcStatSampleNum=2',
        'mp_1b9f6ff863eb64bbd4e947eda22faec0_mixpanel@learntube.ai=%7B%22distinct_id%22%3A%22%24device%3A8caa2e92-8625-4f9d-90c5-bc4305dab3f7%22%2C%22%24device_id%22%3A%228caa2e92-8625-4f9d-90c5-bc4305dab3f7%22%2C%22%24initial_referrer%22%3A%22%24direct%22%2C%22%24initial_referring_domain%22%3A%22%24direct%22%2C%22__mps%22%3A%7B%22%24os%22%3A%22Windows%22%2C%22%24browser%22%3A%22Chrome%22%2C%22%24browser_version%22%3A141%7D%2C%22__mpso%22%3A%7B%22%24initial_referrer%22%3A%22%24direct%22%2C%22%24initial_referring_domain%22%3A%22%24direct%22%7D%2C%22__mpus%22%3A%7B%7D%2C%22__mpa%22%3A%7B%7D%2C%22__mpu%22%3A%7B%7D%2C%22__mpr%22%3A%5B%5D%2C%22__mpap%22%3A%5B%5D%7D'
      ].join('; ');

      const data = {
        subject_name: subjectName,
        utm_object: {
          utm_source: "certified_wa_flow",
          utm_medium: "",
          utm_campaign: ""
        },
        is_new_ui: false
      };

      const response = await axios.post(url, data, {
        headers: {
          ...headers,
          'cookie': cookies
        },
        timeout: 10000, // 10 second timeout
        httpsAgent: new (require('https').Agent)({
          rejectUnauthorized: false // Ignore SSL certificate errors
        })
      });

      return response.data;
    } catch (error) {
      console.error('Certified API Error:', error.message);
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
      }
      throw new Error(`Failed to create certified entry: ${error.message}`);
    }
  }

  async getSubjectFromList(list, option) {
    try {
      console.log('🎯 Getting subject from list and option:', { list, option });
      
      const url = 'https://xgfy-czuw-092q.m2.xano.io/api:Jb3ejqkw/selected_subject';
      
      const headers = {
        'Content-Type': 'application/json'
      };

      const data = {
        list: list,
        option: option
      };

      const response = await axios.post(url, data, {
        headers,
        timeout: 10000, // 10 second timeout
        httpsAgent: new (require('https').Agent)({
          rejectUnauthorized: false // Ignore SSL certificate errors
        })
      });

      if (response.data.result === 'success' && response.data.data) {
        console.log('✅ Received subject from API:', response.data.data);
        return response.data.data; // Returns the subject string (e.g., "Scrum Master")
      } else {
        throw new Error(`API returned error: ${response.data.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Get Subject API Error:', error.message);
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
      }
      throw new Error(`Failed to get subject from list: ${error.message}`);
    }
  }
}

module.exports = new CertifiedApiService();
