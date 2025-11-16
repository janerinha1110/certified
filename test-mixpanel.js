/**
 * Test script to verify Mixpanel integration
 * Run with: node test-mixpanel.js
 */

// Load environment variables
require('dotenv').config();

const mixpanelService = require('./utils/mixpanelService');

console.log('\n=== Mixpanel Integration Test ===\n');

// Wait a moment for initialization
setTimeout(() => {
  console.log('\n--- Testing Event Tracking ---\n');
  
  // Test 1: Quiz Started
  console.log('Test 1: Tracking "Quiz Started" event...');
  mixpanelService.trackQuizStarted({
    email: 'test@example.com',
    phone: '+1234567890',
    name: 'Test User',
    subject: 'Java',
    endpoint: 'start_quiz_clone_v2'
  });
  
  // Test 2: Answer Saved
  setTimeout(() => {
    console.log('\nTest 2: Tracking "Answer Saved" event...');
    mixpanelService.trackAnswerSaved({
      question_id: 'test-question-id',
      session_id: 'test-session-id',
      question_number: 1,
      answer: 'A',
      total_questions: 10
    });
    
    // Test 3: Quiz Scored
    setTimeout(() => {
      console.log('\nTest 3: Tracking "Quiz Scored" event...');
      mixpanelService.trackQuizScored({
        user_id: 'test-user-id',
        session_id: 'test-session-id',
        email: 'test@example.com',
        phone: '+1234567890',
        score: 80,
        score_category: 'true_high_80',
        correct_answers: 8,
        total_questions: 10
      });
      
      console.log('\n=== Test Complete ===');
      console.log('\nCheck your Mixpanel Live View to see if events appear.');
      console.log('Events should appear within a few seconds.\n');
      
      // Keep process alive for a moment to allow events to send
      setTimeout(() => {
        process.exit(0);
      }, 2000);
    }, 1000);
  }, 1000);
}, 500);

