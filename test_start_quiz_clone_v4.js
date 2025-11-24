const http = require('http');

const testData = {
  "name": "Divya Bambratkar",
  "email": "",
  "phone": "918830217032",
  "subject": "Finance Management",
  "list": "",
  "option": ""
};

const postData = JSON.stringify(testData);

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/start_quiz_clone_v4',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('🚀 Testing start_quiz_clone_v4 endpoint...');
console.log('📤 Request data:', JSON.stringify(testData, null, 2));
console.log('');

const req = http.request(options, (res) => {
  let data = '';

  console.log(`📥 Status Code: ${res.statusCode}`);
  console.log(`📋 Headers:`, res.headers);
  console.log('');

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('📦 Response Body:');
    try {
      const parsed = JSON.parse(data);
      console.log(JSON.stringify(parsed, null, 2));
    } catch (e) {
      console.log(data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error:', error.message);
  console.error('\n💡 Make sure the server is running on port 3000');
  console.error('   Run: node server.js');
});

req.write(postData);
req.end();




