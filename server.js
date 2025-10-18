const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./swagger');
const config = require('./config');
const quizRoutes = require('./routes/quiz');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     description: Returns the current status of the server and basic information
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Server is running successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 *             example:
 *               success: true
 *               message: "Server is running"
 *               timestamp: "2024-01-01T00:00:00.000Z"
 *               environment: "development"
 */
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: config.server.env
  });
});

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Certified InWhatsApp API Documentation'
}));

// API Routes
app.use('/api', quizRoutes);

/**
 * @swagger
 * /:
 *   get:
 *     summary: API information endpoint
 *     description: Returns basic information about the API and available endpoints
 *     tags: [System]
 *     responses:
 *       200:
 *         description: API information retrieved successfully
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
 *                   example: "Certified InWhatsApp API Server"
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 *                 endpoints:
 *                   type: object
 *                   properties:
 *                     "POST /api/start_quiz":
 *                       type: string
 *                       example: "Start a new quiz session"
 *                     "GET /health":
 *                       type: string
 *                       example: "Health check"
 *                     "GET /api-docs":
 *                       type: string
 *                       example: "Swagger API Documentation"
 */
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Certified InWhatsApp API Server',
    version: '1.0.0',
    endpoints: {
      'POST /api/start_quiz': 'Start a new quiz session',
      'GET /health': 'Health check',
      'GET /api-docs': 'Swagger API Documentation'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    available_endpoints: {
      'POST /api/start_quiz': 'Start a new quiz session',
      'GET /health': 'Health check',
      'GET /api-docs': 'Swagger API Documentation',
      'GET /': 'API information'
    }
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// Start server
const PORT = process.env.PORT || config.server.port;

// Only start server if not in Vercel environment
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Environment: ${config.server.env}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
    console.log(`📖 API Info: http://localhost:${PORT}/`);
  });
}

module.exports = app;
