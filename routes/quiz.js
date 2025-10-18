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
  
  // Format response to match the exact structure you want
  const formattedResponse = {
    success: true,
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
        token_updated: result.data.session.token_updated
      },
      quiz_attempt: result.data.quiz_attempt || {}
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
      tokenExpiration
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
 *                 result:
 *                   type: string
 *                   example: "success"
 *                 message:
 *                   type: string
 *                   example: "Quiz response submitted successfully"
 *                 data:
 *                   type: object
 *                   description: "Same response structure as /api/submit_quiz_response"
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

module.exports = router;
