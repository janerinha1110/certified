// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const swaggerSpecs = require('./swagger');
const config = require('./config');
const quizRoutes = require('./routes/quiz');
const reTriggerService = require('./services/reTriggerService');

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

// Swagger Documentation - Custom HTML with CDN assets for Vercel compatibility
app.get('/api-docs', (req, res) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Certified InWhatsApp API Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.9.0/swagger-ui.css" />
  <style>
    html {
      box-sizing: border-box;
      overflow: -moz-scrollbars-vertical;
      overflow-y: scroll;
    }
    *, *:before, *:after {
      box-sizing: inherit;
    }
    body {
      margin: 0;
      background: #fafafa;
    }
    .swagger-ui .topbar { display: none; }
    #loading {
      text-align: center;
      padding: 50px;
      font-family: sans-serif;
    }
  </style>
</head>
<body>
  <div id="loading">Loading Swagger UI...</div>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.9.0/swagger-ui-bundle.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.9.0/swagger-ui-standalone-preset.js"></script>
  <script>
    console.log('Script loaded, checking SwaggerUIBundle:', typeof SwaggerUIBundle);
    console.log('Checking SwaggerUIStandalonePreset:', typeof SwaggerUIStandalonePreset);
    
    function initSwagger() {
      console.log('initSwagger called, SwaggerUIBundle defined:', typeof SwaggerUIBundle);
      
      if (typeof SwaggerUIBundle !== 'undefined' && typeof SwaggerUIStandalonePreset !== 'undefined') {
        try {
          document.getElementById('loading').style.display = 'none';
          
          const ui = SwaggerUIBundle({
            url: '${req.protocol}://${req.get('host')}/api-docs/swagger.json',
            dom_id: '#swagger-ui',
            deepLinking: true,
            presets: [
              SwaggerUIBundle.presets.apis,
              SwaggerUIStandalonePreset
            ],
            plugins: [
              SwaggerUIBundle.plugins.DownloadUrl
            ],
            layout: "StandaloneLayout"
          });
          
          console.log('Swagger UI initialized successfully');
        } catch (error) {
          console.error('Error initializing Swagger UI:', error);
          document.getElementById('loading').innerHTML = '<h2>Error loading API documentation. Please refresh the page.</h2><p>' + error.message + '</p>';
        }
      } else {
        console.log('SwaggerUIBundle not ready, retrying...');
        setTimeout(initSwagger, 100);
      }
    }
    
    // Start initialization
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initSwagger);
    } else {
      initSwagger();
    }
  </script>
</body>
</html>`;
  res.send(html);
});

// Endpoint to serve the swagger.json spec
app.get('/api-docs/swagger.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpecs);
});

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
    
    // Initialize re-trigger cron job
    // Runs every minute to check for sessions created 5 minutes ago
    console.log('⏰ Initializing re-trigger cron job (runs every minute)...');
    cron.schedule('* * * * *', async () => {
      try {
        await reTriggerService.checkAndTriggerReTriggerAPI();
      } catch (error) {
        console.error('❌ [Re-Trigger Cron] Unhandled error in cron job:', error.message);
      }
    }, {
      scheduled: true,
      timezone: 'Asia/Kolkata'
    });
    console.log('✅ Re-trigger cron job initialized successfully');
  });
} else {
  // For Vercel/serverless environments, initialize cron job differently
  // Note: Vercel serverless functions may not support long-running cron jobs
  // Consider using Vercel Cron Jobs or external cron service for production
  console.log('⚠️  Running in Vercel environment - cron jobs may need external scheduling');
}

module.exports = app;
