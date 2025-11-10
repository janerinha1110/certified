const express = require('express');
const router = express.Router();
const userService = require('../services/userService');
const certifiedApiService = require('../services/certifiedApi');
const generateQuizService = require('../services/generateQuizService');
const questionService = require('../services/questionService');
const quizResponseService = require('../services/quizResponseService');
const { query } = require('../database');
const { body, validationResult } = require('express-validator');

// Shared function for quiz response submission logic
const handleQuizResponseSubmission = async (userData) => {
  const { name, email, phone, certified_user_skill_id } = userData;
  
  console.log('📝 Processing quiz response submission...');
  console.log('📤 Request data:', { name, email, phone, certified_user_skill_id });
  
  // Submit quiz response
  const result = await quizResponseService.submitQuizResponse(
    { name, email, phone, certified_user_skill_id }
  );
  
  console.log('🔍 Raw service result:', JSON.stringify(result, null, 2));
  
  // Check if result has data and if it's not empty
  if (!result.data || Object.keys(result.data).length === 0) {
    console.error('❌ Service returned empty data object');
    throw new Error('Service returned empty data - check service logs');
  }
  
  // Get the score to determine success level
  const score = result.data.quiz_results?.score || 0;
  // Categorize score per new rules:
  // 0-40 => true_low, 50-60 => true_pass, 70-100 => true_high
  // For scores outside these bands (41-49, 61-69), default to true_low unless specified otherwise
  let successValue = 'true_low';
  if (score >= 70 && score <= 100) {
    successValue = 'true_high';
  } else if (score >= 50 && score <= 60) {
    successValue = 'true_pass';
  } else if (score >= 0 && score <= 40) {
    successValue = 'true_low';
  }
  
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
      } else {
        console.log('⚠️  Quiz generation failed:', quizData.message);
      }
    } catch (error) {
      console.log('⚠️  Quiz generation failed (API may be outdated):', error.message);
      console.log('📝 Continuing without quiz questions...');
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
    const existingQuestions = await questionService.getQuestionsBySession(session.id);
    let questionAdded = existingQuestions && existingQuestions.length > 0;
    if (questionAdded) {
      quizInfo = {
        total_questions: existingQuestions.length,
        questions_generated: true,
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
                
                // Try to extract questions even if not all arrays are populated
                try {
                  const questions = generateQuizService.extractQuestions(quizData);
                  if (questions.length > 0) {
                    console.log(`✅ [Background] Extracted ${questions.length} questions, storing in database for session ${session.id}...`);
                    await questionService.createQuestions(questions, session.id, user.id);
                    questionAddedInBackground = true;
                    
                    console.log(`✅ [Background] Successfully stored ${questions.length} questions for session ${session.id}!`);
                    break; // Exit polling loop on success
                  } else {
                    if (allArraysPopulated) {
                      console.log(`⚠️  [Background] All arrays populated but extracted 0 questions for session ${session.id} - may need different q_ids`);
                    } else {
                      console.log(`⏳ [Background] Waiting for more questions to be populated for session ${session.id}...`);
                    }
                  }
                } catch (extractError) {
                  console.error(`❌ [Background] Error extracting questions for session ${session.id}:`, extractError.message);
                  // Continue polling
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
          }
        } catch (error) {
          console.error(`❌ [Background] Fatal error in polling loop for session ${session.id}:`, error);
        }
      })(); // Immediately invoke async function - runs in background
      
      // Note: We're not awaiting the background task, so response returns immediately
      console.log('✅ Background polling started - API will return response immediately');
    }

    // Prepare quiz info and first question similar to start_quiz
    const finalQuestions = await questionService.getQuestionsBySession(session.id);
    // Ensure total reflects DB state; preserve type counts if already computed
    quizInfo.total_questions = finalQuestions.length;
    quizInfo.questions_generated = finalQuestions.length > 0;

    let firstQuestion = null;
    if (finalQuestions.length > 0) {
      firstQuestion = finalQuestions[0];
    }

    // Determine message based on question status
    let responseMessage = 'Quiz started successfully';
    if (!questionAdded && finalQuestions.length === 0) {
      responseMessage = 'Quiz started successfully. Questions are being generated in the background. Please check back in a few moments.';
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
            INSERT INTO users(name, email, phone, subject)
            VALUES ($1, '', $2, $3)
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
    const existingQuestions = await questionService.getQuestionsBySession(session.id);
    let questionAdded = existingQuestions && existingQuestions.length > 0;
    if (questionAdded) {
      quizInfo = {
        total_questions: existingQuestions.length,
        questions_generated: true,
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
                
                // Try to extract questions even if not all arrays are populated
                try {
                  const questions = generateQuizService.extractQuestions(quizData);
                  if (questions.length > 0) {
                    console.log(`✅ [Background] Extracted ${questions.length} questions, storing in database for session ${session.id}...`);
                    await questionService.createQuestions(questions, session.id, user.id);
                    questionAddedInBackground = true;
                    
                    console.log(`✅ [Background] Successfully stored ${questions.length} questions for session ${session.id}!`);
                    break; // Exit polling loop on success
                  } else {
                    if (allArraysPopulated) {
                      console.log(`⚠️  [Background] All arrays populated but extracted 0 questions for session ${session.id} - may need different q_ids`);
                    } else {
                      console.log(`⏳ [Background] Waiting for more questions to be populated for session ${session.id}...`);
                    }
                  }
                } catch (extractError) {
                  console.error(`❌ [Background] Error extracting questions for session ${session.id}:`, extractError.message);
                  // Continue polling
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
          }
        } catch (error) {
          console.error(`❌ [Background] Fatal error in polling loop for session ${session.id}:`, error);
        }
      })(); // Immediately invoke async function - runs in background
      
      // Note: We're not awaiting the background task, so response returns immediately
      console.log('✅ Background polling started - API will return response immediately');
    }

    // Prepare quiz info and first question similar to start_quiz
    const finalQuestions = await questionService.getQuestionsBySession(session.id);
    // Ensure total reflects DB state; preserve type counts if already computed
    quizInfo.total_questions = finalQuestions.length;
    quizInfo.questions_generated = finalQuestions.length > 0;

    let firstQuestion = null;
    if (finalQuestions.length > 0) {
      firstQuestion = finalQuestions[0];
    }

    // Determine message based on question status
    let responseMessage = 'Quiz started successfully';
    if (!questionAdded && finalQuestions.length === 0) {
      responseMessage = 'Quiz started successfully. Questions are being generated in the background. Please check back in a few moments.';
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
            INSERT INTO users(name, email, phone, subject)
            VALUES ($1, '', $2, $3)
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
    const existingQuestions = await questionService.getQuestionsBySession(session.id);
    let questionAdded = existingQuestions && existingQuestions.length > 0;
    if (questionAdded) {
      quizInfo = {
        total_questions: existingQuestions.length,
        questions_generated: true,
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
                
                // Try to extract questions even if not all arrays are populated
                try {
                  const questions = generateQuizService.extractQuestions(quizData);
                  if (questions.length > 0) {
                    console.log(`✅ [Background] Extracted ${questions.length} questions, storing in database for session ${session.id}...`);
                    await questionService.createQuestions(questions, session.id, user.id);
                    questionAddedInBackground = true;
                    
                    console.log(`✅ [Background] Successfully stored ${questions.length} questions for session ${session.id}!`);
                    break; // Exit polling loop on success
                  } else {
                    if (allArraysPopulated) {
                      console.log(`⚠️  [Background] All arrays populated but extracted 0 questions for session ${session.id} - may need different q_ids`);
                    } else {
                      console.log(`⏳ [Background] Waiting for more questions to be populated for session ${session.id}...`);
                    }
                  }
                } catch (extractError) {
                  console.error(`❌ [Background] Error extracting questions for session ${session.id}:`, extractError.message);
                  // Continue polling
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
          }
        } catch (error) {
          console.error(`❌ [Background] Fatal error in polling loop for session ${session.id}:`, error);
        }
      })(); // Immediately invoke async function - runs in background
      
      // Note: We're not awaiting the background task, so response returns immediately
      console.log('✅ Background polling started - API will return response immediately');
    }

    // Prepare quiz info and first question similar to start_quiz
    const finalQuestions = await questionService.getQuestionsBySession(session.id);
    // Ensure total reflects DB state; preserve type counts if already computed
    quizInfo.total_questions = finalQuestions.length;
    quizInfo.questions_generated = finalQuestions.length > 0;

    let firstQuestion = null;
    if (finalQuestions.length > 0) {
      firstQuestion = finalQuestions[0];
    }

    // Determine message based on question status
    let responseMessage = 'Quiz started successfully';
    if (!questionAdded && finalQuestions.length === 0) {
      responseMessage = 'Quiz started successfully. Questions are being generated in the background. Please check back in a few moments.';
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
      SELECT session_id FROM questions WHERE id = $1
    `;
    const questionResult = await query(questionQuery, [question_id]);
    
    if (questionResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }
    
    const session_id = questionResult.rows[0].session_id;
    console.log(`📝 Found session_id: ${session_id} for question: ${question_id}`);
    
    // Save answer and get next question
    const result = await questionService.saveAnswerAndGetNext(question_id, answer, session_id);
    
    res.status(200).json({
      success: true,
      message: 'Answer saved successfully',
      data: result
    });
    
  } catch (error) {
    console.error('Error in save_answer endpoint:', error);
    
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
    
    // Use shared function for quiz response submission
    const result = await handleQuizResponseSubmission({
      name, email, phone, certified_user_skill_id
    });
    
    res.status(200).json(result);
    
  } catch (error) {
    console.error('Error in submit_quiz_response endpoint:', error);
    
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
 *                   enum: ["true_high", "true_low"]
 *                   example: "true_high"
 *                   description: "true_high if score > 60, true_low if score <= 60"
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
    
    // Use shared function for quiz response submission (encapsulates /api/submit_quiz_response logic)
    const result = await handleQuizResponseSubmission(userData);
    
    // Return the exact same response as /api/submit_quiz_response
    res.status(200).json(result);
    
  } catch (error) {
    console.error('Error in auto_submit_quiz endpoint:', error);
    
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
 *                   enum: ["true_high", "true_pass", "true_low"]
 *                   example: "true_high"
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
    
    // Use shared function for quiz response submission (encapsulates /api/submit_quiz_response logic)
    const result = await handleQuizResponseSubmission(userData);
    
    // Return the exact same response as /api/submit_quiz_response
    res.status(200).json(result);
    
  } catch (error) {
    console.error('Error in auto_submit_quiz_v2 endpoint:', error);
    
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

module.exports = router;
