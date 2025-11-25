const express = require('express');
const router = express.Router();
const userService = require('../services/userService');
const certifiedApiService = require('../services/certifiedApi');
const generateQuizService = require('../services/generateQuizService');
const questionService = require('../services/questionService');
const quizResponseService = require('../services/quizResponseService');
const { query } = require('../database');
const { body, validationResult } = require('express-validator');
const mixpanelService = require('../utils/mixpanelService');
const { toIST } = require('../utils/timezone');

const formatISTTimestamp = (value) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date)) {
    return value ? String(value) : '';
  }
  const istDate = toIST(date);
  const year = istDate.getUTCFullYear();
  const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(istDate.getUTCDate()).padStart(2, '0');
  const hours = String(istDate.getUTCHours()).padStart(2, '0');
  const minutes = String(istDate.getUTCMinutes()).padStart(2, '0');
  const seconds = String(istDate.getUTCSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} IST`;
};

// Shared function for quiz response submission logic
const handleQuizResponseSubmission = async (userData, options = {}) => {
  const { name, email, phone, certified_user_skill_id } = userData;
  
  console.log('📝 Processing quiz response submission...');
  console.log('📤 Request data:', { name, email, phone, certified_user_skill_id });
  
  // Submit quiz response
  const result = await quizResponseService.submitQuizResponse(
    { name, email, phone, certified_user_skill_id },
    options
  );
  
  console.log('🔍 Raw service result:', JSON.stringify(result, null, 2));
  
  // Check if result has data and if it's not empty
  if (!result.data || Object.keys(result.data).length === 0) {
    console.error('❌ Service returned empty data object');
    // Track submission failure
    mixpanelService.trackQuizSubmissionFailed({
      email,
      phone,
      certified_user_skill_id,
      error_message: 'Service returned empty data'
    });
    throw new Error('Service returned empty data - check service logs');
  }
  
  // Get the score to determine success level
  const score = result.data.quiz_results?.score || 0;
  // Categorize score per new rules:
  // 100 => true_high_100, 90 => true_high_90, 80 => true_high_80, 70 => true_high_70
  // 50-60 => true_pass, 0-40 => true_low
  let successValue = 'true_low'; // Default fallback
  if (score === 100) {
    successValue = 'true_high_100';
  } else if (score === 90) {
    successValue = 'true_high_90';
  } else if (score === 80) {
    successValue = 'true_high_80';
  } else if (score === 70) {
    successValue = 'true_high_70';
  } else if (score >= 50 && score <= 60) {
    successValue = 'true_pass';
  } else if (score >= 0 && score <= 40) {
    successValue = 'true_low';
  }

  // Track quiz scored
  mixpanelService.trackQuizScored({
    user_id: result.data.user?.id,
    session_id: result.data.session?.id,
    email,
    phone,
    score,
    score_category: successValue,
    correct_answers: result.data.quiz_results?.correct_answers || 0,
    total_questions: result.data.quiz_results?.total_questions || 0,
    certified_user_skill_id
  });
  
  // Format response to match the exact structure you want
  const formattedResponse = {
    success: successValue,
    message: "Quiz response submitted successfully",
    data: {
      user: {
        id: result.data.user.id,
        name: result.data.user.name,
        email: result.data.user.email,
        phone: result.data.user.phone
      },
      session: {
        id: result.data.session.id,
        certified_skill_id: result.data.session.certified_user_id,
        token_updated: result.data.session.token_updated,
        order_id: result.data.session.order_id
      },
      quiz_attempt: result.data.quiz_attempt || {},
      quiz_results: result.data.quiz_results || {},
      score: score
    }
  };
  
  console.log('📤 Formatted response:', JSON.stringify(formattedResponse, null, 2));
  return formattedResponse;
};

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     ApiKeyAuth:
 *       type: apiKey
 *       in: header
 *       name: X-API-Key
 *       description: API Key for authentication (if needed)
 */

// Validation middleware
const validateStartQuiz = (req, res, next) => {
  const { name, email, phone, subject } = req.body;
  
  if (!name || !email || !phone || !subject) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields. Please provide name, email, phone, and subject.'
    });
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid email address.'
    });
  }

  // Basic phone validation (assuming 10+ digits)
  const phoneRegex = /^\d{10,}$/;
  if (!phoneRegex.test(phone.replace(/\D/g, ''))) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid phone number.'
    });
  }

  next();
};

// Validation middleware (clone): require phone + subject, allow optional name, email, and session_id
const validateStartQuizClone = (req, res, next) => {
  const { phone, subject } = req.body;
  if (!phone || !subject) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields. Please provide phone and subject.'
    });
  }
  const phoneRegex = /^\d{10,}$/;
  if (!phoneRegex.test(String(phone).replace(/\D/g, ''))) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid phone number.'
    });
  }
  next();
};

// Validation middleware (clone v2): require phone + subject, allow optional name, email (optional or empty), and session_id
const validateStartQuizCloneV2 = (req, res, next) => {
  const { phone, subject } = req.body;
  if (!phone || !subject) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields. Please provide phone and subject.'
    });
  }
  const phoneRegex = /^\d{10,}$/;
  if (!phoneRegex.test(String(phone).replace(/\D/g, ''))) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid phone number.'
    });
  }
  // Email is optional (can be empty string), but if provided and not empty, validate it
  const { email } = req.body;
  if (email && email.trim() !== '') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.'
      });
    }
  }
  next();
};

// Validation middleware (clone v3): require phone, allow optional subject OR (list and option), allow optional name, email (optional or empty), and session_id
const validateStartQuizCloneV3 = (req, res, next) => {
  const { phone, subject, list, option } = req.body;
  
  // Phone is always required
  if (!phone) {
    return res.status(400).json({
      success: false,
      message: 'Missing required field: phone'
    });
  }
  
  const phoneRegex = /^\d{10,}$/;
  if (!phoneRegex.test(String(phone).replace(/\D/g, ''))) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid phone number.'
    });
  }
  
  // Either subject OR (list AND option) must be provided
  const hasSubject = subject && subject.trim() !== '';
  const hasList = list && list.trim() !== '';
  const hasOption = option && option.trim() !== '';
  const hasListAndOption = hasList && hasOption;
  
  if (!hasSubject && !hasListAndOption) {
    return res.status(400).json({
      success: false,
      message: 'Please provide either "subject" OR both "list" and "option" to resolve the subject.'
    });
  }
  
  // Email is optional (can be empty string), but if provided and not empty, validate it
  const { email } = req.body;
  if (email && email.trim() !== '') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.'
      });
    }
  }
  next();
};

/**
 * @swagger
 * /api/start_quiz:
 *   post:
 *     summary: Start a new quiz session
 *     description: Creates a new user, calls the certified API to generate a quiz session, and stores the session information in the database.
 *     tags: [Quiz]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StartQuizRequest'
 *           examples:
 *             six_sigma:
 *               summary: Six Sigma Quiz
 *               value:
 *                 name: "John Doe"
 *                 email: "john@example.com"
 *                 phone: "1234567890"
 *                 subject: "Six Sigma"
 *             docker_basic:
 *               summary: Docker Basic Quiz
 *               value:
 *                 name: "Jane Smith"
 *                 email: "jane@example.com"
 *                 phone: "9876543210"
 *                 subject: "Docker Basic"
 *     responses:
 *       201:
 *         description: Quiz started successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StartQuizResponse'
 *             examples:
 *               success:
 *                 summary: Successful quiz start
 *                 value:
 *                   success: true
 *                   message: "Quiz started successfully"
 *                   data:
 *                     user:
 *                       id: "1d03ddf5-9956-49c4-8ea2-f3e84bf55073"
 *                       name: "John Doe"
 *                       email: "john@example.com"
 *                       phone: "1234567890"
 *                       subject: "Six Sigma"
 *                       created_at: "2024-01-01T00:00:00.000Z"
 *                     certified_skill:
 *                       id: 1770730
 *                       subject_name: "Six Sigma"
 *                       quiz_status: "not_generated"
 *                       is_paid: false
 *                     session:
 *                       id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *                       certified_token: "csinsiufheei[aokdap"
 *                       token_expiration: "2024-01-01T01:00:00.000Z"
 *                     quiz:
 *                       total_questions: 10
 *                       questions_generated: true
 *                       question_types:
 *                         easy: 5
 *                         medium: 3
 *                         hard: 2
 *                     first_question:
 *                       question_id: "question-uuid"
 *                       question: "What is the primary goal of Six Sigma?\n\nA. To reduce costs\nB. To improve customer satisfaction\nC. To eliminate defects\nD. To increase employee morale"
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/start_quiz', validateStartQuiz, async (req, res) => {
  try {
    const { name, email, phone, subject } = req.body;
    
    console.log('Starting quiz for user:', { name, email, phone, subject });

    // Track quiz started
    mixpanelService.trackQuizStarted({
      user_id: null, // Will be set after user creation
      email,
      phone,
      name,
      subject,
      endpoint: 'start_quiz'
    });

    // Step 1: Create user in database
    const user = await userService.createUser({
      name,
      email,
      phone,
      subject
    });

    console.log('User created successfully with ID:', user.id);

    // Step 2: Call certified API
    const certifiedResponse = await certifiedApiService.createNewEntry(subject);
    
    if (certifiedResponse.result !== 'success') {
      throw new Error(`Certified API error: ${certifiedResponse.message}`);
    }

    const certifiedSkillId = certifiedResponse.data.id;
    console.log('Certified API response received:', certifiedSkillId);

    // Step 3: Create session record
    const certifiedToken = userService.generateCertifiedToken();
    const tokenExpiration = userService.getTokenExpirationTime();
    
    const session = await userService.createSession(
      user.id,
      certifiedSkillId,
      certifiedToken,
      tokenExpiration,
      subject
    );

    console.log('Session created successfully with ID:', session.id, 'for user ID:', user.id);

    // Step 4: Generate quiz questions (optional - may fail due to API changes)
    let quizInfo = {
      total_questions: 0,
      questions_generated: false,
      question_types: { easy: 0, medium: 0, hard: 0 }
    };

    try {
      console.log('🎯 Generating quiz questions...');
      const quizData = await generateQuizService.generateQuiz(certifiedSkillId);
      
      if (quizData.result === 'success') {
        // Step 5: Extract questions from quiz data
        const questions = generateQuizService.extractQuestions(quizData);
        console.log(`📋 Extracted ${questions.length} questions`);

        // Step 6: Store questions in database
        console.log('💾 Storing questions in database...');
        const storedQuestions = await questionService.createQuestions(questions, session.id, user.id);
        console.log(`✅ Stored ${storedQuestions.length} questions successfully`);
        
        quizInfo = {
          total_questions: storedQuestions.length,
          questions_generated: true,
          question_types: {
            easy: questions.filter(q => q.question_type === 'Easy').length,
            medium: questions.filter(q => q.question_type === 'Medium').length,
            hard: questions.filter(q => q.question_type === 'Hard').length
          }
        };

        // Track questions generated
        mixpanelService.trackQuizQuestionsGenerated({
          user_id: user.id,
          session_id: session.id,
          email,
          phone,
          subject,
          total_questions: storedQuestions.length,
          question_types: quizInfo.question_types
        });
      } else {
        console.log('⚠️  Quiz generation failed:', quizData.message);
        // Track generation failure
        mixpanelService.trackQuizQuestionsGenerationFailed({
          user_id: user.id,
          session_id: session.id,
          email,
          phone,
          subject,
          error_message: quizData.message
        });
      }
    } catch (error) {
      console.log('⚠️  Quiz generation failed (API may be outdated):', error.message);
      console.log('📝 Continuing without quiz questions...');
      // Track generation failure
      mixpanelService.trackQuizQuestionsGenerationFailed({
        user_id: user.id,
        session_id: session.id,
        email,
        phone,
        subject,
        error_message: error.message
      });
    }

    // Step 7: Get the first question for the current session
    let firstQuestion = null;
    try {
      const questions = await questionService.getQuestionsBySession(session.id);
      if (questions && questions.length > 0) {
        console.log(`📝 Retrieved ${questions.length} questions for session:`, session.id);
        console.log('📝 Question numbers in order:', questions.map(q => q.question_no));
        console.log('📝 Question IDs in order:', questions.map(q => q.id));
        firstQuestion = questions[0]; // First question by question_no
        console.log('📝 Selected first question (question_no: 1) ID:', firstQuestion.id);
        console.log('📝 First question preview:', firstQuestion.question.substring(0, 100) + '...');
      }
    } catch (error) {
      console.log('⚠️  Could not retrieve first question:', error.message);
    }

    // Return success response
    res.status(201).json({
      success: true,
      message: 'Quiz started successfully',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          subject: user.subject,
          created_at: user.created_at
        },
        certified_skill: {
          id: certifiedSkillId,
          subject_name: certifiedResponse.data.subject_name,
          quiz_status: certifiedResponse.data.quiz_status,
          is_paid: certifiedResponse.data.is_paid
        },
        session: {
          id: session.id,
          certified_token: session.certified_token,
          token_expiration: session.certified_token_expires_at
        },
        quiz: quizInfo,
        first_question: firstQuestion ? {
          question_id: firstQuestion.id,
          question: firstQuestion.question
        } : null
      }
    });

  } catch (error) {
    console.error('Error in start_quiz endpoint:', error);
    console.error('Error stack:', error.stack);
    
    // Track error
    mixpanelService.trackQuizError({
      endpoint: 'start_quiz',
      error_message: error.message,
      subject: req.body?.subject
    });
    
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * @swagger
 * /api/start_quiz_clone:
 *   post:
 *     summary: Start a quiz session (clone) with conditional question generation
 *     description: Same input and base flow as /api/start_quiz. If user/session/questions already exist, returns them; otherwise creates what's missing and attempts to generate/store questions. Adds question_added flag.
 *     tags: [Quiz]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StartQuizRequest'
 *           examples:
 *             example:
 *               summary: Start (clone)
 *               value:
 *                 name: "John Doe"
 *                 email: "john@example.com"
 *                 phone: "918007880283"
 *                 subject: "catia advanced"
 *     responses:
 *       201:
 *         description: Quiz started successfully (clone)
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/StartQuizResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         question_added:
 *                           type: boolean
 *                           description: True if questions were stored in this call; false otherwise
 *                           example: true
 *             examples:
 *               success_with_questions:
 *                 summary: Questions added this call
 *                 value:
 *                   success: true
 *                   message: "Quiz started successfully"
 *                   data:
 *                     user:
 *                       id: "uuid"
 *                       name: "John Doe"
 *                       email: "john@example.com"
 *                       phone: "918007880283"
 *                       subject: "catia advanced"
 *                       created_at: "2025-10-31T10:00:00.000Z"
 *                     certified_skill:
 *                       id: 1804162
 *                       subject_name: "catia advanced"
 *                       quiz_status: "not_generated"
 *                       is_paid: false
 *                     session:
 *                       id: "uuid"
 *                       certified_token: "random-token"
 *                       token_expiration: "2025-10-31T11:00:00.000Z"
 *                     quiz:
 *                       total_questions: 10
 *                       questions_generated: true
 *                       question_types:
 *                         easy: 0
 *                         medium: 0
 *                         hard: 0
 *                     first_question:
 *                       question_id: "uuid"
 *                       question: "Question text with options..."
 *                     question_added: true
 *               success_without_questions:
 *                 summary: No questions added yet
 *                 value:
 *                   success: true
 *                   message: "Quiz started successfully"
 *                   data:
 *                     user: { "...": "..." }
 *                     certified_skill: { "...": "..." }
 *                     session: { "...": "..." }
 *                     quiz:
 *                       total_questions: 0
 *                       questions_generated: false
 *                       question_types: { "easy": 0, "medium": 0, "hard": 0 }
 *                     first_question: null
 *                     question_added: false
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
/**
 * Clone of start_quiz with conditional question generation and polling support.
 * Behavior:
 * - If user+subject not found: runs the normal start_quiz flow.
 * - If user exists: uses provided session_id or latest session; if no session, creates one.
 * - If session has no questions: tries generate; if generate result has empty arrays, skip storing.
 * - Returns same schema as start_quiz, plus question_added: true/false.
 */
router.post('/start_quiz_clone', validateStartQuizClone, async (req, res) => {
  try {
    const { name, email, phone, subject, session_id: providedSessionId } = req.body;

    // Track quiz started
    mixpanelService.trackQuizStarted({
      email,
      phone,
      name,
      subject,
      endpoint: 'start_quiz_clone'
    });

    // Find or create user (createUser will return existing user if email+subject match)
    let user;
    if (name && email) {
      user = await userService.createUser({ name, email, phone, subject });
    } else {
      // Lookup by phone+subject when name/email not provided
      const userLookupQuery = `
        SELECT id, name, email, phone, subject, created_at
        FROM users
        WHERE phone = $1 AND subject = $2
        ORDER BY created_at DESC
        LIMIT 1
      `;
      const ures = await query(userLookupQuery, [phone, subject]);
      if (ures.rows.length > 0) {
        user = ures.rows[0];
      } else {
        if (!name || !email) {
          return res.status(400).json({
            success: false,
            message: 'User not found. Provide name and email to create a new user.'
          });
        }
        user = await userService.createUser({ name, email, phone, subject });
      }
    }

    // Resolve session: use provided session_id or latest for user
    let session;
    if (providedSessionId) {
      // Only accept provided session if it belongs to this user and subject
      const sessRes = await query(
        'SELECT id, user_id, certified_user_id, certified_token, certified_token_expires_at, subject, created_at FROM sessions WHERE id = $1 AND user_id = $2 AND subject = $3',
        [providedSessionId, user.id, subject]
      );
      session = sessRes.rows[0] || null;
    }
    if (!session) {
      // Strictly fetch the latest session for this user and this subject
      const latestSessionQuery = `
        SELECT id, user_id, certified_user_id, certified_token, certified_token_expires_at, subject, created_at
        FROM sessions
        WHERE user_id = $1 AND subject = $2
        ORDER BY created_at DESC
        LIMIT 1
      `;
      const sres = await query(latestSessionQuery, [user.id, subject]);
      session = sres.rows[0] || null;
    }

    // If no session, create one via certified API then create session record
    let certifiedSkillId;
    let certifiedResponse = null;
    if (!session) {
      certifiedResponse = await certifiedApiService.createNewEntry(subject);
      if (certifiedResponse.result !== 'success') {
        throw new Error(`Certified API error: ${certifiedResponse.message}`);
      }
      certifiedSkillId = certifiedResponse.data.id;
      const certifiedToken = userService.generateCertifiedToken();
      const tokenExpiration = userService.getTokenExpirationTime();
      session = await userService.createSession(
        user.id,
        certifiedSkillId,
        certifiedToken,
        tokenExpiration,
        subject
      );
    } else {
      certifiedSkillId = parseInt(session.certified_user_id);
    }

    // Prepare quiz info (will update below)
    let quizInfo = {
      total_questions: 0,
      questions_generated: false,
      question_types: { easy: 0, medium: 0, hard: 0 }
    };

    // Check if questions already exist for this session
    // CRITICAL: question_added should only be true when exactly 10 questions are stored
    const existingQuestions = await questionService.getQuestionsBySession(session.id);
    let questionAdded = existingQuestions && existingQuestions.length === 10;
    if (questionAdded) {
      quizInfo = {
        total_questions: existingQuestions.length,
        questions_generated: true,
        question_types: { easy: 0, medium: 0, hard: 0 }
      };
    } else if (existingQuestions && existingQuestions.length > 0 && existingQuestions.length < 10) {
      // Partial questions exist but not all 10 - set to false and continue polling
      console.log(`⚠️  Only ${existingQuestions.length} questions found (need 10). question_added will be false.`);
      quizInfo = {
        total_questions: existingQuestions.length,
        questions_generated: false,
        question_types: { easy: 0, medium: 0, hard: 0 }
      };
    }

    // If no questions, start background polling (non-blocking)
    if (!questionAdded) {
      console.log('🔄 Starting background polling for quiz generation...');
      
      // Start polling in background - don't await, let it run asynchronously
      // This ensures API response returns immediately within timeout limit
      (async () => {
        const pollDelay = 3000; // 3 seconds between polls
        const maxPollingTime = 90000; // 90 seconds maximum
        const startTime = Date.now();
        let attempt = 0;
        let questionAddedInBackground = false;
        let quizData;
        
        try {
          while (!questionAddedInBackground && (Date.now() - startTime) < maxPollingTime) {
            attempt++;
            const elapsedTime = Math.round((Date.now() - startTime) / 1000);
            
            try {
              console.log(`🔄 [Background] Polling generate API (attempt ${attempt}, ${elapsedTime}s elapsed) for session ${session.id}...`);
              quizData = await generateQuizService.generateQuiz(certifiedSkillId);
              
              // Check if we have questions available in all three arrays
              const questionnaire = quizData?.data?.quiz_question_answer?.questionaire || {};
              const easyArr = Array.isArray(questionnaire.easy) ? questionnaire.easy : [];
              const medArr = Array.isArray(questionnaire.medium) ? questionnaire.medium : [];
              const hardArr = Array.isArray(questionnaire.hard) ? questionnaire.hard : [];
              const totalQuestionsAvailable = easyArr.length + medArr.length + hardArr.length;
              
              console.log(`📊 [Background] Quiz data received - Status: ${quizData?.data?.quiz_status || 'unknown'}, Questions available: ${totalQuestionsAvailable} (Easy: ${easyArr.length}, Medium: ${medArr.length}, Hard: ${hardArr.length}) for session ${session.id}`);
              
              // Check if all three arrays have questions populated
              const hasEasyQuestions = easyArr.length > 0;
              const hasMediumQuestions = medArr.length > 0;
              const hasHardQuestions = hardArr.length > 0;
              const allArraysPopulated = hasEasyQuestions && hasMediumQuestions && hasHardQuestions;
              
              // If we have questions available, try to extract and store them
              if (totalQuestionsAvailable > 0) {
                if (allArraysPopulated) {
                  console.log(`✅ [Background] All question arrays are populated! Extracting questions for session ${session.id}...`);
                } else {
                  console.log(`⚠️  [Background] Not all arrays populated yet (Easy: ${hasEasyQuestions}, Medium: ${hasMediumQuestions}, Hard: ${hasHardQuestions}) for session ${session.id}. Continuing to poll...`);
                }
                
                // Only extract and store when all arrays are populated AND we have exactly 10 questions
                // Keep polling until we have all 10 questions ready
                if (allArraysPopulated) {
                  try {
                    const questions = generateQuizService.extractQuestions(quizData);
                    // CRITICAL: Only store in database if we have exactly 10 questions
                    if (questions.length === 10) {
                      console.log(`✅ [Background] Extracted exactly 10 questions, storing in database for session ${session.id}...`);
                      await questionService.createQuestions(questions, session.id, user.id);
                      questionAddedInBackground = true;
                      
                      // Track questions generated
                      mixpanelService.trackQuizQuestionsGenerated({
                        user_id: user.id,
                        session_id: session.id,
                        email: user.email || '',
                        phone: user.phone,
                        subject: subject,
                        total_questions: questions.length,
                        question_types: {
                          easy: questions.filter(q => q.question_type === 'Easy').length,
                          medium: questions.filter(q => q.question_type === 'Medium').length,
                          hard: questions.filter(q => q.question_type === 'Hard').length
                        }
                      });
                      
                      console.log(`✅ [Background] Successfully stored all 10 questions for session ${session.id}!`);
                      break; // Exit polling loop on success
                    } else {
                      console.log(`⏳ [Background] All arrays populated but only extracted ${questions.length} questions (need exactly 10). Continuing to poll for session ${session.id}...`);
                      // Continue polling - don't store partial questions
                    }
                  } catch (extractError) {
                    console.error(`❌ [Background] Error extracting questions for session ${session.id}:`, extractError.message);
                    // Continue polling
                  }
                } else {
                  console.log(`⏳ [Background] Waiting for all arrays to be populated (Easy: ${hasEasyQuestions}, Medium: ${hasMediumQuestions}, Hard: ${hasHardQuestions}) for session ${session.id}...`);
                }
              } else {
                console.log(`⏳ [Background] No questions available yet for session ${session.id}, continuing to poll...`);
              }
              
              // Wait before next poll (unless we're done)
              if (!questionAddedInBackground && (Date.now() - startTime) < maxPollingTime) {
                await new Promise(resolve => setTimeout(resolve, pollDelay));
              }
              
            } catch (e) {
              console.error(`❌ [Background] Quiz generation API error (attempt ${attempt}) for session ${session.id}:`, e.message);
              // Wait before retrying even on error
              if ((Date.now() - startTime) < maxPollingTime) {
                await new Promise(resolve => setTimeout(resolve, pollDelay));
              }
            }
          }
          
          if (!questionAddedInBackground) {
            const totalElapsed = Math.round((Date.now() - startTime) / 1000);
            console.warn(`⚠️  [Background] Polling timeout reached after ${totalElapsed}s for session ${session.id}. Questions may not be generated yet.`);
            // Track generation failure due to timeout
            mixpanelService.trackQuizQuestionsGenerationFailed({
              user_id: user.id,
              session_id: session.id,
              email: user.email || '',
              phone: user.phone,
              subject: subject,
              error_message: `Polling timeout after ${totalElapsed}s`
            });
          }
        } catch (error) {
          console.error(`❌ [Background] Fatal error in polling loop for session ${session.id}:`, error);
          // Track fatal error
          mixpanelService.trackQuizQuestionsGenerationFailed({
            user_id: user.id,
            session_id: session.id,
            email: user.email || '',
            phone: user.phone,
            subject: subject,
            error_message: error.message
          });
        }
      })(); // Immediately invoke async function - runs in background
      
      // Note: We're not awaiting the background task, so response returns immediately
      console.log('✅ Background polling started - API will return response immediately');
    }

    // Prepare quiz info and first question similar to start_quiz
    const finalQuestions = await questionService.getQuestionsBySession(session.id);
    // Ensure total reflects DB state; preserve type counts if already computed
    quizInfo.total_questions = finalQuestions.length;
    quizInfo.questions_generated = finalQuestions.length === 10; // Only true when exactly 10 questions
    
    // CRITICAL: Recalculate questionAdded based on final count - must be exactly 10
    questionAdded = finalQuestions.length === 10;

    let firstQuestion = null;
    if (finalQuestions.length > 0) {
      firstQuestion = finalQuestions[0];
    }

    // Determine message based on question status
    let responseMessage = 'Quiz started successfully';
    if (!questionAdded) {
      if (finalQuestions.length === 0) {
        responseMessage = 'Quiz started successfully. Questions are being generated in the background. Please check back in a few moments.';
      } else if (finalQuestions.length < 10) {
        responseMessage = `Quiz started successfully. ${finalQuestions.length} questions generated so far (need 10). Questions are being generated in the background. Please check back in a few moments.`;
      }
    }
    
    return res.status(201).json({
      success: true,
      message: responseMessage,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          subject: user.subject,
          created_at: user.created_at
        },
        certified_skill: {
          id: certifiedSkillId,
          subject_name: (certifiedResponse && certifiedResponse.data && certifiedResponse.data.subject_name) ? certifiedResponse.data.subject_name : subject,
          quiz_status: (certifiedResponse && certifiedResponse.data && certifiedResponse.data.quiz_status) ? certifiedResponse.data.quiz_status : 'unknown',
          is_paid: (certifiedResponse && certifiedResponse.data && typeof certifiedResponse.data.is_paid !== 'undefined') ? certifiedResponse.data.is_paid : false
        },
        session: {
          id: session.id,
          certified_token: session.certified_token,
          token_expiration: session.certified_token_expires_at
        },
        quiz: quizInfo,
        first_question: firstQuestion ? {
          question_id: firstQuestion.id,
          question: firstQuestion.question
        } : null,
        question_added: questionAdded
      }
    });
  } catch (error) {
    console.error('Error in start_quiz_clone endpoint:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * @swagger
 * /api/start_quiz_clone_v2:
 *   post:
 *     summary: Start a quiz session (clone v2) with optional email
 *     description: Same as /api/start_quiz_clone but email parameter is optional or can be empty string. Email can be updated later using auto_submit_quiz_v2.
 *     tags: [Quiz]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - subject
 *             properties:
 *               phone:
 *                 type: string
 *                 description: User's phone number
 *                 example: "918007880283"
 *               subject:
 *                 type: string
 *                 description: Subject/course name
 *                 example: "catia advanced"
 *               name:
 *                 type: string
 *                 description: User's name (optional)
 *                 example: "John Doe"
 *               email:
 *                 type: string
 *                 description: User's email (optional, can be empty string - will be updated later by auto_submit_quiz_v2)
 *                 example: "john@example.com"
 *               session_id:
 *                 type: string
 *                 description: Existing session ID (optional)
 *                 example: "uuid"
 *           examples:
 *             with_email:
 *               summary: With email provided
 *               value:
 *                 name: "John Doe"
 *                 email: "john@example.com"
 *                 phone: "918007880283"
 *                 subject: "catia advanced"
 *             without_email:
 *               summary: Without email (email optional)
 *               value:
 *                 name: "John Doe"
 *                 phone: "918007880283"
 *                 subject: "catia advanced"
 *             empty_email:
 *               summary: With empty email string (will be updated by auto_submit_quiz_v2)
 *               value:
 *                 name: "John Doe"
 *                 email: ""
 *                 phone: "918007880283"
 *                 subject: "catia advanced"
 *     responses:
 *       201:
 *         description: Quiz started successfully (clone v2)
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/StartQuizResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         question_added:
 *                           type: boolean
 *                           description: True if questions were stored in this call; false otherwise
 *                           example: true
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
/**
 * Clone of start_quiz_clone with optional email parameter.
 * Behavior:
 * - Email is optional or can be empty string; email can be updated later using auto_submit_quiz_v2
 * - If user+subject not found: runs the normal start_quiz flow
 * - If user exists: uses provided session_id or latest session; if no session, creates one
 * - If session has no questions: tries generate; if generate result has empty arrays, skip storing
 * - Returns same schema as start_quiz_clone, plus question_added: true/false
 */
router.post('/start_quiz_clone_v2', validateStartQuizCloneV2, async (req, res) => {
  try {
    const { name, email, phone, subject, session_id: providedSessionId } = req.body;

    // Track quiz started
    mixpanelService.trackQuizStarted({
      email: email || '',
      phone,
      name,
      subject,
      endpoint: 'start_quiz_clone_v2'
    });

    // Use email as provided (can be empty string or undefined)
    const userEmail = email || '';

    // Find or create user
    let user;
    
    // First, try to lookup by phone only (regardless of subject)
    const phoneOnlyLookupQuery = `
      SELECT id, name, email, phone, subject, created_at
      FROM users
      WHERE phone = $1
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const phoneOnlyRes = await query(phoneOnlyLookupQuery, [phone]);
    
    if (phoneOnlyRes.rows.length > 0) {
      const foundUser = phoneOnlyRes.rows[0];
      
      // Check if subject matches
      if (foundUser.subject === subject) {
        // Subject matches - use the user as is
        user = foundUser;
        console.log('✅ Found user by phone with matching subject');
      } else {
        // Subject doesn't match - update the user's subject to match request
        console.log(`⚠️  User found by phone but subject mismatch. Updating subject from "${foundUser.subject}" to "${subject}"`);
        const updateSubjectQuery = `
          UPDATE users
          SET subject = $1, updated_at = NOW()
          WHERE id = $2
          RETURNING id, name, email, phone, subject, created_at
        `;
        const updateRes = await query(updateSubjectQuery, [subject, foundUser.id]);
        user = updateRes.rows[0];
        console.log('✅ Updated user subject to match request');
      }
    } else {
      // User not found by phone - create new user
      if (!name) {
        return res.status(400).json({
          success: false,
          message: 'User not found. Provide name to create a new user.'
        });
      }
      
      // Create new user
      if (userEmail && userEmail.trim() !== '') {
        // Email provided - use userService.createUser
        user = await userService.createUser({ name, email: userEmail, phone, subject });
      } else {
        // Email is empty or not provided - create directly with empty string
        // Email column has NOT NULL constraint, so we must use empty string, not NULL
        try {
          console.log('📝 Creating new user with empty email');
          const createUserQuery = `
            INSERT INTO users(name, email, phone, subject, created_at)
            VALUES ($1, '', $2, $3, NOW())
            RETURNING id, name, email, phone, subject, created_at
          `;
          const createRes = await query(createUserQuery, [name, phone, subject]);
          user = createRes.rows[0];
          console.log('✅ Created new user with ID:', user.id);
        } catch (createError) {
          // If duplicate key error (email UNIQUE constraint), find existing user with empty email
          if (createError.code === '23505' && createError.constraint === 'users_email_key') {
            console.log('⚠️  User with empty email already exists (UNIQUE constraint), finding by phone');
            // Try to find user with empty email and matching phone
            const findEmptyEmailQuery = `
              SELECT id, name, email, phone, subject, created_at
              FROM users
              WHERE email = '' AND phone = $1
              ORDER BY created_at DESC
              LIMIT 1
            `;
            const findRes = await query(findEmptyEmailQuery, [phone]);
            if (findRes.rows.length > 0) {
              // Found user with empty email - update subject
              const updateSubjectQuery = `
                UPDATE users
                SET subject = $1, updated_at = NOW()
                WHERE id = $2
                RETURNING id, name, email, phone, subject, created_at
              `;
              const updateRes = await query(updateSubjectQuery, [subject, findRes.rows[0].id]);
              user = updateRes.rows[0];
              console.log('✅ Found user with empty email and updated subject');
            } else {
              // User with empty email exists but for different phone
              // Update the existing user's phone and subject to match
              console.log('⚠️  User with empty email exists for different phone, updating...');
              const updateUserQuery = `
                UPDATE users
                SET phone = $1, subject = $2, updated_at = NOW()
                WHERE email = ''
                RETURNING id, name, email, phone, subject, created_at
              `;
              const updateRes = await query(updateUserQuery, [phone, subject]);
              if (updateRes.rows.length > 0) {
                user = updateRes.rows[0];
                console.log('✅ Updated existing user with empty email to match phone+subject');
              } else {
                throw new Error('Failed to update user with empty email');
              }
            }
          } else {
            throw createError;
          }
        }
      }
    }

    // Resolve session: use provided session_id or latest for user
    let session;
    if (providedSessionId) {
      // Only accept provided session if it belongs to this user and subject
      const sessRes = await query(
        'SELECT id, user_id, certified_user_id, certified_token, certified_token_expires_at, subject, created_at FROM sessions WHERE id = $1 AND user_id = $2 AND subject = $3',
        [providedSessionId, user.id, subject]
      );
      session = sessRes.rows[0] || null;
    }
    if (!session) {
      // Strictly fetch the latest session for this user and this subject
      const latestSessionQuery = `
        SELECT id, user_id, certified_user_id, certified_token, certified_token_expires_at, subject, created_at
        FROM sessions
        WHERE user_id = $1 AND subject = $2
        ORDER BY created_at DESC
        LIMIT 1
      `;
      const sres = await query(latestSessionQuery, [user.id, subject]);
      session = sres.rows[0] || null;
    }

    // If no session, create one via certified API then create session record
    let certifiedSkillId;
    let certifiedResponse = null;
    if (!session) {
      certifiedResponse = await certifiedApiService.createNewEntry(subject);
      if (certifiedResponse.result !== 'success') {
        throw new Error(`Certified API error: ${certifiedResponse.message}`);
      }
      certifiedSkillId = certifiedResponse.data.id;
      const certifiedToken = userService.generateCertifiedToken();
      const tokenExpiration = userService.getTokenExpirationTime();
      session = await userService.createSession(
        user.id,
        certifiedSkillId,
        certifiedToken,
        tokenExpiration,
        subject
      );
    } else {
      certifiedSkillId = parseInt(session.certified_user_id);
    }

    // Prepare quiz info (will update below)
    let quizInfo = {
      total_questions: 0,
      questions_generated: false,
      question_types: { easy: 0, medium: 0, hard: 0 }
    };

    // Check if questions already exist for this session
    // CRITICAL: question_added should only be true when exactly 10 questions are stored
    const existingQuestions = await questionService.getQuestionsBySession(session.id);
    let questionAdded = existingQuestions && existingQuestions.length === 10;
    if (questionAdded) {
      quizInfo = {
        total_questions: existingQuestions.length,
        questions_generated: true,
        question_types: { easy: 0, medium: 0, hard: 0 }
      };
    } else if (existingQuestions && existingQuestions.length > 0 && existingQuestions.length < 10) {
      // Partial questions exist but not all 10 - set to false and continue polling
      console.log(`⚠️  Only ${existingQuestions.length} questions found (need 10). question_added will be false.`);
      quizInfo = {
        total_questions: existingQuestions.length,
        questions_generated: false,
        question_types: { easy: 0, medium: 0, hard: 0 }
      };
    }

    // If no questions, start background polling (non-blocking)
    if (!questionAdded) {
      console.log('🔄 Starting background polling for quiz generation...');
      
      // Start polling in background - don't await, let it run asynchronously
      // This ensures API response returns immediately within timeout limit
      (async () => {
        const pollDelay = 3000; // 3 seconds between polls
        const maxPollingTime = 90000; // 90 seconds maximum
        const startTime = Date.now();
        let attempt = 0;
        let questionAddedInBackground = false;
        let quizData;
        
        try {
          while (!questionAddedInBackground && (Date.now() - startTime) < maxPollingTime) {
            attempt++;
            const elapsedTime = Math.round((Date.now() - startTime) / 1000);
            
            try {
              console.log(`🔄 [Background] Polling generate API (attempt ${attempt}, ${elapsedTime}s elapsed) for session ${session.id}...`);
              quizData = await generateQuizService.generateQuiz(certifiedSkillId);
              
              // Check if we have questions available in all three arrays
              const questionnaire = quizData?.data?.quiz_question_answer?.questionaire || {};
              const easyArr = Array.isArray(questionnaire.easy) ? questionnaire.easy : [];
              const medArr = Array.isArray(questionnaire.medium) ? questionnaire.medium : [];
              const hardArr = Array.isArray(questionnaire.hard) ? questionnaire.hard : [];
              const totalQuestionsAvailable = easyArr.length + medArr.length + hardArr.length;
              
              console.log(`📊 [Background] Quiz data received - Status: ${quizData?.data?.quiz_status || 'unknown'}, Questions available: ${totalQuestionsAvailable} (Easy: ${easyArr.length}, Medium: ${medArr.length}, Hard: ${hardArr.length}) for session ${session.id}`);
              
              // Check if all three arrays have questions populated
              const hasEasyQuestions = easyArr.length > 0;
              const hasMediumQuestions = medArr.length > 0;
              const hasHardQuestions = hardArr.length > 0;
              const allArraysPopulated = hasEasyQuestions && hasMediumQuestions && hasHardQuestions;
              
              // If we have questions available, try to extract and store them
              if (totalQuestionsAvailable > 0) {
                if (allArraysPopulated) {
                  console.log(`✅ [Background] All question arrays are populated! Extracting questions for session ${session.id}...`);
                } else {
                  console.log(`⚠️  [Background] Not all arrays populated yet (Easy: ${hasEasyQuestions}, Medium: ${hasMediumQuestions}, Hard: ${hasHardQuestions}) for session ${session.id}. Continuing to poll...`);
                }
                
                // Only extract and store when all arrays are populated AND we have exactly 10 questions
                // Keep polling until we have all 10 questions ready
                if (allArraysPopulated) {
                  try {
                    const questions = generateQuizService.extractQuestions(quizData);
                    // CRITICAL: Only store in database if we have exactly 10 questions
                    if (questions.length === 10) {
                      console.log(`✅ [Background] Extracted exactly 10 questions, storing in database for session ${session.id}...`);
                      await questionService.createQuestions(questions, session.id, user.id);
                      questionAddedInBackground = true;
                      
                      // Track questions generated
                      mixpanelService.trackQuizQuestionsGenerated({
                        user_id: user.id,
                        session_id: session.id,
                        email: user.email || '',
                        phone: user.phone,
                        subject: subject,
                        total_questions: questions.length,
                        question_types: {
                          easy: questions.filter(q => q.question_type === 'Easy').length,
                          medium: questions.filter(q => q.question_type === 'Medium').length,
                          hard: questions.filter(q => q.question_type === 'Hard').length
                        }
                      });
                      
                      console.log(`✅ [Background] Successfully stored all 10 questions for session ${session.id}!`);
                      break; // Exit polling loop on success
                    } else {
                      console.log(`⏳ [Background] All arrays populated but only extracted ${questions.length} questions (need exactly 10). Continuing to poll for session ${session.id}...`);
                      // Continue polling - don't store partial questions
                    }
                  } catch (extractError) {
                    console.error(`❌ [Background] Error extracting questions for session ${session.id}:`, extractError.message);
                    // Continue polling
                  }
                } else {
                  console.log(`⏳ [Background] Waiting for all arrays to be populated (Easy: ${hasEasyQuestions}, Medium: ${hasMediumQuestions}, Hard: ${hasHardQuestions}) for session ${session.id}...`);
                }
              } else {
                console.log(`⏳ [Background] No questions available yet for session ${session.id}, continuing to poll...`);
              }
              
              // Wait before next poll (unless we're done)
              if (!questionAddedInBackground && (Date.now() - startTime) < maxPollingTime) {
                await new Promise(resolve => setTimeout(resolve, pollDelay));
              }
              
            } catch (e) {
              console.error(`❌ [Background] Quiz generation API error (attempt ${attempt}) for session ${session.id}:`, e.message);
              // Wait before retrying even on error
              if ((Date.now() - startTime) < maxPollingTime) {
                await new Promise(resolve => setTimeout(resolve, pollDelay));
              }
            }
          }
          
          if (!questionAddedInBackground) {
            const totalElapsed = Math.round((Date.now() - startTime) / 1000);
            console.warn(`⚠️  [Background] Polling timeout reached after ${totalElapsed}s for session ${session.id}. Questions may not be generated yet.`);
            // Track generation failure due to timeout
            mixpanelService.trackQuizQuestionsGenerationFailed({
              user_id: user.id,
              session_id: session.id,
              email: user.email || '',
              phone: user.phone,
              subject: subject,
              error_message: `Polling timeout after ${totalElapsed}s`
            });
          }
        } catch (error) {
          console.error(`❌ [Background] Fatal error in polling loop for session ${session.id}:`, error);
          // Track fatal error
          mixpanelService.trackQuizQuestionsGenerationFailed({
            user_id: user.id,
            session_id: session.id,
            email: user.email || '',
            phone: user.phone,
            subject: subject,
            error_message: error.message
          });
        }
      })(); // Immediately invoke async function - runs in background
      
      // Note: We're not awaiting the background task, so response returns immediately
      console.log('✅ Background polling started - API will return response immediately');
    }

    // Prepare quiz info and first question similar to start_quiz
    const finalQuestions = await questionService.getQuestionsBySession(session.id);
    // Ensure total reflects DB state; preserve type counts if already computed
    quizInfo.total_questions = finalQuestions.length;
    quizInfo.questions_generated = finalQuestions.length === 10; // Only true when exactly 10 questions
    
    // CRITICAL: Recalculate questionAdded based on final count - must be exactly 10
    questionAdded = finalQuestions.length === 10;

    let firstQuestion = null;
    if (finalQuestions.length > 0) {
      firstQuestion = finalQuestions[0];
    }

    // Determine message based on question status
    let responseMessage = 'Quiz started successfully';
    if (!questionAdded) {
      if (finalQuestions.length === 0) {
        responseMessage = 'Quiz started successfully. Questions are being generated in the background. Please check back in a few moments.';
      } else if (finalQuestions.length < 10) {
        responseMessage = `Quiz started successfully. ${finalQuestions.length} questions generated so far (need 10). Questions are being generated in the background. Please check back in a few moments.`;
      }
    }
    
    return res.status(201).json({
      success: true,
      message: responseMessage,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          subject: user.subject,
          created_at: user.created_at
        },
        certified_skill: {
          id: certifiedSkillId,
          subject_name: (certifiedResponse && certifiedResponse.data && certifiedResponse.data.subject_name) ? certifiedResponse.data.subject_name : subject,
          quiz_status: (certifiedResponse && certifiedResponse.data && certifiedResponse.data.quiz_status) ? certifiedResponse.data.quiz_status : 'unknown',
          is_paid: (certifiedResponse && certifiedResponse.data && typeof certifiedResponse.data.is_paid !== 'undefined') ? certifiedResponse.data.is_paid : false
        },
        session: {
          id: session.id,
          certified_token: session.certified_token,
          token_expiration: session.certified_token_expires_at
        },
        quiz: quizInfo,
        first_question: firstQuestion ? {
          question_id: firstQuestion.id,
          question: firstQuestion.question
        } : null,
        question_added: questionAdded
      }
    });
  } catch (error) {
    console.error('Error in start_quiz_clone_v2 endpoint:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * @swagger
 * /api/start_quiz_clone_v3:
 *   post:
 *     summary: Start a quiz session (clone v3) with optional subject resolution via API
 *     description: Same as /api/start_quiz_clone_v2 but with optional subject resolution. You can provide either 'subject' directly OR 'list' and 'option' to resolve subject from API. Email parameter is optional or can be empty string.
 *     tags: [Quiz]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *             properties:
 *               phone:
 *                 type: string
 *                 description: User's phone number
 *                 example: "918007880283"
 *               subject:
 *                 type: string
 *                 description: Subject/course name (optional - provide this OR list+option)
 *                 example: "catia advanced"
 *               list:
 *                 type: string
 *                 description: List of subjects (optional - provide this with option to resolve subject via API)
 *                 example: "1. Agile Methodologies\n2. Scrum Master\n3. Risk Management\n4. Stakeholder Management\n5. Communication Skills"
 *               option:
 *                 type: string
 *                 description: Selected option from list (optional - provide this with list to resolve subject via API)
 *                 example: "2"
 *               name:
 *                 type: string
 *                 description: User's name (optional)
 *                 example: "John Doe"
 *               email:
 *                 type: string
 *                 description: User's email (optional, can be empty string - will be updated later by auto_submit_quiz_v2)
 *                 example: "john@example.com"
 *               session_id:
 *                 type: string
 *                 description: Existing session ID (optional)
 *                 example: "uuid"
 *           examples:
 *             with_list_and_option:
 *               summary: With list and option (subject resolution via API)
 *               value:
 *                 name: "John Doe"
 *                 email: "john@example.com"
 *                 phone: "918007880283"
 *                 subject: ""
 *                 list: "1. Agile Methodologies\n2. Scrum Master\n3. Risk Management\n4. Stakeholder Management\n5. Communication Skills"
 *                 option: "2"
 *             with_direct_subject:
 *               summary: With subject provided directly
 *               value:
 *                 name: "John Doe"
 *                 email: "john@example.com"
 *                 phone: "918007880283"
 *                 subject: "catia advanced"
 *             without_email:
 *               summary: Without email (email optional)
 *               value:
 *                 name: "John Doe"
 *                 phone: "918007880283"
 *                 subject: "catia advanced"
 *             empty_email:
 *               summary: With empty email string (will be updated by auto_submit_quiz_v2)
 *               value:
 *                 name: "John Doe"
 *                 email: ""
 *                 phone: "918007880283"
 *                 subject: "catia advanced"
 *     responses:
 *       201:
 *         description: Quiz started successfully (clone v3)
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/StartQuizResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         question_added:
 *                           type: boolean
 *                           description: True if questions were stored in this call; false otherwise
 *                           example: true
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
/**
 * Clone of start_quiz_clone_v2 with optional subject resolution via API.
 * Behavior:
 * - Email is optional or can be empty string; email can be updated later using auto_submit_quiz_v2
 * - Subject can be provided directly OR resolved via API using list and option
 * - If user+subject not found: runs the normal start_quiz flow
 * - If user exists: uses provided session_id or latest session; if no session, creates one
 * - If session has no questions: tries generate; if generate result has empty arrays, skip storing
 * - Returns same schema as start_quiz_clone_v2, plus question_added: true/false
 */
router.post('/start_quiz_clone_v3', validateStartQuizCloneV3, async (req, res) => {
  try {
    const { name, email, phone, subject, list, option, session_id: providedSessionId } = req.body;

    // Track quiz started (subject may be determined later)
    mixpanelService.trackQuizStarted({
      email: email || '',
      phone,
      name,
      subject: subject || 'pending',
      endpoint: 'start_quiz_clone_v3',
      list,
      option
    });

    // Use email as provided (can be empty string or undefined)
    const userEmail = email || '';

    // Determine the subject to use
    let finalSubject = subject; // Default to provided subject
    
    // If subject not provided, try to get from API using list and option
    if (!subject || subject.trim() === '') {
      if (list && option && list.trim() !== '' && option.trim() !== '') {
        console.log('📞 Calling API to get subject from list and option...');
        try {
          finalSubject = await certifiedApiService.getSubjectFromList(list, option);
          console.log('✅ Received subject from API:', finalSubject);
        } catch (error) {
          console.error('❌ Error getting subject from API:', error.message);
          return res.status(500).json({
            success: false,
            message: 'Failed to get subject from list and option',
            error: error.message
          });
        }
      }
    }
    
    // Validate finalSubject exists
    if (!finalSubject || finalSubject.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Subject is required. Either provide subject directly or provide list and option to get subject.'
      });
    }

    // Find or create user
    let user;
    
    // First, try to lookup by phone only (regardless of subject)
    const phoneOnlyLookupQuery = `
      SELECT id, name, email, phone, subject, created_at
      FROM users
      WHERE phone = $1
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const phoneOnlyRes = await query(phoneOnlyLookupQuery, [phone]);
    
    if (phoneOnlyRes.rows.length > 0) {
      const foundUser = phoneOnlyRes.rows[0];
      
      // Check if subject matches
      if (foundUser.subject === finalSubject) {
        // Subject matches - use the user as is
        user = foundUser;
        console.log('✅ Found user by phone with matching subject');
      } else {
        // Subject doesn't match - update the user's subject to match request
        console.log(`⚠️  User found by phone but subject mismatch. Updating subject from "${foundUser.subject}" to "${finalSubject}"`);
        const updateSubjectQuery = `
          UPDATE users
          SET subject = $1, updated_at = NOW()
          WHERE id = $2
          RETURNING id, name, email, phone, subject, created_at
        `;
        const updateRes = await query(updateSubjectQuery, [finalSubject, foundUser.id]);
        user = updateRes.rows[0];
        console.log('✅ Updated user subject to match request');
      }
    } else {
      // User not found by phone - create new user
      if (!name) {
        return res.status(400).json({
          success: false,
          message: 'User not found. Provide name to create a new user.'
        });
      }
      
      // Create new user
      if (userEmail && userEmail.trim() !== '') {
        // Email provided - use userService.createUser
        user = await userService.createUser({ name, email: userEmail, phone, subject: finalSubject });
      } else {
        // Email is empty or not provided - create directly with empty string
        // Email column has NOT NULL constraint, so we must use empty string, not NULL
        try {
          console.log('📝 Creating new user with empty email');
          const createUserQuery = `
            INSERT INTO users(name, email, phone, subject, created_at)
            VALUES ($1, '', $2, $3, NOW())
            RETURNING id, name, email, phone, subject, created_at
          `;
          const createRes = await query(createUserQuery, [name, phone, finalSubject]);
          user = createRes.rows[0];
          console.log('✅ Created new user with ID:', user.id);
        } catch (createError) {
          // If duplicate key error (email UNIQUE constraint), find existing user with empty email
          if (createError.code === '23505' && createError.constraint === 'users_email_key') {
            console.log('⚠️  User with empty email already exists (UNIQUE constraint), finding by phone');
            // Try to find user with empty email and matching phone
            const findEmptyEmailQuery = `
              SELECT id, name, email, phone, subject, created_at
              FROM users
              WHERE email = '' AND phone = $1
              ORDER BY created_at DESC
              LIMIT 1
            `;
            const findRes = await query(findEmptyEmailQuery, [phone]);
            if (findRes.rows.length > 0) {
              // Found user with empty email - update subject
              const updateSubjectQuery = `
                UPDATE users
                SET subject = $1, updated_at = NOW()
                WHERE id = $2
                RETURNING id, name, email, phone, subject, created_at
              `;
              const updateRes = await query(updateSubjectQuery, [finalSubject, findRes.rows[0].id]);
              user = updateRes.rows[0];
              console.log('✅ Found user with empty email and updated subject');
            } else {
              // User with empty email exists but for different phone
              // Update the existing user's phone and subject to match
              console.log('⚠️  User with empty email exists for different phone, updating...');
              const updateUserQuery = `
                UPDATE users
                SET phone = $1, subject = $2, updated_at = NOW()
                WHERE email = ''
                RETURNING id, name, email, phone, subject, created_at
              `;
              const updateRes = await query(updateUserQuery, [phone, finalSubject]);
              if (updateRes.rows.length > 0) {
                user = updateRes.rows[0];
                console.log('✅ Updated existing user with empty email to match phone+subject');
              } else {
                throw new Error('Failed to update user with empty email');
              }
            }
          } else {
            throw createError;
          }
        }
      }
    }

    // Resolve session: use provided session_id or latest for user
    let session;
    if (providedSessionId) {
      // Only accept provided session if it belongs to this user and subject
      const sessRes = await query(
        'SELECT id, user_id, certified_user_id, certified_token, certified_token_expires_at, subject, created_at FROM sessions WHERE id = $1 AND user_id = $2 AND subject = $3',
        [providedSessionId, user.id, finalSubject]
      );
      session = sessRes.rows[0] || null;
    }
    if (!session) {
      // Strictly fetch the latest session for this user and this subject
      const latestSessionQuery = `
        SELECT id, user_id, certified_user_id, certified_token, certified_token_expires_at, subject, created_at
        FROM sessions
        WHERE user_id = $1 AND subject = $2
        ORDER BY created_at DESC
        LIMIT 1
      `;
      const sres = await query(latestSessionQuery, [user.id, finalSubject]);
      session = sres.rows[0] || null;
    }

    // If no session, create one via certified API then create session record
    let certifiedSkillId;
    let certifiedResponse = null;
    if (!session) {
      certifiedResponse = await certifiedApiService.createNewEntry(finalSubject);
      if (certifiedResponse.result !== 'success') {
        throw new Error(`Certified API error: ${certifiedResponse.message}`);
      }
      certifiedSkillId = certifiedResponse.data.id;
      const certifiedToken = userService.generateCertifiedToken();
      const tokenExpiration = userService.getTokenExpirationTime();
      session = await userService.createSession(
        user.id,
        certifiedSkillId,
        certifiedToken,
        tokenExpiration,
        finalSubject
      );
    } else {
      certifiedSkillId = parseInt(session.certified_user_id);
    }

    // Prepare quiz info (will update below)
    let quizInfo = {
      total_questions: 0,
      questions_generated: false,
      question_types: { easy: 0, medium: 0, hard: 0 }
    };

    // Check if questions already exist for this session
    // CRITICAL: question_added should only be true when exactly 10 questions are stored
    const existingQuestions = await questionService.getQuestionsBySession(session.id);
    let questionAdded = existingQuestions && existingQuestions.length === 10;
    if (questionAdded) {
      quizInfo = {
        total_questions: existingQuestions.length,
        questions_generated: true,
        question_types: { easy: 0, medium: 0, hard: 0 }
      };
    } else if (existingQuestions && existingQuestions.length > 0 && existingQuestions.length < 10) {
      // Partial questions exist but not all 10 - set to false and continue polling
      console.log(`⚠️  Only ${existingQuestions.length} questions found (need 10). question_added will be false.`);
      quizInfo = {
        total_questions: existingQuestions.length,
        questions_generated: false,
        question_types: { easy: 0, medium: 0, hard: 0 }
      };
    }

    // If no questions, start background polling (non-blocking)
    if (!questionAdded) {
      console.log('🔄 Starting background polling for quiz generation...');
      
      // Start polling in background - don't await, let it run asynchronously
      // This ensures API response returns immediately within timeout limit
      (async () => {
        const pollDelay = 3000; // 3 seconds between polls
        const maxPollingTime = 90000; // 90 seconds maximum
        const startTime = Date.now();
        let attempt = 0;
        let questionAddedInBackground = false;
        let quizData;
        
        try {
          while (!questionAddedInBackground && (Date.now() - startTime) < maxPollingTime) {
            attempt++;
            const elapsedTime = Math.round((Date.now() - startTime) / 1000);
            
            try {
              console.log(`🔄 [Background] Polling generate API (attempt ${attempt}, ${elapsedTime}s elapsed) for session ${session.id}...`);
              quizData = await generateQuizService.generateQuiz(certifiedSkillId);
              
              // Check if we have questions available in all three arrays
              const questionnaire = quizData?.data?.quiz_question_answer?.questionaire || {};
              const easyArr = Array.isArray(questionnaire.easy) ? questionnaire.easy : [];
              const medArr = Array.isArray(questionnaire.medium) ? questionnaire.medium : [];
              const hardArr = Array.isArray(questionnaire.hard) ? questionnaire.hard : [];
              const totalQuestionsAvailable = easyArr.length + medArr.length + hardArr.length;
              
              console.log(`📊 [Background] Quiz data received - Status: ${quizData?.data?.quiz_status || 'unknown'}, Questions available: ${totalQuestionsAvailable} (Easy: ${easyArr.length}, Medium: ${medArr.length}, Hard: ${hardArr.length}) for session ${session.id}`);
              
              // Check if all three arrays have questions populated
              const hasEasyQuestions = easyArr.length > 0;
              const hasMediumQuestions = medArr.length > 0;
              const hasHardQuestions = hardArr.length > 0;
              const allArraysPopulated = hasEasyQuestions && hasMediumQuestions && hasHardQuestions;
              
              // If we have questions available, try to extract and store them
              if (totalQuestionsAvailable > 0) {
                if (allArraysPopulated) {
                  console.log(`✅ [Background] All question arrays are populated! Extracting questions for session ${session.id}...`);
                } else {
                  console.log(`⚠️  [Background] Not all arrays populated yet (Easy: ${hasEasyQuestions}, Medium: ${hasMediumQuestions}, Hard: ${hasHardQuestions}) for session ${session.id}. Continuing to poll...`);
                }
                
                // Only extract and store when all arrays are populated AND we have exactly 10 questions
                // Keep polling until we have all 10 questions ready
                if (allArraysPopulated) {
                  try {
                    const questions = generateQuizService.extractQuestions(quizData);
                    // CRITICAL: Only store in database if we have exactly 10 questions
                    if (questions.length === 10) {
                      console.log(`✅ [Background] Extracted exactly 10 questions, storing in database for session ${session.id}...`);
                      await questionService.createQuestions(questions, session.id, user.id);
                      questionAddedInBackground = true;
                      
                      // Track questions generated
                      mixpanelService.trackQuizQuestionsGenerated({
                        user_id: user.id,
                        session_id: session.id,
                        email: user.email || '',
                        phone: user.phone,
                        subject: subject,
                        total_questions: questions.length,
                        question_types: {
                          easy: questions.filter(q => q.question_type === 'Easy').length,
                          medium: questions.filter(q => q.question_type === 'Medium').length,
                          hard: questions.filter(q => q.question_type === 'Hard').length
                        }
                      });
                      
                      console.log(`✅ [Background] Successfully stored all 10 questions for session ${session.id}!`);
                      break; // Exit polling loop on success
                    } else {
                      console.log(`⏳ [Background] All arrays populated but only extracted ${questions.length} questions (need exactly 10). Continuing to poll for session ${session.id}...`);
                      // Continue polling - don't store partial questions
                    }
                  } catch (extractError) {
                    console.error(`❌ [Background] Error extracting questions for session ${session.id}:`, extractError.message);
                    // Continue polling
                  }
                } else {
                  console.log(`⏳ [Background] Waiting for all arrays to be populated (Easy: ${hasEasyQuestions}, Medium: ${hasMediumQuestions}, Hard: ${hasHardQuestions}) for session ${session.id}...`);
                }
              } else {
                console.log(`⏳ [Background] No questions available yet for session ${session.id}, continuing to poll...`);
              }
              
              // Wait before next poll (unless we're done)
              if (!questionAddedInBackground && (Date.now() - startTime) < maxPollingTime) {
                await new Promise(resolve => setTimeout(resolve, pollDelay));
              }
              
            } catch (e) {
              console.error(`❌ [Background] Quiz generation API error (attempt ${attempt}) for session ${session.id}:`, e.message);
              // Wait before retrying even on error
              if ((Date.now() - startTime) < maxPollingTime) {
                await new Promise(resolve => setTimeout(resolve, pollDelay));
              }
            }
          }
          
          if (!questionAddedInBackground) {
            const totalElapsed = Math.round((Date.now() - startTime) / 1000);
            console.warn(`⚠️  [Background] Polling timeout reached after ${totalElapsed}s for session ${session.id}. Questions may not be generated yet.`);
            // Track generation failure due to timeout
            mixpanelService.trackQuizQuestionsGenerationFailed({
              user_id: user.id,
              session_id: session.id,
              email: user.email || '',
              phone: user.phone,
              subject: subject,
              error_message: `Polling timeout after ${totalElapsed}s`
            });
          }
        } catch (error) {
          console.error(`❌ [Background] Fatal error in polling loop for session ${session.id}:`, error);
          // Track fatal error
          mixpanelService.trackQuizQuestionsGenerationFailed({
            user_id: user.id,
            session_id: session.id,
            email: user.email || '',
            phone: user.phone,
            subject: subject,
            error_message: error.message
          });
        }
      })(); // Immediately invoke async function - runs in background
      
      // Note: We're not awaiting the background task, so response returns immediately
      console.log('✅ Background polling started - API will return response immediately');
    }

    // Prepare quiz info and first question similar to start_quiz
    const finalQuestions = await questionService.getQuestionsBySession(session.id);
    // Ensure total reflects DB state; preserve type counts if already computed
    quizInfo.total_questions = finalQuestions.length;
    quizInfo.questions_generated = finalQuestions.length === 10; // Only true when exactly 10 questions
    
    // CRITICAL: Recalculate questionAdded based on final count - must be exactly 10
    questionAdded = finalQuestions.length === 10;

    let firstQuestion = null;
    if (finalQuestions.length > 0) {
      firstQuestion = finalQuestions[0];
    }

    // Determine message based on question status
    let responseMessage = 'Quiz started successfully';
    if (!questionAdded) {
      if (finalQuestions.length === 0) {
        responseMessage = 'Quiz started successfully. Questions are being generated in the background. Please check back in a few moments.';
      } else if (finalQuestions.length < 10) {
        responseMessage = `Quiz started successfully. ${finalQuestions.length} questions generated so far (need 10). Questions are being generated in the background. Please check back in a few moments.`;
      }
    }
    
    return res.status(201).json({
      success: true,
      message: responseMessage,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          subject: user.subject,
          created_at: user.created_at
        },
        certified_skill: {
          id: certifiedSkillId,
          subject_name: (certifiedResponse && certifiedResponse.data && certifiedResponse.data.subject_name) ? certifiedResponse.data.subject_name : finalSubject,
          quiz_status: (certifiedResponse && certifiedResponse.data && certifiedResponse.data.quiz_status) ? certifiedResponse.data.quiz_status : 'unknown',
          is_paid: (certifiedResponse && certifiedResponse.data && typeof certifiedResponse.data.is_paid !== 'undefined') ? certifiedResponse.data.is_paid : false
        },
        session: {
          id: session.id,
          certified_token: session.certified_token,
          token_expiration: session.certified_token_expires_at
        },
        quiz: quizInfo,
        first_question: firstQuestion ? {
          question_id: firstQuestion.id,
          question: firstQuestion.question
        } : null,
        question_added: questionAdded
      }
    });
  } catch (error) {
    console.error('Error in start_quiz_clone_v3 endpoint:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * @swagger
 * /api/start_quiz_clone_v4_cybersecurity:
 *   post:
 *     summary: Start a quiz session (clone v4 cybersecurity) with optional subject resolution via API
 *     description: Same as /api/start_quiz_clone_v3 but specifically for cybersecurity quizzes with different response format. When questions have code_snippet, the code_image URL is stored in code_snippet_imageLink instead of appending code to question text. Email parameter is optional or can be empty string. You can provide either 'subject' directly OR 'list' and 'option' to resolve subject from API.
 *     tags: [Quiz]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *             properties:
 *               phone:
 *                 type: string
 *                 description: User's phone number
 *                 example: "918007880283"
 *               subject:
 *                 type: string
 *                 description: Subject/course name (optional - provide this OR list+option)
 *                 example: "Cybersecurity"
 *               list:
 *                 type: string
 *                 description: List of subjects (optional - provide this with option to resolve subject via API)
 *                 example: "1. Agile Methodologies\n2. Scrum Master\n3. Risk Management\n4. Stakeholder Management\n5. Communication Skills"
 *               option:
 *                 type: string
 *                 description: Selected option from list (optional - provide this with list to resolve subject via API)
 *                 example: "2"
 *               name:
 *                 type: string
 *                 description: User's name (optional)
 *                 example: "John Doe"
 *               email:
 *                 type: string
 *                 description: User's email (optional, can be empty string - will be updated later by auto_submit_quiz_v2)
 *                 example: "john@example.com"
 *               session_id:
 *                 type: string
 *                 description: Existing session ID (optional)
 *                 example: "uuid"
 *           examples:
 *             with_list_and_option:
 *               summary: With list and option (subject resolution via API)
 *               value:
 *                 name: "John Doe"
 *                 email: "john@example.com"
 *                 phone: "918007880283"
 *                 subject: ""
 *                 list: "1. Agile Methodologies\n2. Scrum Master\n3. Risk Management\n4. Stakeholder Management\n5. Communication Skills"
 *                 option: "2"
 *             with_direct_subject:
 *               summary: With subject provided directly
 *               value:
 *                 name: "John Doe"
 *                 email: "john@example.com"
 *                 phone: "918007880283"
 *                 subject: "Cybersecurity"
 *             without_email:
 *               summary: Without email (email optional)
 *               value:
 *                 name: "John Doe"
 *                 phone: "918007880283"
 *                 subject: "Cybersecurity"
 *             empty_email:
 *               summary: With empty email string (will be updated by auto_submit_quiz_v2)
 *               value:
 *                 name: "John Doe"
 *                 email: ""
 *                 phone: "918007880283"
 *                 subject: "Cybersecurity"
 *     responses:
 *       201:
 *         description: Quiz started successfully (clone v4 cybersecurity)
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/StartQuizResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         question_added:
 *                           type: boolean
 *                           description: True if questions were stored in this call; false otherwise
 *                           example: true
 *                         first_question:
 *                           type: object
 *                           nullable: true
 *                           properties:
 *                             question_id:
 *                               type: string
 *                               format: uuid
 *                             question:
 *                               type: string
 *                             code_snippet_imageLink:
 *                               type: string
 *                               nullable: true
 *                               description: URL to code image if question has code snippet, null otherwise
 *                               example: "https://certified-fallback.s3.amazonaws.com/code-1.png"
 *                             has_code_image:
 *                               type: boolean
 *                               description: True if code_snippet_imageLink has a non-empty value
 *                               example: true
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
/**
 * Clone of start_quiz_clone_v3 specifically for cybersecurity quizzes with different response format.
 * Behavior:
 * - Email is optional or can be empty string; email can be updated later using auto_submit_quiz_v2
 * - Subject can be provided directly OR resolved via API using list and option
 * - If user+subject not found: runs the normal start_quiz flow
 * - If user exists: uses provided session_id or latest session; if no session, creates one
 * - If session has no questions: tries generate; if generate result has empty arrays, skip storing
 * - Uses extractQuestionsCybersecurity() which:
 *   - Strictly picks q_id 1-4 (Easy), 11-13 (Medium), 17-19 (Hard) and only falls back to earlier entries if a required q_id is missing so that 10 questions are always stored in order
 *   - Stores any provided code_image/codee_image URLs in code_snippet_imageLink instead of appending code text
 *   - When no code image exists but markdown does, appends the markdown content as a monospace block to the question
 *   - Only appends raw code snippets when neither code image nor markdown is present
 * - Returns same schema as start_quiz_clone_v3, plus question_added: true/false
 * - first_question always includes code_snippet_imageLink (null if empty) and has_code_image (boolean)
 */
router.post('/start_quiz_clone_v4_cybersecurity', validateStartQuizCloneV3, async (req, res) => {
  try {
    const { name, email, phone, subject, list, option, session_id: providedSessionId } = req.body;

    // Track quiz started (subject may be determined later)
    mixpanelService.trackQuizStarted({
      email: email || '',
      phone,
      name,
      subject: subject || 'pending',
      endpoint: 'start_quiz_clone_v4_cybersecurity',
      list,
      option
    });

    // Use email as provided (can be empty string or undefined)
    const userEmail = email || '';

    // Determine the subject to use
    let finalSubject = subject; // Default to provided subject
    
    // If subject not provided, try to get from API using list and option
    if (!subject || subject.trim() === '') {
      if (list && option && list.trim() !== '' && option.trim() !== '') {
        console.log('📞 Calling API to get subject from list and option...');
        try {
          finalSubject = await certifiedApiService.getSubjectFromList(list, option);
          console.log('✅ Received subject from API:', finalSubject);
        } catch (error) {
          console.error('❌ Error getting subject from API:', error.message);
          return res.status(500).json({
            success: false,
            message: 'Failed to get subject from list and option',
            error: error.message
          });
        }
      }
    }
    
    // Validate finalSubject exists
    if (!finalSubject || finalSubject.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Subject is required. Either provide subject directly or provide list and option to get subject.'
      });
    }

    // Find or create user
    let user;
    
    // First, try to lookup by phone only (regardless of subject)
    const phoneOnlyLookupQuery = `
      SELECT id, name, email, phone, subject, created_at
      FROM users
      WHERE phone = $1
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const phoneOnlyRes = await query(phoneOnlyLookupQuery, [phone]);
    
    if (phoneOnlyRes.rows.length > 0) {
      const foundUser = phoneOnlyRes.rows[0];
      
      // Check if subject matches
      if (foundUser.subject === finalSubject) {
        // Subject matches - use the user as is
        user = foundUser;
        console.log('✅ Found user by phone with matching subject');
      } else {
        // Subject doesn't match - update the user's subject to match request
        console.log(`⚠️  User found by phone but subject mismatch. Updating subject from "${foundUser.subject}" to "${finalSubject}"`);
        const updateSubjectQuery = `
          UPDATE users
          SET subject = $1, updated_at = NOW()
          WHERE id = $2
          RETURNING id, name, email, phone, subject, created_at
        `;
        const updateRes = await query(updateSubjectQuery, [finalSubject, foundUser.id]);
        user = updateRes.rows[0];
        console.log('✅ Updated user subject to match request');
      }
    } else {
      // User not found by phone - create new user
      if (!name) {
        return res.status(400).json({
          success: false,
          message: 'User not found. Provide name to create a new user.'
        });
      }
      
      // Create new user
      if (userEmail && userEmail.trim() !== '') {
        // Email provided - use userService.createUser
        user = await userService.createUser({ name, email: userEmail, phone, subject: finalSubject });
      } else {
        // Email is empty or not provided - create directly with empty string
        // Email column has NOT NULL constraint, so we must use empty string, not NULL
        try {
          console.log('📝 Creating new user with empty email');
          const createUserQuery = `
            INSERT INTO users(name, email, phone, subject, created_at)
            VALUES ($1, '', $2, $3, NOW())
            RETURNING id, name, email, phone, subject, created_at
          `;
          const createRes = await query(createUserQuery, [name, phone, finalSubject]);
          user = createRes.rows[0];
          console.log('✅ Created new user with ID:', user.id);
        } catch (createError) {
          // If duplicate key error (email UNIQUE constraint), find existing user with empty email
          if (createError.code === '23505' && createError.constraint === 'users_email_key') {
            console.log('⚠️  User with empty email already exists (UNIQUE constraint), finding by phone');
            // Try to find user with empty email and matching phone
            const findEmptyEmailQuery = `
              SELECT id, name, email, phone, subject, created_at
              FROM users
              WHERE email = '' AND phone = $1
              ORDER BY created_at DESC
              LIMIT 1
            `;
            const findRes = await query(findEmptyEmailQuery, [phone]);
            if (findRes.rows.length > 0) {
              // Found user with empty email - update subject
              const updateSubjectQuery = `
                UPDATE users
                SET subject = $1, updated_at = NOW()
                WHERE id = $2
                RETURNING id, name, email, phone, subject, created_at
              `;
              const updateRes = await query(updateSubjectQuery, [finalSubject, findRes.rows[0].id]);
              user = updateRes.rows[0];
              console.log('✅ Found user with empty email and updated subject');
            } else {
              // User with empty email exists but for different phone
              // Update the existing user's phone and subject to match
              console.log('⚠️  User with empty email exists for different phone, updating...');
              const updateUserQuery = `
                UPDATE users
                SET phone = $1, subject = $2, updated_at = NOW()
                WHERE email = ''
                RETURNING id, name, email, phone, subject, created_at
              `;
              const updateRes = await query(updateUserQuery, [phone, finalSubject]);
              if (updateRes.rows.length > 0) {
                user = updateRes.rows[0];
                console.log('✅ Updated existing user with empty email to match phone+subject');
              } else {
                throw new Error('Failed to update user with empty email');
              }
            }
          } else {
            throw createError;
          }
        }
      }
    }

    // Resolve session: use provided session_id or latest for user
    let session;
    if (providedSessionId) {
      // Only accept provided session if it belongs to this user and subject
      const sessRes = await query(
        'SELECT id, user_id, certified_user_id, certified_token, certified_token_expires_at, subject, created_at FROM sessions WHERE id = $1 AND user_id = $2 AND subject = $3',
        [providedSessionId, user.id, finalSubject]
      );
      session = sessRes.rows[0] || null;
    }
    if (!session) {
      // Strictly fetch the latest session for this user and this subject
      const latestSessionQuery = `
        SELECT id, user_id, certified_user_id, certified_token, certified_token_expires_at, subject, created_at
        FROM sessions
        WHERE user_id = $1 AND subject = $2
        ORDER BY created_at DESC
        LIMIT 1
      `;
      const sres = await query(latestSessionQuery, [user.id, finalSubject]);
      session = sres.rows[0] || null;
    }

    // If no session, create one via certified API then create session record
    let certifiedSkillId;
    let certifiedResponse = null;
    if (!session) {
      certifiedResponse = await certifiedApiService.createNewEntry(finalSubject);
      if (certifiedResponse.result !== 'success') {
        throw new Error(`Certified API error: ${certifiedResponse.message}`);
      }
      certifiedSkillId = certifiedResponse.data.id;
      const certifiedToken = userService.generateCertifiedToken();
      const tokenExpiration = userService.getTokenExpirationTime();
      session = await userService.createSession(
        user.id,
        certifiedSkillId,
        certifiedToken,
        tokenExpiration,
        finalSubject
      );
    } else {
      certifiedSkillId = parseInt(session.certified_user_id);
    }

    // Prepare quiz info (will update below)
    let quizInfo = {
      total_questions: 0,
      questions_generated: false,
      question_types: { easy: 0, medium: 0, hard: 0 }
    };

    // Check if questions already exist for this session
    // CRITICAL: question_added should only be true when exactly 10 questions are stored
    const existingQuestions = await questionService.getQuestionsBySession(session.id);
    let questionAdded = existingQuestions && existingQuestions.length === 10;
    if (questionAdded) {
      quizInfo = {
        total_questions: existingQuestions.length,
        questions_generated: true,
        question_types: { easy: 0, medium: 0, hard: 0 }
      };
    } else if (existingQuestions && existingQuestions.length > 0 && existingQuestions.length < 10) {
      // Partial questions exist but not all 10 - set to false and continue polling
      console.log(`⚠️  Only ${existingQuestions.length} questions found (need 10). question_added will be false.`);
      quizInfo = {
        total_questions: existingQuestions.length,
        questions_generated: false,
        question_types: { easy: 0, medium: 0, hard: 0 }
      };
    }

    // If no questions, start background polling (non-blocking)
    if (!questionAdded) {
      console.log('🔄 Starting background polling for quiz generation...');
      
      // Start polling in background - don't await, let it run asynchronously
      // This ensures API response returns immediately within timeout limit
      (async () => {
        const pollDelay = 3000; // 3 seconds between polls
        const maxPollingTime = 90000; // 90 seconds maximum
        const startTime = Date.now();
        let attempt = 0;
        let questionAddedInBackground = false;
        let quizData;
        
        try {
          while (!questionAddedInBackground && (Date.now() - startTime) < maxPollingTime) {
            attempt++;
            const elapsedTime = Math.round((Date.now() - startTime) / 1000);
            
            try {
              console.log(`🔄 [Background] Polling generate API (attempt ${attempt}, ${elapsedTime}s elapsed) for session ${session.id}...`);
              quizData = await generateQuizService.generateQuiz(certifiedSkillId);
              
              // Check if we have questions available in all three arrays
              const questionnaire = quizData?.data?.quiz_question_answer?.questionaire || {};
              const easyArr = Array.isArray(questionnaire.easy) ? questionnaire.easy : [];
              const medArr = Array.isArray(questionnaire.medium) ? questionnaire.medium : [];
              const hardArr = Array.isArray(questionnaire.hard) ? questionnaire.hard : [];
              const totalQuestionsAvailable = easyArr.length + medArr.length + hardArr.length;
              
              console.log(`📊 [Background] Quiz data received - Status: ${quizData?.data?.quiz_status || 'unknown'}, Questions available: ${totalQuestionsAvailable} (Easy: ${easyArr.length}, Medium: ${medArr.length}, Hard: ${hardArr.length}) for session ${session.id}`);
              
              // Check if all three arrays have questions populated
              const hasEasyQuestions = easyArr.length > 0;
              const hasMediumQuestions = medArr.length > 0;
              const hasHardQuestions = hardArr.length > 0;
              const allArraysPopulated = hasEasyQuestions && hasMediumQuestions && hasHardQuestions;
              
              // If we have questions available, try to extract and store them
              if (totalQuestionsAvailable > 0) {
                if (allArraysPopulated) {
                  console.log(`✅ [Background] All question arrays are populated! Extracting questions for session ${session.id}...`);
                } else {
                  console.log(`⚠️  [Background] Not all arrays populated yet (Easy: ${hasEasyQuestions}, Medium: ${hasMediumQuestions}, Hard: ${hasHardQuestions}) for session ${session.id}. Continuing to poll...`);
                }
                
                // Only extract and store when all arrays are populated AND we have exactly 10 questions
                // Keep polling until we have all 10 questions ready
                if (allArraysPopulated) {
                  try {
                    const questions = generateQuizService.extractQuestionsCybersecurity(quizData);
                    // CRITICAL: Only store in database if we have exactly 10 questions
                    if (questions.length === 10) {
                      console.log(`✅ [Background] Extracted exactly 10 questions, storing in database for session ${session.id}...`);
                      await questionService.createQuestions(questions, session.id, user.id);
                      questionAddedInBackground = true;
                      
                      // Track questions generated
                      mixpanelService.trackQuizQuestionsGenerated({
                        user_id: user.id,
                        session_id: session.id,
                        email: user.email || '',
                        phone: user.phone,
                        subject: subject,
                        total_questions: questions.length,
                        question_types: {
                          easy: questions.filter(q => q.question_type === 'Easy').length,
                          medium: questions.filter(q => q.question_type === 'Medium').length,
                          hard: questions.filter(q => q.question_type === 'Hard').length
                        }
                      });
                      
                      console.log(`✅ [Background] Successfully stored all 10 questions for session ${session.id}!`);
                      break; // Exit polling loop on success
                    } else {
                      console.log(`⏳ [Background] All arrays populated but only extracted ${questions.length} questions (need exactly 10). Continuing to poll for session ${session.id}...`);
                      // Continue polling - don't store partial questions
                    }
                  } catch (extractError) {
                    console.error(`❌ [Background] Error extracting questions for session ${session.id}:`, extractError.message);
                    // Continue polling
                  }
                } else {
                  console.log(`⏳ [Background] Waiting for all arrays to be populated (Easy: ${hasEasyQuestions}, Medium: ${hasMediumQuestions}, Hard: ${hasHardQuestions}) for session ${session.id}...`);
                }
              } else {
                console.log(`⏳ [Background] No questions available yet for session ${session.id}, continuing to poll...`);
              }
              
              // Wait before next poll (unless we're done)
              if (!questionAddedInBackground && (Date.now() - startTime) < maxPollingTime) {
                await new Promise(resolve => setTimeout(resolve, pollDelay));
              }
              
            } catch (e) {
              console.error(`❌ [Background] Quiz generation API error (attempt ${attempt}) for session ${session.id}:`, e.message);
              // Wait before retrying even on error
              if ((Date.now() - startTime) < maxPollingTime) {
                await new Promise(resolve => setTimeout(resolve, pollDelay));
              }
            }
          }
          
          if (!questionAddedInBackground) {
            const totalElapsed = Math.round((Date.now() - startTime) / 1000);
            console.warn(`⚠️  [Background] Polling timeout reached after ${totalElapsed}s for session ${session.id}. Questions may not be generated yet.`);
            // Track generation failure due to timeout
            mixpanelService.trackQuizQuestionsGenerationFailed({
              user_id: user.id,
              session_id: session.id,
              email: user.email || '',
              phone: user.phone,
              subject: subject,
              error_message: `Polling timeout after ${totalElapsed}s`
            });
          }
        } catch (error) {
          console.error(`❌ [Background] Fatal error in polling loop for session ${session.id}:`, error);
          // Track fatal error
          mixpanelService.trackQuizQuestionsGenerationFailed({
            user_id: user.id,
            session_id: session.id,
            email: user.email || '',
            phone: user.phone,
            subject: subject,
            error_message: error.message
          });
        }
      })(); // Immediately invoke async function - runs in background
      
      // Note: We're not awaiting the background task, so response returns immediately
      console.log('✅ Background polling started - API will return response immediately');
    }

    // Prepare quiz info and first question similar to start_quiz
    const finalQuestions = await questionService.getQuestionsBySession(session.id);
    // Ensure total reflects DB state; preserve type counts if already computed
    quizInfo.total_questions = finalQuestions.length;
    quizInfo.questions_generated = finalQuestions.length === 10; // Only true when exactly 10 questions
    
    // CRITICAL: Recalculate questionAdded based on final count - must be exactly 10
    questionAdded = finalQuestions.length === 10;

    let firstQuestion = null;
    if (finalQuestions.length > 0) {
      firstQuestion = finalQuestions[0];
    }

    // Determine message based on question status
    let responseMessage = 'Quiz started successfully';
    if (!questionAdded) {
      if (finalQuestions.length === 0) {
        responseMessage = 'Quiz started successfully. Questions are being generated in the background. Please check back in a few moments.';
      } else if (finalQuestions.length < 10) {
        responseMessage = `Quiz started successfully. ${finalQuestions.length} questions generated so far (need 10). Questions are being generated in the background. Please check back in a few moments.`;
      }
    }
    
    return res.status(201).json({
      success: true,
      message: responseMessage,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          subject: user.subject,
          created_at: user.created_at
        },
        certified_skill: {
          id: certifiedSkillId,
          subject_name: (certifiedResponse && certifiedResponse.data && certifiedResponse.data.subject_name) ? certifiedResponse.data.subject_name : finalSubject,
          quiz_status: (certifiedResponse && certifiedResponse.data && certifiedResponse.data.quiz_status) ? certifiedResponse.data.quiz_status : 'unknown',
          is_paid: (certifiedResponse && certifiedResponse.data && typeof certifiedResponse.data.is_paid !== 'undefined') ? certifiedResponse.data.is_paid : false
        },
        session: {
          id: session.id,
          certified_token: session.certified_token,
          token_expiration: session.certified_token_expires_at
        },
        quiz: quizInfo,
        first_question: firstQuestion ? {
          question_id: firstQuestion.id,
          question: firstQuestion.question,
          code_snippet_imageLink: firstQuestion.code_snippet_imageLink || null,
          has_code_image: !!(firstQuestion.code_snippet_imageLink && firstQuestion.code_snippet_imageLink.trim() !== '')
        } : null,
        question_added: questionAdded
      }
    });
  } catch (error) {
    console.error('Error in start_quiz_clone_v4_cybersecurity endpoint:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Validation middleware for save answer
const validateSaveAnswer = [
  body('question_id').isUUID().withMessage('question_id must be a valid UUID'),
  body('answer').isString().isLength({ min: 1, max: 1 }).withMessage('answer must be a single character (a, b, c, or d)'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    next();
  }
];

const validateQuizResponse = [
  body('name').isString().isLength({ min: 1 }).withMessage('name is required'),
  body('email').isEmail().withMessage('email must be a valid email address'),
  body('phone').isString().isLength({ min: 10 }).withMessage('phone must be at least 10 characters'),
  body('certified_user_skill_id').isInt().withMessage('certified_user_skill_id must be an integer'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        result: "failed",
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    next();
  }
];

/**
 * @swagger
 * /api/save_answer:
 *   post:
 *     summary: Save answer and get next question
 *     description: Saves the answer for a question and returns the next question in sequence. If it's the last question, returns completion status.
 *     tags: [Quiz]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - question_id
 *               - answer
 *             properties:
 *               question_id:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the question being answered
 *                 example: "123e4567-e89b-12d3-a456-426614174000"
 *               answer:
 *                 type: string
 *                 enum: [a, b, c, d]
 *                 description: The answer choice (a, b, c, or d)
 *                 example: "a"
 *           examples:
 *             valid_answer:
 *               summary: Valid answer submission
 *               value:
 *                 question_id: "123e4567-e89b-12d3-a456-426614174000"
 *                 answer: "a"
 *     responses:
 *       200:
 *         description: Answer saved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Answer saved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       enum: [pending, complete]
 *                       description: Status of the quiz
 *                     question:
 *                       type: string
 *                       description: Next question text (empty if quiz is complete)
 *                     question_id:
 *                       type: string
 *                       format: uuid
 *                       description: Next question ID (empty if quiz is complete)
 *                     question_no:
 *                       type: integer
 *                       description: Next question number (only present if status is pending)
 *                     current_question_no:
 *                       type: integer
 *                       description: The question number that was just answered
 *                     total_questions:
 *                       type: integer
 *                       description: Total number of questions in the quiz
 *                     scenario:
 *                       type: string
 *                       nullable: true
 *                       description: Scenario/context text (only present for question 5 or 8 if available)
 *                     has_scenario:
 *                       type: boolean
 *                       description: True if scenario is available for this question
 *                     code_snippet_imageLink:
 *                       type: string
 *                       nullable: true
 *                       description: URL to code image if question has code snippet (for cybersecurity questions), null otherwise
 *                       example: "https://certified-fallback.s3.amazonaws.com/code-1.png"
 *                     has_code_image:
 *                       type: boolean
 *                       description: True if code_snippet_imageLink has a non-empty value
 *                       example: true
 *             examples:
 *               next_question:
 *                 summary: Next question available
 *                 value:
 *                   success: true
 *                   message: "Answer saved successfully"
 *                   data:
 *                     status: "pending"
 *                     question: "What is the primary goal of Six Sigma?\n\nA. To reduce costs\nB. To improve customer satisfaction\nC. To eliminate defects\nD. To increase employee morale"
 *                     question_id: "123e4567-e89b-12d3-a456-426614174002"
 *                     question_no: 2
 *                     current_question_no: 1
 *                     total_questions: 10
 *                     scenario: null
 *                     has_scenario: false
 *                     code_snippet_imageLink: null
 *                     has_code_image: false
 *               next_question_with_code_image:
 *                 summary: Next question with code image (cybersecurity)
 *                 value:
 *                   success: true
 *                   message: "Answer saved successfully"
 *                   data:
 *                     status: "pending"
 *                     question: "Review this password reset function. What security vulnerability is present?"
 *                     question_id: "123e4567-e89b-12d3-a456-426614174003"
 *                     question_no: 4
 *                     current_question_no: 3
 *                     total_questions: 10
 *                     scenario: null
 *                     has_scenario: false
 *                     code_snippet_imageLink: "https://certified-fallback.s3.amazonaws.com/code-1.png"
 *                     has_code_image: true
 *               quiz_complete:
 *                 summary: Quiz completed
 *                 value:
 *                   success: true
 *                   message: "Answer saved successfully"
 *                   data:
 *                     status: "complete"
 *                     question: ""
 *                     question_id: ""
 *                     current_question_no: 10
 *                     total_questions: 10
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         description: Question or session not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Question not found or session mismatch"
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/save_answer', validateSaveAnswer, async (req, res) => {
  try {
    const { question_id, answer } = req.body;
    
    console.log(`📝 Saving answer for question ${question_id}: ${answer}`);
    
    // First, get the session_id from the question
    const questionQuery = `
      SELECT session_id, question_no FROM questions WHERE id = $1
    `;
    const questionResult = await query(questionQuery, [question_id]);
    
    if (questionResult.rows.length === 0) {
      // Track error
      mixpanelService.trackQuizError({
        endpoint: 'save_answer',
        error_message: 'Question not found',
        question_id
      });
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }
    
    const session_id = questionResult.rows[0].session_id;
    const question_no = questionResult.rows[0].question_no;
    console.log(`📝 Found session_id: ${session_id} for question: ${question_id}`);
    
    // Save answer and get next question
    const result = await questionService.saveAnswerAndGetNext(question_id, answer, session_id);
    
    // Track answer saved
    mixpanelService.trackAnswerSaved({
      question_id,
      session_id,
      question_number: question_no,
      answer,
      total_questions: result.total_questions || 0
    });

    // Track next question retrieved if available
    if (result.status === 'pending' && result.question_id) {
      mixpanelService.trackNextQuestionRetrieved({
        question_id: result.question_id,
        session_id,
        question_number: result.question_no || 0,
        total_questions: result.total_questions || 0
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Answer saved successfully',
      data: result
    });
    
  } catch (error) {
    console.error('Error in save_answer endpoint:', error);
    
    // Track error
    mixpanelService.trackQuizError({
      endpoint: 'save_answer',
      error_message: error.message,
      question_id: req.body?.question_id
    });
    
    if (error.message.includes('not found') || error.message.includes('mismatch')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
      ...(process.env.NODE_ENV === 'development' && { details: error.stack })
    });
  }
});

/**
 * @swagger
 * /api/submit_quiz_response:
 *   post:
 *     summary: Submit quiz response and update certified token
 *     description: Submits quiz response data and updates the certified token in the session
 *     tags: [Quiz]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - phone
 *               - certified_user_skill_id
 *             properties:
 *               name:
 *                 type: string
 *                 description: User's full name
 *                 example: "John Doe"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address
 *                 example: "john.doe@example.com"
 *               phone:
 *                 type: string
 *                 description: User's phone number (will be prefixed with +)
 *                 example: "1234567890"
 *               certified_user_skill_id:
 *                 type: integer
 *                 description: Certified user skill ID
 *                 example: 1771031
 *     responses:
 *       200:
 *         description: Quiz response submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Quiz response submitted successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         name:
 *                           type: string
 *                         email:
 *                           type: string
 *                         phone:
 *                           type: string
 *                     session:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         certified_skill_id:
 *                           type: integer
 *                         token_updated:
 *                           type: boolean
 *                     quiz_attempt:
 *                       type: object
 *       400:
 *         description: Validation error or bad request
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Validation failed"
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *       404:
 *         description: User or session not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "User not found"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 *                 error:
 *                   type: string
 *                   example: "Continue API request failed"
 */
router.post('/submit_quiz_response', validateQuizResponse, async (req, res) => {
  try {
    const { name, email, phone, certified_user_skill_id } = req.body;
    
    // Track quiz submitted
    mixpanelService.trackQuizSubmitted({
      email,
      phone,
      name,
      certified_user_skill_id,
      submission_type: 'manual',
      endpoint: 'submit_quiz_response'
    });
    
    // Use shared function for quiz response submission
    const result = await handleQuizResponseSubmission({
      name, email, phone, certified_user_skill_id
    });
    
    res.status(200).json(result);
    
  } catch (error) {
    console.error('Error in submit_quiz_response endpoint:', error);
    
    // Track submission failure
    mixpanelService.trackQuizSubmissionFailed({
      email: req.body?.email,
      phone: req.body?.phone,
      certified_user_skill_id: req.body?.certified_user_skill_id,
      error_message: error.message,
      endpoint: 'submit_quiz_response'
    });
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        result: "failed",
        message: error.message
      });
    }
    
    res.status(500).json({
      result: "failed",
      message: 'Internal server error',
      error: error.message,
      ...(process.env.NODE_ENV === 'development' && { details: error.stack })
    });
  }
});

/**
 * @swagger
 * /api/auto_submit_quiz:
 *   post:
 *     summary: Automatically submit quiz response using phone and subject
 *     description: Automatically triggers quiz submission using phone and subject to find the session. Fetches user and session data from database automatically.
 *     tags: [Quiz]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - subject
 *             properties:
 *               phone:
 *                 type: string
 *                 description: User's phone number to find the session
 *                 example: "918007880283"
 *               subject:
 *                 type: string
 *                 description: Subject/course name to find the session
 *                 example: "Java"
 *     responses:
 *       200:
 *         description: Quiz auto-submitted successfully - Returns same response as /api/submit_quiz_response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: string
 *                   enum: ["true_high_100", "true_high_90", "true_high_80", "true_high_70", "true_pass", "true_low"]
 *                   example: "true_high_80"
 *                   description: "true_high_100 (score 100), true_high_90 (score 90), true_high_80 (score 80), true_high_70 (score 70), true_pass (score 50-60), true_low (score 0-40)"
 *                 message:
 *                   type: string
 *                   example: "Quiz response submitted successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         name:
 *                           type: string
 *                         email:
 *                           type: string
 *                         phone:
 *                           type: string
 *                     session:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         certified_skill_id:
 *                           type: integer
 *                         token_updated:
 *                           type: boolean
 *                         order_id:
 *                           type: integer
 *                           description: Order ID generated from create_v2_test API
 *                           example: 739568
 *                     quiz_attempt:
 *                       type: array
 *                       description: Array of quiz questions with user answers
 *                     quiz_results:
 *                       type: object
 *                       properties:
 *                         score:
 *                           type: integer
 *                           description: Quiz score out of 100
 *                           example: 80
 *                         correct_answers:
 *                           type: integer
 *                           description: Number of correct answers
 *                           example: 8
 *                         total_questions:
 *                           type: integer
 *                           description: Total number of questions
 *                           example: 10
 *                         completion_time_seconds:
 *                           type: integer
 *                           description: Time taken to complete quiz in seconds
 *                           example: 300
 *                     score:
 *                       type: integer
 *                       description: Quiz score out of 100 (direct access)
 *                       example: 80
 *       400:
 *         description: Validation error or bad request
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: string
 *                   example: "failed"
 *                 message:
 *                   type: string
 *                   example: "Phone and subject are required"
 *       404:
 *         description: Session not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: string
 *                   example: "failed"
 *                 message:
 *                   type: string
 *                   example: "No active session found for this phone and subject"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: string
 *                   example: "failed"
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 */
router.post('/auto_submit_quiz', async (req, res) => {
  try {
    const { phone, subject } = req.body;
    
    if (!phone || !subject) {
      return res.status(400).json({
        result: "failed",
        message: "Phone and subject are required"
      });
    }
    
    console.log('🤖 Auto-submitting quiz for phone:', phone, 'subject:', subject);
    
    // Get session and user data from database using phone and subject
    const sessionQuery = `
      SELECT s.*, u.name, u.email, u.phone, u.subject
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE u.phone = $1 AND u.subject = $2
      ORDER BY s.created_at DESC
      LIMIT 1
    `;
    
    const sessionResult = await query(sessionQuery, [phone, subject]);
    
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({
        result: "failed",
        message: "No active session found for this phone and subject"
      });
    }
    
    const sessionData = sessionResult.rows[0];
    console.log('📊 Found session data:', {
      session_id: sessionData.id,
      user_name: sessionData.name,
      user_phone: sessionData.phone,
      user_subject: sessionData.subject,
      certified_user_id: sessionData.certified_user_id
    });
    
    // Prepare user data for quiz response service
    const userData = {
      name: sessionData.name,
      email: sessionData.email,
      phone: sessionData.phone.startsWith('+') ? sessionData.phone : `+${sessionData.phone}`,
      certified_user_skill_id: sessionData.certified_user_id
    };
    
    console.log('📤 Auto-submitting with user data:', userData);
    
    // Track quiz auto submitted
    mixpanelService.trackQuizAutoSubmitted({
      email: sessionData.email,
      phone: sessionData.phone,
      name: sessionData.name,
      subject: sessionData.subject,
      session_id: sessionData.id,
      certified_user_skill_id: sessionData.certified_user_id,
      endpoint: 'auto_submit_quiz'
    });
    
    // Use shared function for quiz response submission (encapsulates /api/submit_quiz_response logic)
    const result = await handleQuizResponseSubmission(userData);
    
    // Return the exact same response as /api/submit_quiz_response
    res.status(200).json(result);
    
  } catch (error) {
    console.error('Error in auto_submit_quiz endpoint:', error);
    
    // Track submission failure
    mixpanelService.trackQuizSubmissionFailed({
      phone: req.body?.phone,
      subject: req.body?.subject,
      error_message: error.message,
      endpoint: 'auto_submit_quiz'
    });
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        result: "failed",
        message: error.message
      });
    }
    
    res.status(500).json({
      result: "failed",
      message: 'Internal server error',
      error: error.message,
      ...(process.env.NODE_ENV === 'development' && { details: error.stack })
    });
  }
});

/**
 * @swagger
 * /api/auto_submit_quiz_v2:
 *   post:
 *     summary: Automatically submit quiz response using phone and subject (v2 with email update option)
 *     description: Same as /api/auto_submit_quiz but with optional email and type parameters. If type is 1, updates user email before submission. If type is 2, proceeds with normal flow.
 *     tags: [Quiz]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - subject
 *             properties:
 *               phone:
 *                 type: string
 *                 description: User's phone number to find the session
 *                 example: "918007880283"
 *               subject:
 *                 type: string
 *                 description: Subject/course name to find the session
 *                 example: "Java"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email address to update (required if type is "1")
 *                 example: "newemail@example.com"
 *               type:
 *                 type: string
 *                 enum: ["1", "2"]
 *                 description: Type "1" = update user email before submission, Type "2" = normal flow (no email update)
 *                 example: "1"
 *           examples:
 *             with_email_update:
 *               summary: Update email before submission (type "1")
 *               value:
 *                 phone: "918007880283"
 *                 subject: "Java"
 *                 email: "newemail@example.com"
 *                 type: "1"
 *             normal_flow:
 *               summary: Normal flow without email update (type "2")
 *               value:
 *                 phone: "918007880283"
 *                 subject: "Java"
 *                 type: "2"
 *     responses:
 *       200:
 *         description: Quiz auto-submitted successfully - Returns same response as /api/submit_quiz_response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: string
 *                   enum: ["true_high_100", "true_high_90", "true_high_80", "true_high_70", "true_pass", "true_low"]
 *                   example: "true_high_80"
 *                   description: "true_high_100 (score 100), true_high_90 (score 90), true_high_80 (score 80), true_high_70 (score 70), true_pass (score 50-60), true_low (score 0-40)"
 *                 message:
 *                   type: string
 *                   example: "Quiz response submitted successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         name:
 *                           type: string
 *                         email:
 *                           type: string
 *                         phone:
 *                           type: string
 *                     session:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         certified_skill_id:
 *                           type: integer
 *                         token_updated:
 *                           type: boolean
 *                         order_id:
 *                           type: integer
 *                     quiz_attempt:
 *                       type: array
 *                     quiz_results:
 *                       type: object
 *                     score:
 *                       type: integer
 *       400:
 *         description: Validation error or bad request
 *       404:
 *         description: Session not found
 *       500:
 *         description: Internal server error
 */
router.post('/auto_submit_quiz_v2', async (req, res) => {
  try {
    const { phone, subject, email, type } = req.body;
    
    if (!phone || !subject) {
      return res.status(400).json({
        result: "failed",
        message: "Phone and subject are required"
      });
    }
    
    // Validate type if provided (accept string "1" or "2")
    if (type !== undefined && type !== "1" && type !== "2" && type !== 1 && type !== 2) {
      return res.status(400).json({
        result: "failed",
        message: "Type must be \"1\" or \"2\""
      });
    }
    
    // Normalize type to string for consistent comparison
    const typeStr = String(type);
    
    // If type is "1", email is required
    if (typeStr === "1" && (!email || email.trim() === '')) {
      return res.status(400).json({
        result: "failed",
        message: "Email is required when type is \"1\""
      });
    }
    
    // If type is "1", validate email format
    if (typeStr === "1" && email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          result: "failed",
          message: "Please provide a valid email address"
        });
      }
    }
    
    console.log('🤖 Auto-submitting quiz v2 for phone:', phone, 'subject:', subject, 'type:', type);
    
    // Get session and user data from database using phone and subject
    const sessionQuery = `
      SELECT s.*, u.id as user_id, u.name, u.email, u.phone, u.subject
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE u.phone = $1 AND u.subject = $2
      ORDER BY s.created_at DESC
      LIMIT 1
    `;
    
    const sessionResult = await query(sessionQuery, [phone, subject]);
    
    if (sessionResult.rows.length === 0) {
      // Debug: Check if user exists but has no session
      const userCheckQuery = `
        SELECT id, name, email, phone, subject, created_at
        FROM users
        WHERE phone = $1 AND subject = $2
        ORDER BY created_at DESC
        LIMIT 1
      `;
      const userCheckResult = await query(userCheckQuery, [phone, subject]);
      
      if (userCheckResult.rows.length === 0) {
        console.log('❌ No user found for phone:', phone, 'subject:', subject);
        return res.status(404).json({
          result: "failed",
          message: "No user found for this phone and subject. Please start a quiz session first."
        });
      } else {
        console.log('⚠️ User found but no session exists for phone:', phone, 'subject:', subject);
        return res.status(404).json({
          result: "failed",
          message: "No active session found for this phone and subject. Please start a quiz session first."
        });
      }
    }
    
    const sessionData = sessionResult.rows[0];
    console.log('📊 Found session data:', {
      session_id: sessionData.id,
      user_id: sessionData.user_id,
      user_name: sessionData.name,
      user_email: sessionData.email,
      user_phone: sessionData.phone,
      user_subject: sessionData.subject,
      certified_user_id: sessionData.certified_user_id
    });
    
    // If type is "1", update user email
    if (typeStr === "1" && email) {
      console.log('📧 Updating user email from', sessionData.email, 'to', email);
      
      const updateEmailQuery = `
        UPDATE users 
        SET email = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id, name, email, phone, subject, created_at
      `;
      
      const updateResult = await query(updateEmailQuery, [email, sessionData.user_id]);
      
      if (updateResult.rows.length === 0) {
        return res.status(404).json({
          result: "failed",
          message: "User not found for email update"
        });
      }
      
      // Update sessionData with new email
      sessionData.email = email;
      console.log('✅ User email updated successfully');
    }
    
    // Prepare user data for quiz response service
    const userData = {
      name: sessionData.name,
      email: sessionData.email,
      phone: sessionData.phone.startsWith('+') ? sessionData.phone : `+${sessionData.phone}`,
      certified_user_skill_id: sessionData.certified_user_id
    };
    
    console.log('📤 Auto-submitting with user data:', userData);
    
    // Track quiz auto submitted
    mixpanelService.trackQuizAutoSubmitted({
      email: sessionData.email,
      phone: sessionData.phone,
      name: sessionData.name,
      subject: sessionData.subject,
      session_id: sessionData.id,
      user_id: sessionData.user_id,
      certified_user_skill_id: sessionData.certified_user_id,
      endpoint: 'auto_submit_quiz_v2',
      type: typeStr,
      email_updated: typeStr === "1"
    });
    
    // Use shared function for quiz response submission (encapsulates /api/submit_quiz_response logic)
    const result = await handleQuizResponseSubmission(userData);
    
    // Return the exact same response as /api/submit_quiz_response
    res.status(200).json(result);
    
  } catch (error) {
    console.error('Error in auto_submit_quiz_v2 endpoint:', error);
    
    // Track submission failure
    mixpanelService.trackQuizSubmissionFailed({
      phone: req.body?.phone,
      subject: req.body?.subject,
      email: req.body?.email,
      type: req.body?.type,
      error_message: error.message,
      endpoint: 'auto_submit_quiz_v2'
    });
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        result: "failed",
        message: error.message
      });
    }
    
    res.status(500).json({
      result: "failed",
      message: 'Internal server error',
      error: error.message,
      ...(process.env.NODE_ENV === 'development' && { details: error.stack })
    });
  }
});

/**
 * @swagger
 * /api/auto_submit_quiz_v3:
 *   post:
 *     summary: Automatically submit quiz response using phone and subject (v3 with existing token)
 *     description: Same as /api/auto_submit_quiz_v2 but uses existing certified_token from sessions table instead of calling Continue API. Create V2 Test API is not called.
 *     tags: [Quiz]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - subject
 *             properties:
 *               phone:
 *                 type: string
 *                 description: User's phone number to find the session
 *                 example: "918007880283"
 *               subject:
 *                 type: string
 *                 description: Subject/course name to find the session
 *                 example: "Java"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email address to update (required if type is "1")
 *                 example: "newemail@example.com"
 *               type:
 *                 type: string
 *                 enum: ["1", "2"]
 *                 description: Type "1" = update user email before submission, Type "2" = normal flow (no email update)
 *                 example: "1"
 *           examples:
 *             with_email_update:
 *               summary: Update email before submission (type "1")
 *               value:
 *                 phone: "918007880283"
 *                 subject: "Java"
 *                 email: "newemail@example.com"
 *                 type: "1"
 *             normal_flow:
 *               summary: Normal flow without email update (type "2")
 *               value:
 *                 phone: "918007880283"
 *                 subject: "Java"
 *                 type: "2"
 *     responses:
 *       200:
 *         description: "Quiz auto-submitted successfully - Returns response with certified_token and order_id null"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: string
 *                   enum: ["true_high_100", "true_high_90", "true_high_80", "true_high_70", "true_pass", "true_low"]
 *                   example: "true_high_80"
 *                   description: "true_high_100 (score 100), true_high_90 (score 90), true_high_80 (score 80), true_high_70 (score 70), true_pass (score 50-60), true_low (score 0-40)"
 *                 message:
 *                   type: string
 *                   example: "Quiz response submitted successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         name:
 *                           type: string
 *                         email:
 *                           type: string
 *                         phone:
 *                           type: string
 *                     session:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         certified_skill_id:
 *                           type: integer
 *                         certified_token:
 *                           type: string
 *                           description: Token from sessions table (originally from Continue API)
 *                           example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                         order_id:
 *                           type: null
 *                           description: Always null (Create V2 Test API not called)
 *                     quiz_attempt:
 *                       type: array
 *                       description: Array of quiz questions with user answers
 *                     quiz_results:
 *                       type: object
 *                       properties:
 *                         score:
 *                           type: integer
 *                           description: Quiz score out of 100
 *                           example: 80
 *                         correct_answers:
 *                           type: integer
 *                           description: Number of correct answers
 *                           example: 8
 *                         total_questions:
 *                           type: integer
 *                           description: Total number of questions
 *                           example: 10
 *                         completion_time_seconds:
 *                           type: integer
 *                           description: Time taken to complete quiz in seconds
 *                           example: 300
 *                     score:
 *                       type: integer
 *                       description: Quiz score out of 100 (direct access)
 *                       example: 80
 *       400:
 *         description: Validation error, bad request, or missing certified_token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: string
 *                   example: "failed"
 *                 message:
 *                   type: string
 *                   example: "No certified token found in session"
 *       404:
 *         description: Session not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: string
 *                   example: "failed"
 *                 message:
 *                   type: string
 *                   example: "No active session found for this phone and subject"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: string
 *                   example: "failed"
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 */
router.post('/auto_submit_quiz_v3', async (req, res) => {
  try {
    const { phone, subject, email, type } = req.body;
    
    if (!phone || !subject) {
      return res.status(400).json({
        result: "failed",
        message: "Phone and subject are required"
      });
    }
    
    // Validate type if provided (accept string "1" or "2")
    if (type !== undefined && type !== "1" && type !== "2" && type !== 1 && type !== 2) {
      return res.status(400).json({
        result: "failed",
        message: "Type must be \"1\" or \"2\""
      });
    }
    
    // Normalize type to string for consistent comparison
    const typeStr = String(type);
    
    // If type is "1", email is required
    if (typeStr === "1" && (!email || email.trim() === '')) {
      return res.status(400).json({
        result: "failed",
        message: "Email is required when type is \"1\""
      });
    }
    
    // If type is "1", validate email format
    if (typeStr === "1" && email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          result: "failed",
          message: "Please provide a valid email address"
        });
      }
    }
    
    console.log('🤖 Auto-submitting quiz v3 for phone:', phone, 'subject:', subject, 'type:', type);
    
    // Get session and user data from database using phone and subject, including certified_token
    const sessionQuery = `
      SELECT s.*, u.id as user_id, u.name, u.email, u.phone, u.subject, s.certified_token
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE u.phone = $1 AND u.subject = $2
      ORDER BY s.created_at DESC
      LIMIT 1
    `;
    
    const sessionResult = await query(sessionQuery, [phone, subject]);
    
    if (sessionResult.rows.length === 0) {
      // Debug: Check if user exists but has no session
      const userCheckQuery = `
        SELECT id, name, email, phone, subject, created_at
        FROM users
        WHERE phone = $1 AND subject = $2
        ORDER BY created_at DESC
        LIMIT 1
      `;
      const userCheckResult = await query(userCheckQuery, [phone, subject]);
      
      if (userCheckResult.rows.length === 0) {
        console.log('❌ No user found for phone:', phone, 'subject:', subject);
        return res.status(404).json({
          result: "failed",
          message: "No user found for this phone and subject. Please start a quiz session first."
        });
      } else {
        console.log('⚠️ User found but no session exists for phone:', phone, 'subject:', subject);
        return res.status(404).json({
          result: "failed",
          message: "No active session found for this phone and subject. Please start a quiz session first."
        });
      }
    }
    
    const sessionData = sessionResult.rows[0];
    console.log('📊 Found session data:', {
      session_id: sessionData.id,
      user_id: sessionData.user_id,
      user_name: sessionData.name,
      user_email: sessionData.email,
      user_phone: sessionData.phone,
      user_subject: sessionData.subject,
      certified_user_id: sessionData.certified_user_id,
      has_certified_token: !!sessionData.certified_token
    });
    
    // If type is "1", update user email
    if (typeStr === "1" && email) {
      console.log('📧 Updating user email from', sessionData.email, 'to', email);
      
      const updateEmailQuery = `
        UPDATE users 
        SET email = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id, name, email, phone, subject, created_at
      `;
      
      const updateResult = await query(updateEmailQuery, [email, sessionData.user_id]);
      
      if (updateResult.rows.length === 0) {
        return res.status(404).json({
          result: "failed",
          message: "User not found for email update"
        });
      }
      
      // Update sessionData with new email
      sessionData.email = email;
      console.log('✅ User email updated successfully');
    }
    
    // Prepare user data for quiz response service
    const userData = {
      name: sessionData.name,
      email: sessionData.email,
      phone: sessionData.phone.startsWith('+') ? sessionData.phone : `+${sessionData.phone}`,
      certified_user_skill_id: sessionData.certified_user_id
    };
    
    console.log('📤 Auto-submitting with user data:', userData);
    
    // Track quiz auto submitted
    mixpanelService.trackQuizAutoSubmitted({
      email: sessionData.email,
      phone: sessionData.phone,
      name: sessionData.name,
      subject: sessionData.subject,
      session_id: sessionData.id,
      user_id: sessionData.user_id,
      certified_user_skill_id: sessionData.certified_user_id,
      endpoint: 'auto_submit_quiz_v3',
      type: typeStr,
      email_updated: typeStr === "1"
    });
    
    // Call full quiz submission flow but skip Create V2 Test API
    const result = await quizResponseService.submitQuizResponse(
      userData,
      { skipCreateV2Test: true }
    );
    
    console.log('🔍 Raw service result:', JSON.stringify(result, null, 2));
    
    // Check if result has data and if it's not empty
    if (!result.data || Object.keys(result.data).length === 0) {
      console.error('❌ Service returned empty data object');
      // Track submission failure
      mixpanelService.trackQuizSubmissionFailed({
        email: sessionData.email,
        phone: sessionData.phone,
        certified_user_skill_id: sessionData.certified_user_id,
        error_message: 'Service returned empty data',
        endpoint: 'auto_submit_quiz_v3'
      });
      throw new Error('Service returned empty data - check service logs');
    }
    
    // Get the score to determine success level
    const score = result.data.quiz_results?.score || 0;
    // Categorize score per new rules:
    // 100 => true_high_100, 90 => true_high_90, 80 => true_high_80, 70 => true_high_70
    // 50-60 => true_pass, 0-40 => true_low
    let successValue = 'true_low'; // Default fallback
    if (score === 100) {
      successValue = 'true_high_100';
    } else if (score === 90) {
      successValue = 'true_high_90';
    } else if (score === 80) {
      successValue = 'true_high_80';
    } else if (score === 70) {
      successValue = 'true_high_70';
    } else if (score >= 50 && score <= 60) {
      successValue = 'true_pass';
    } else if (score >= 0 && score <= 40) {
      successValue = 'true_low';
    }
    
    // Track quiz scored
    mixpanelService.trackQuizScored({
      user_id: result.data.user?.id,
      session_id: result.data.session?.id,
      email: result.data.user?.email || sessionData.email,
      phone: result.data.user?.phone || sessionData.phone,
      score,
      score_category: successValue,
      correct_answers: result.data.quiz_results?.correct_answers || 0,
      total_questions: result.data.quiz_results?.total_questions || 0,
      certified_user_skill_id: sessionData.certified_user_id
    });
    
    // Format response to match the exact structure (with certified_token, without token_updated)
    // Convert created_at from UTC to IST
    let createdAtIST = '';
    if (sessionData.created_at) {
      const utcDate = new Date(sessionData.created_at);
      const istDate = toIST(utcDate);
      // Format as YYYY-MM-DD HH:mm:ss IST
      const year = istDate.getUTCFullYear();
      const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
      const day = String(istDate.getUTCDate()).padStart(2, '0');
      const hours = String(istDate.getUTCHours()).padStart(2, '0');
      const minutes = String(istDate.getUTCMinutes()).padStart(2, '0');
      const seconds = String(istDate.getUTCSeconds()).padStart(2, '0');
      createdAtIST = `${year}-${month}-${day} ${hours}:${minutes}:${seconds} IST`;
    }
    
    const formattedResponse = {
      success: successValue,
      message: "Quiz response submitted successfully",
      data: {
        user: {
          id: result.data.user.id,
          name: result.data.user.name,
          email: result.data.user.email,
          phone: result.data.user.phone
        },
        session: {
          id: result.data.session.id,
          certified_skill_id: result.data.session.certified_user_id,
          certified_token: result.data.session.certified_token,
          order_id: result.data.session.order_id,
          created_at: createdAtIST
        },
        quiz_attempt: result.data.quiz_attempt || {},
        quiz_results: result.data.quiz_results || {},
        score: score
      }
    };
    
    console.log('📤 Formatted response:', JSON.stringify(formattedResponse, null, 2));
    
    // Return the formatted response
    res.status(200).json(formattedResponse);
    
  } catch (error) {
    console.error('Error in auto_submit_quiz_v3 endpoint:', error);
    
    // Track submission failure
    mixpanelService.trackQuizSubmissionFailed({
      phone: req.body?.phone,
      subject: req.body?.subject,
      email: req.body?.email,
      type: req.body?.type,
      error_message: error.message,
      endpoint: 'auto_submit_quiz_v3'
    });
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        result: "failed",
        message: error.message
      });
    }
    
    res.status(500).json({
      result: "failed",
      message: 'Internal server error',
      error: error.message,
      ...(process.env.NODE_ENV === 'development' && { details: error.stack })
    });
  }
});

/**
 * @swagger
 * /api/export_hr_management_data:
 *   get:
 *     summary: Export HR Management user data with questions
 *     description: Fetches all users with subject "HR Management", their sessions, and questions, then exports as CSV
 *     tags: [Quiz]
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [csv, json]
 *           default: csv
 *         description: Output format (csv or json)
 *     responses:
 *       200:
 *         description: Data exported successfully
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       500:
 *         description: Internal server error
 */
router.get('/export_hr_management_data', async (req, res) => {
  try {
    const format = req.query.format || 'csv';
    const subject = 'HR Management';

    console.log(`📊 Exporting ${subject} data in ${format} format...`);

    // Query to fetch all users with HR Management subject, their sessions, and questions
    const exportQuery = `
      SELECT 
        u.phone,
        u.email,
        u.name,
        u.created_at as user_created_at,
        s.certified_user_id as certified_skill_id,
        s.id as session_id,
        COALESCE(
          json_agg(
            json_build_object(
              'question_no', q.question_no,
              'answered', q.answered
            ) ORDER BY q.question_no ASC
          ) FILTER (WHERE q.id IS NOT NULL),
          '[]'::json
        ) as questions
      FROM users u
      INNER JOIN sessions s ON u.id = s.user_id AND s.subject = $1
      LEFT JOIN questions q ON s.id = q.session_id
      WHERE u.subject = $1
      GROUP BY u.id, u.phone, u.email, u.name, u.created_at, s.certified_user_id, s.id
      ORDER BY u.created_at DESC
    `;

    const result = await query(exportQuery, [subject]);
    const rows = result.rows;

    console.log(`✅ Found ${rows.length} users with ${subject} sessions`);

    if (format === 'json') {
      // Return JSON format
      return res.status(200).json({
        success: true,
        message: `Exported ${rows.length} records`,
        data: rows.map(row => ({
          phone: row.phone,
          email: row.email,
          name: row.name,
          certified_skill_id: row.certified_skill_id,
          session_id: row.session_id,
          user_created_at_ist: formatISTTimestamp(row.user_created_at),
          questions: row.questions || []
        }))
      });
    } else {
      // Return CSV format
      const csvRows = [];
      
      // CSV Header
      csvRows.push('phone,email,name,certified_skill_id,session_id,user_created_at_ist,questions');
      
      // CSV Data Rows
      for (const row of rows) {
        const phone = (row.phone || '').replace(/"/g, '""');
        const email = (row.email || '').replace(/"/g, '""');
        const name = (row.name || '').replace(/"/g, '""');
        const certifiedSkillId = row.certified_skill_id || '';
        const sessionId = (row.session_id || '').replace(/"/g, '""');
        const userCreatedAt = formatISTTimestamp(row.user_created_at).replace(/"/g, '""');
        const questionsJson = JSON.stringify(row.questions || []);
        const questionsEscaped = questionsJson.replace(/"/g, '""');
        
        csvRows.push(`"${phone}","${email}","${name}","${certifiedSkillId}","${sessionId}","${userCreatedAt}","${questionsEscaped}"`);
      }
      
      const csvContent = csvRows.join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="hr_management_export_${new Date().toISOString().split('T')[0]}.csv"`);
      return res.status(200).send(csvContent);
    }
  } catch (error) {
    console.error('❌ Error exporting HR Management data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export HR Management data',
      error: error.message,
      ...(process.env.NODE_ENV === 'development' && { details: error.stack })
    });
  }
});

/**
 * @swagger
 * /api/export_all_subject_data:
 *   get:
 *     summary: Export all user data with sessions and questions
 *     description: Fetches all users, their sessions, and associated questions, then exports as CSV or JSON
 *     tags: [Quiz]
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [csv, json]
 *           default: csv
 *         description: Output format (csv or json)
 *     responses:
 *       200:
 *         description: Data exported successfully
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       500:
 *         description: Internal server error
 */
router.get('/export_all_subject_data', async (req, res) => {
  try {
    const format = req.query.format || 'csv';

    console.log(`📊 Exporting all subject data in ${format} format...`);

    const exportQuery = `
      SELECT 
        u.phone,
        u.email,
        u.name,
        u.subject,
        u.created_at as user_created_at,
        s.certified_user_id as certified_skill_id,
        s.id as session_id,
        COALESCE(
          json_agg(
            json_build_object(
              'question_no', q.question_no,
              'answered', q.answered
            ) ORDER BY q.question_no ASC
          ) FILTER (WHERE q.id IS NOT NULL),
          '[]'::json
        ) as questions
      FROM users u
      INNER JOIN sessions s ON u.id = s.user_id
      LEFT JOIN questions q ON s.id = q.session_id
      GROUP BY u.id, u.phone, u.email, u.name, u.subject, u.created_at, s.certified_user_id, s.id
      ORDER BY u.created_at DESC
    `;

    const result = await query(exportQuery);
    const rows = result.rows;

    console.log(`✅ Found ${rows.length} users with sessions to export`);

    if (format === 'json') {
      return res.status(200).json({
        success: true,
        message: `Exported ${rows.length} records`,
        data: rows.map(row => ({
          phone: row.phone,
          email: row.email,
          name: row.name,
          subject: row.subject,
          certified_skill_id: row.certified_skill_id,
          session_id: row.session_id,
          user_created_at_ist: formatISTTimestamp(row.user_created_at),
          questions: row.questions || []
        }))
      });
    } else {
      const csvRows = [];
      csvRows.push('phone,email,name,subject,certified_skill_id,session_id,user_created_at_ist,questions');

      for (const row of rows) {
        const phone = (row.phone || '').replace(/"/g, '""');
        const email = (row.email || '').replace(/"/g, '""');
        const name = (row.name || '').replace(/"/g, '""');
        const subject = (row.subject || '').replace(/"/g, '""');
        const certifiedSkillId = row.certified_skill_id || '';
        const sessionId = (row.session_id || '').replace(/"/g, '""');
        const userCreatedAt = formatISTTimestamp(row.user_created_at).replace(/"/g, '""');
        const questionsJson = JSON.stringify(row.questions || []);
        const questionsEscaped = questionsJson.replace(/"/g, '""');

        csvRows.push(`"${phone}","${email}","${name}","${subject}","${certifiedSkillId}","${sessionId}","${userCreatedAt}","${questionsEscaped}"`);
      }

      const csvContent = csvRows.join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="all_subjects_export_${new Date().toISOString().split('T')[0]}.csv"`);
      return res.status(200).send(csvContent);
    }
  } catch (error) {
    console.error('❌ Error exporting all subject data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export all subject data',
      error: error.message,
      ...(process.env.NODE_ENV === 'development' && { details: error.stack })
    });
  }
});

/**
 * @swagger
 * /api/user-metrics:
 *   get:
 *     summary: Fetch aggregate user quiz metrics in a time window (IST)
 *     description: Returns counts for users created, started quiz, first question answered, five questions answered, quiz completion (10 questions or quiz flag), analysis generation, attempted count, and paid count within the specified IST epoch range.
 *     tags: [Analytics]
 *     parameters:
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: integer
 *           example: 1763404200000
 *         required: true
 *         description: Start of the reporting window in milliseconds since epoch (UTC).
 *       - in: query
 *         name: stop_date
 *         schema:
 *           type: integer
 *           example: 1763407800000
 *         required: true
 *         description: End of the reporting window in milliseconds since epoch (UTC).
 *     responses:
 *       200:
 *         description: Metrics calculated successfully
 *       400:
 *         description: Missing or invalid parameters
 *       500:
 *         description: Internal server error
 */
router.get('/user-metrics', async (req, res) => {
  try {
    const { start_date: startDateParam, stop_date: stopDateParam } = req.query;

    if (!startDateParam || !stopDateParam) {
      return res.status(400).json({
        success: false,
        message: 'start_date and stop_date query parameters are required'
      });
    }

    const startEpochUTC = Number(startDateParam);
    const endEpochUTC = Number(stopDateParam);

    if (!Number.isFinite(startEpochUTC) || !Number.isFinite(endEpochUTC)) {
      return res.status(400).json({
        success: false,
        message: 'start_date and stop_date must be valid epoch milliseconds'
      });
    }

    if (startEpochUTC >= endEpochUTC) {
      return res.status(400).json({
        success: false,
        message: 'start_date must be earlier than stop_date'
      });
    }

    const startDateUTC = new Date(startEpochUTC);
    const endDateUTC = new Date(endEpochUTC);

    if (isNaN(startDateUTC) || isNaN(endDateUTC)) {
      return res.status(400).json({
        success: false,
        message: 'Unable to parse provided epoch values'
      });
    }

    console.log('[Metrics] Filtering range (UTC):', {
      startUTC: startDateUTC.toISOString(),
      endUTC: endDateUTC.toISOString()
    });

    const metricsQuery = `
      WITH filtered_users AS (
        SELECT id
        FROM users
        WHERE created_at BETWEEN $1 AND $2
      ),
      filtered_sessions AS (
        SELECT id, user_id, attempted, paid, started_quiz
        FROM sessions
        WHERE created_at BETWEEN $1 AND $2
      ),
      user_stats AS (
        SELECT 
          fu.id AS user_id,
          BOOL_OR(q.question_no = 1 AND q.answered IS TRUE) AS answered_first_question,
          COUNT(*) FILTER (WHERE q.answered IS TRUE) AS answered_count,
          BOOL_OR(s.quiz_completed IS TRUE) AS quiz_completed,
          BOOL_OR(s.quiz_analysis_generated IS TRUE) AS analysis_generated
        FROM filtered_users fu
        LEFT JOIN sessions s ON s.user_id = fu.id
        LEFT JOIN questions q ON q.session_id = s.id
        GROUP BY fu.id
      )
      SELECT
        (SELECT COUNT(*) FROM filtered_users) AS users_created,
        (SELECT COUNT(*) FROM filtered_sessions WHERE started_quiz = TRUE) AS started_quiz,
        (SELECT COUNT(*) FROM user_stats WHERE answered_first_question) AS answered_first_question,
        (SELECT COUNT(*) FROM user_stats WHERE answered_count >= 5) AS answered_five_questions,
        (SELECT COUNT(*) FROM user_stats WHERE answered_count >= 10 OR quiz_completed) AS completed_quiz,
        (SELECT COUNT(*) FROM user_stats WHERE analysis_generated) AS analysis_generated,
        (SELECT COUNT(*) FROM filtered_sessions WHERE attempted = TRUE) AS attempted_count,
        (SELECT COUNT(*) FROM filtered_sessions WHERE paid = TRUE) AS paid_count
    `;

    const metricsResult = await query(metricsQuery, [
      startDateUTC.toISOString(),
      endDateUTC.toISOString()
    ]);

    const metricsRow = metricsResult.rows[0] || {};
    const toNumber = (value) => (typeof value === 'number' ? value : Number(value) || 0);

    console.log('📊 User metrics raw result:', metricsRow);

    res.status(200).json({
      success: true,
      metrics: {
        users_created: toNumber(metricsRow.users_created),
        started_quiz: toNumber(metricsRow.started_quiz),
        answered_first_question: toNumber(metricsRow.answered_first_question),
        answered_five_questions: toNumber(metricsRow.answered_five_questions),
        completed_quiz: toNumber(metricsRow.completed_quiz),
        analysis_done: toNumber(metricsRow.analysis_generated),
        attempted_count: toNumber(metricsRow.attempted_count),
        paid_count: toNumber(metricsRow.paid_count)
      }
    });
  } catch (error) {
    console.error('❌ Error generating user metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate user metrics',
      error: error.message,
      ...(process.env.NODE_ENV === 'development' && { details: error.stack })
    });
  }
});

/**
 * @swagger
 * /api/export-all-sessions:
 *   get:
 *     summary: Export all sessions with user details
 *     description: Fetches all sessions from the sessions table along with user details (name, phone, email) from the users table and exports as CSV
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Sessions exported successfully as CSV
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *             example: |
 *               session_id,user_id,user_name,user_email,user_phone,subject,certified_user_id,certified_token,token_expires_at,quiz_completed,quiz_analysis_generated,order_id,created_at
 *               "uuid-1","user-uuid-1","John Doe","john@example.com","+1234567890","Java",1771031,"token123","2024-01-01T01:00:00.000Z",true,true,739568,"2024-01-01T00:00:00.000Z"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/export-all-sessions', async (req, res) => {
  try {
    console.log('📊 Exporting all sessions with user details...');

    // Query to fetch all sessions with user details
    const exportQuery = `
      SELECT 
        s.id as session_id,
        s.user_id,
        u.name as user_name,
        u.email as user_email,
        u.phone as user_phone,
        s.subject,
        s.certified_user_id,
        s.certified_token,
        s.certified_token_expires_at,
        s.quiz_completed,
        s.quiz_analysis_generated,
        s.order_id,
        s.created_at
      FROM sessions s
      INNER JOIN users u ON s.user_id = u.id
      ORDER BY s.created_at DESC
    `;

    const result = await query(exportQuery);
    const rows = result.rows;

    console.log(`✅ Found ${rows.length} sessions to export`);

    // Build CSV
    const csvRows = [];
    
    // CSV Header
    csvRows.push('session_id,user_id,user_name,user_email,user_phone,subject,certified_user_id,certified_token,token_expires_at,quiz_completed,quiz_analysis_generated,order_id,created_at');
    
    // CSV Data Rows
    for (const row of rows) {
      const sessionId = (row.session_id || '').replace(/"/g, '""');
      const userId = (row.user_id || '').replace(/"/g, '""');
      const userName = (row.user_name || '').replace(/"/g, '""');
      const userEmail = (row.user_email || '').replace(/"/g, '""');
      const userPhone = (row.user_phone || '').replace(/"/g, '""');
      const subject = (row.subject || '').replace(/"/g, '""');
      const certifiedUserId = row.certified_user_id || '';
      const certifiedToken = (row.certified_token || '').replace(/"/g, '""');
      
      // Convert timestamps from UTC to IST by adding 5.5 hours and format as YYYY-MM-DD HH:mm:ss IST
      let tokenExpiresAt = '';
      if (row.certified_token_expires_at) {
        const utcDate = new Date(row.certified_token_expires_at);
        const istDate = toIST(utcDate);
        // Format as YYYY-MM-DD HH:mm:ss IST (time already adjusted to IST)
        const year = istDate.getUTCFullYear();
        const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
        const day = String(istDate.getUTCDate()).padStart(2, '0');
        const hours = String(istDate.getUTCHours()).padStart(2, '0');
        const minutes = String(istDate.getUTCMinutes()).padStart(2, '0');
        const seconds = String(istDate.getUTCSeconds()).padStart(2, '0');
        tokenExpiresAt = `${year}-${month}-${day} ${hours}:${minutes}:${seconds} IST`;
      }
      
      // Convert created_at from UTC to IST by adding 5.5 hours and format as YYYY-MM-DD HH:mm:ss IST
      let createdAt = '';
      if (row.created_at) {
        try {
          const utcDate = new Date(row.created_at);
          if (!isNaN(utcDate.getTime())) {
            const istDate = toIST(utcDate);
            // Format as YYYY-MM-DD HH:mm:ss IST (time already adjusted to IST)
            const year = istDate.getUTCFullYear();
            const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
            const day = String(istDate.getUTCDate()).padStart(2, '0');
            const hours = String(istDate.getUTCHours()).padStart(2, '0');
            const minutes = String(istDate.getUTCMinutes()).padStart(2, '0');
            const seconds = String(istDate.getUTCSeconds()).padStart(2, '0');
            createdAt = `${year}-${month}-${day} ${hours}:${minutes}:${seconds} IST`;
          } else {
            console.warn('Invalid created_at date:', row.created_at);
            createdAt = row.created_at ? String(row.created_at) : '';
          }
        } catch (error) {
          console.error('Error converting created_at to IST:', error, 'Value:', row.created_at);
          createdAt = row.created_at ? String(row.created_at) : '';
        }
      }
      
      const quizCompleted = row.quiz_completed ? 'true' : 'false';
      const quizAnalysisGenerated = row.quiz_analysis_generated ? 'true' : 'false';
      const orderId = row.order_id || '';
      
      csvRows.push(
        `"${sessionId}","${userId}","${userName}","${userEmail}","${userPhone}","${subject}","${certifiedUserId}","${certifiedToken}","${tokenExpiresAt}","${quizCompleted}","${quizAnalysisGenerated}","${orderId}","${createdAt}"`
      );
    }
    
    const csvContent = csvRows.join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="all_sessions_export_${new Date().toISOString().split('T')[0]}.csv"`);
    return res.status(200).send(csvContent);
    
  } catch (error) {
    console.error('❌ Error exporting all sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export sessions',
      error: error.message,
      ...(process.env.NODE_ENV === 'development' && { details: error.stack })
    });
  }
});

/**
 * @swagger
 * /api/migrate-session-timestamps-to-ist:
 *   post:
 *     summary: Migrate session timestamps from UTC to IST
 *     description: Converts all session created_at, session_created, and certified_token_expires_at timestamps from UTC to IST (Indian Standard Time, UTC+5:30). This is a one-time migration endpoint.
 *     tags: [Admin]
 *     parameters:
 *       - in: query
 *         name: dry_run
 *         schema:
 *           type: boolean
 *           default: false
 *         description: If true, preview changes without updating the database
 *     responses:
 *       200:
 *         description: Migration completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Migration completed successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     total_sessions:
 *                       type: integer
 *                       description: Total number of sessions found
 *                       example: 100
 *                     updated_sessions:
 *                       type: integer
 *                       description: Number of sessions successfully updated
 *                       example: 98
 *                     failed_sessions:
 *                       type: integer
 *                       description: Number of sessions that failed to update
 *                       example: 2
 *                     dry_run:
 *                       type: boolean
 *                       description: Whether this was a dry run (no actual updates)
 *                       example: false
 *             examples:
 *               success:
 *                 summary: Successful migration
 *                 value:
 *                   success: true
 *                   message: "Migration completed successfully"
 *                   data:
 *                     total_sessions: 100
 *                     updated_sessions: 98
 *                     failed_sessions: 2
 *                     dry_run: false
 *               dry_run:
 *                 summary: Dry run preview
 *                 value:
 *                   success: true
 *                   message: "Dry run completed - no changes made"
 *                   data:
 *                     total_sessions: 100
 *                     updated_sessions: 0
 *                     failed_sessions: 0
 *                     dry_run: true
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Migration failed"
 *                 error:
 *                   type: string
 */
// Handle OPTIONS preflight for migration endpoint
router.options('/migrate-session-timestamps-to-ist', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.status(200).end();
});

router.post('/migrate-session-timestamps-to-ist', async (req, res) => {
  // Set CORS headers explicitly
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  try {
    const dryRun = req.query.dry_run === 'true' || req.query.dry_run === true;
    
    console.log(`🔄 Starting session timestamp migration to IST (dry_run: ${dryRun})...`);
    
    // Fetch all sessions
    const fetchSessionsQuery = `
      SELECT id, created_at, session_created, certified_token_expires_at, user_id
      FROM sessions
      ORDER BY created_at ASC
    `;
    
    const sessionsResult = await query(fetchSessionsQuery);
    const sessions = sessionsResult.rows;
    
    console.log(`📊 Found ${sessions.length} sessions to process`);
    
    let updatedCount = 0;
    let failedCount = 0;
    const errors = [];
    
    // Process each session
    for (const session of sessions) {
      try {
        // Get current timestamps
        const currentCreatedAt = session.created_at;
        const currentSessionCreated = session.session_created;
        const currentTokenExpiresAt = session.certified_token_expires_at;
        
        // Convert from UTC to IST (add 5 hours 30 minutes)
        // PostgreSQL handles timezone conversion
        // We'll use AT TIME ZONE to convert UTC to IST
        const updateQuery = `
          UPDATE sessions
          SET 
            created_at = (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata'),
            session_created = (
              CASE 
                WHEN session_created IS NOT NULL 
                THEN (session_created AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')
                ELSE NULL
              END
            ),
            certified_token_expires_at = (
              CASE 
                WHEN certified_token_expires_at IS NOT NULL 
                THEN (certified_token_expires_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')
                ELSE NULL
              END
            )
          WHERE id = $1
          RETURNING id, created_at, session_created, certified_token_expires_at
        `;
        
        if (!dryRun) {
          const updateResult = await query(updateQuery, [session.id]);
          
          if (updateResult.rows.length > 0) {
            updatedCount++;
            console.log(`✅ Updated session ${session.id}:`);
            console.log(`   created_at: ${currentCreatedAt} → ${updateResult.rows[0].created_at}`);
            if (currentSessionCreated) {
              console.log(`   session_created: ${currentSessionCreated} → ${updateResult.rows[0].session_created}`);
            }
            if (currentTokenExpiresAt) {
              console.log(`   certified_token_expires_at: ${currentTokenExpiresAt} → ${updateResult.rows[0].certified_token_expires_at}`);
            }
          } else {
            failedCount++;
            errors.push(`Session ${session.id}: Update returned no rows`);
          }
        } else {
          // Dry run - just simulate
          updatedCount++;
          console.log(`[DRY RUN] Would update session ${session.id}:`);
          console.log(`   created_at: ${currentCreatedAt} → IST`);
          if (currentSessionCreated) {
            console.log(`   session_created: ${currentSessionCreated} → IST`);
          }
          if (currentTokenExpiresAt) {
            console.log(`   certified_token_expires_at: ${currentTokenExpiresAt} → IST`);
          }
        }
      } catch (error) {
        failedCount++;
        const errorMsg = `Session ${session.id}: ${error.message}`;
        errors.push(errorMsg);
        console.error(`❌ Error updating session ${session.id}:`, error.message);
      }
    }
    
    const response = {
      success: true,
      message: dryRun 
        ? `Dry run completed - ${updatedCount} sessions would be updated` 
        : `Migration completed successfully`,
      data: {
        total_sessions: sessions.length,
        updated_sessions: updatedCount,
        failed_sessions: failedCount,
        dry_run: dryRun
      }
    };
    
    if (errors.length > 0 && process.env.NODE_ENV === 'development') {
      response.data.errors = errors.slice(0, 10); // Limit errors in response
    }
    
    console.log(`✅ Migration complete: ${updatedCount} updated, ${failedCount} failed`);
    
    res.status(200).json(response);
    
  } catch (error) {
    console.error('❌ Error in migration endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Migration failed',
      error: error.message,
      ...(process.env.NODE_ENV === 'development' && { details: error.stack })
    });
  }
});

/**
 * @swagger
 * /api/session/flag:
 *   post:
 *     summary: Mark a session as attempted or paid
 *     description: Sets the requested boolean flag on the sessions table to true for the provided session_id.
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - session_id
 *               - column
 *             properties:
 *               session_id:
 *                 type: string
 *                 format: uuid
 *                 description: Session ID to update.
 *                 example: "3f2b9f62-5f29-4b55-9a6e-1fcb7d067b1f"
 *               column:
 *                 type: string
 *                 enum: [attempted, paid]
 *                 description: Which flag should be marked true.
 *                 example: "attempted"
 *     responses:
 *       200:
 *         description: Session flag updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 session_id:
 *                   type: string
 *                 column:
 *                   type: string
 *                 value:
 *                   type: boolean
 *       400:
 *         description: Invalid request payload
 *       404:
 *         description: Session not found
 *       500:
 *         description: Internal server error
 */
router.post(
  '/session/flag',
  [
    body('session_id')
      .exists().withMessage('session_id is required')
      .isString().withMessage('session_id must be a string')
      .notEmpty().withMessage('session_id cannot be empty'),
    body('column')
      .exists().withMessage('column is required')
      .isString().withMessage('column must be a string')
      .custom((value) => ['attempted', 'paid'].includes(value))
      .withMessage('column must be attempted or paid')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { session_id: sessionId, column } = req.body;
    const columnName = column === 'attempted' ? 'attempted' : 'paid';

    try {
      const updateQuery = `
        UPDATE sessions
        SET ${columnName} = TRUE
        WHERE id = $1
        RETURNING id, user_id, subject, ${columnName}
      `;

      const updateResult = await query(updateQuery, [sessionId]);

      if (updateResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      const updatedSession = updateResult.rows[0];

      return res.status(200).json({
        success: true,
        message: `Session ${columnName} flag updated`,
        session_id: updatedSession.id,
        column: columnName,
        value: updatedSession[columnName]
      });
    } catch (error) {
      console.error('❌ Error updating session flag:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update session flag',
        error: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/session/start_quiz:
 *   post:
 *     summary: Mark a session as started quiz
 *     description: Sets the started_quiz column to true for the provided session_id.
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - session_id
 *             properties:
 *               session_id:
 *                 type: string
 *                 format: uuid
 *                 description: Session ID to update.
 *                 example: "3f2b9f62-5f29-4b55-9a6e-1fcb7d067b1f"
 *     responses:
 *       200:
 *         description: Session started_quiz flag updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 session_id:
 *                   type: string
 *                 started_quiz:
 *                   type: boolean
 *       400:
 *         description: Invalid request payload
 *       404:
 *         description: Session not found
 *       500:
 *         description: Internal server error
 */
router.post(
  '/session/start_quiz',
  [
    body('session_id')
      .exists().withMessage('session_id is required')
      .isString().withMessage('session_id must be a string')
      .notEmpty().withMessage('session_id cannot be empty')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { session_id: sessionId } = req.body;

    try {
      const updateQuery = `
        UPDATE sessions
        SET started_quiz = TRUE
        WHERE id = $1
        RETURNING id, user_id, subject, started_quiz
      `;

      const updateResult = await query(updateQuery, [sessionId]);

      if (updateResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      const updatedSession = updateResult.rows[0];

      return res.status(200).json({
        success: true,
        message: 'Session started_quiz flag updated',
        session_id: updatedSession.id,
        started_quiz: updatedSession.started_quiz
      });
    } catch (error) {
      console.error('❌ Error updating session started_quiz flag:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update session started_quiz flag',
        error: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/session/clicked_on:
 *   post:
 *     summary: Update clicked_on value for a session
 *     description: Updates the clicked_on enum column in the sessions table for the provided session_id. The value must be either 'unlock_cert' or 'know_more'.
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - session_id
 *               - value
 *             properties:
 *               session_id:
 *                 type: string
 *                 format: uuid
 *                 description: Session ID to update.
 *                 example: "3f2b9f62-5f29-4b55-9a6e-1fcb7d067b1f"
 *               value:
 *                 type: string
 *                 enum: [unlock_cert, know_more]
 *                 description: The clicked_on value to set. Must be either 'unlock_cert' or 'know_more'.
 *                 example: "unlock_cert"
 *     responses:
 *       200:
 *         description: Session clicked_on value updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Session clicked_on value updated"
 *                 session_id:
 *                   type: string
 *                   format: uuid
 *                 clicked_on:
 *                   type: string
 *                   enum: [unlock_cert, know_more]
 *       400:
 *         description: Invalid request payload
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Validation failed"
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *       404:
 *         description: Session not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Session not found"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Failed to update session clicked_on value"
 *                 error:
 *                   type: string
 */
router.post(
  '/session/clicked_on',
  [
    body('session_id')
      .exists().withMessage('session_id is required')
      .isString().withMessage('session_id must be a string')
      .notEmpty().withMessage('session_id cannot be empty'),
    body('value')
      .exists().withMessage('value is required')
      .isString().withMessage('value must be a string')
      .custom((value) => ['unlock_cert', 'know_more'].includes(value))
      .withMessage('value must be unlock_cert or know_more')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { session_id: sessionId, value } = req.body;

    try {
      const updateQuery = `
        UPDATE sessions
        SET clicked_on = $1::clicked_on_enum
        WHERE id = $2
        RETURNING id, user_id, subject, clicked_on
      `;

      const updateResult = await query(updateQuery, [value, sessionId]);

      if (updateResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      const updatedSession = updateResult.rows[0];

      return res.status(200).json({
        success: true,
        message: 'Session clicked_on value updated',
        session_id: updatedSession.id,
        clicked_on: updatedSession.clicked_on
      });
    } catch (error) {
      console.error('❌ Error updating session clicked_on:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update session clicked_on value',
        error: error.message
      });
    }
  }
);

module.exports = router;
