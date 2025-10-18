const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Certified InWhatsApp API',
      version: '1.0.0',
      description: 'Express.js server with Supabase integration for managing quiz sessions and user data',
      contact: {
        name: 'API Support',
        email: 'support@example.com'
      },
      license: {
        name: 'ISC',
        url: 'https://opensource.org/licenses/ISC'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      },
      {
        url: 'https://certifiedwhatsapp.vercel.app',
        description: 'Production server'
      }
    ],
    components: {
      schemas: {
        User: {
          type: 'object',
          required: ['name', 'email', 'phone', 'subject'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Unique identifier for the user',
              example: '1d03ddf5-9956-49c4-8ea2-f3e84bf55073'
            },
            name: {
              type: 'string',
              description: 'Full name of the user',
              example: 'John Doe'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Email address of the user',
              example: 'john@example.com'
            },
            phone: {
              type: 'string',
              description: 'Phone number of the user',
              example: '1234567890'
            },
            subject: {
              type: 'string',
              description: 'Subject or course name',
              example: 'Six Sigma'
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Timestamp when the user was created',
              example: '2024-01-01T00:00:00.000Z'
            }
          }
        },
        CertifiedSkill: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Certified skill ID from external service',
              example: 1770730
            },
            subject_name: {
              type: 'string',
              description: 'Name of the subject/skill',
              example: 'Docker Basic'
            },
            quiz_status: {
              type: 'string',
              description: 'Current status of the quiz',
              example: 'not_generated',
              enum: ['not_generated', 'generated', 'completed']
            },
            is_paid: {
              type: 'boolean',
              description: 'Whether the skill is paid or free',
              example: false
            }
          }
        },
        Session: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Unique identifier for the session',
              example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
            },
            user_id: {
              type: 'string',
              format: 'uuid',
              description: 'ID of the user who owns this session',
              example: '1d03ddf5-9956-49c4-8ea2-f3e84bf55073'
            },
            certified_user_id: {
              type: 'integer',
              description: 'Certified skill ID from external service',
              example: 1770730
            },
            certified_token: {
              type: 'string',
              description: 'Generated token for the session',
              example: 'csinsiufheei[aokdap'
            },
            certified_token_expir: {
              type: 'string',
              format: 'date-time',
              description: 'Token expiration timestamp',
              example: '2024-01-01T01:00:00.000Z'
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Timestamp when the session was created',
              example: '2024-01-01T00:00:00.000Z'
            }
          }
        },
        StartQuizRequest: {
          type: 'object',
          required: ['name', 'email', 'phone', 'subject'],
          properties: {
            name: {
              type: 'string',
              description: 'Full name of the user',
              example: 'John Doe',
              minLength: 1,
              maxLength: 255
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Valid email address of the user',
              example: 'john@example.com'
            },
            phone: {
              type: 'string',
              description: 'Phone number (10+ digits)',
              example: '1234567890',
              pattern: '^\\d{10,}$'
            },
            subject: {
              type: 'string',
              description: 'Subject or course name for the quiz',
              example: 'Six Sigma',
              minLength: 1,
              maxLength: 255
            }
          }
        },
        StartQuizResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Indicates if the request was successful',
              example: true
            },
            message: {
              type: 'string',
              description: 'Response message',
              example: 'Quiz started successfully'
            },
            data: {
              type: 'object',
              properties: {
                user: {
                  $ref: '#/components/schemas/User'
                },
                certified_skill: {
                  $ref: '#/components/schemas/CertifiedSkill'
                },
                session: {
                  $ref: '#/components/schemas/Session'
                }
              }
            }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Indicates if the request was successful',
              example: false
            },
            message: {
              type: 'string',
              description: 'Error message',
              example: 'Missing required fields'
            },
            error: {
              type: 'string',
              description: 'Detailed error message (development only)',
              example: 'Please provide name, email, phone, and subject.'
            }
          }
        },
        HealthResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Indicates if the server is running',
              example: true
            },
            message: {
              type: 'string',
              description: 'Status message',
              example: 'Server is running'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Current server timestamp',
              example: '2024-01-01T00:00:00.000Z'
            },
            environment: {
              type: 'string',
              description: 'Current environment',
              example: 'development',
              enum: ['development', 'production', 'staging']
            }
          }
        }
      },
      responses: {
        BadRequest: {
          description: 'Bad Request - Invalid input data',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse'
              },
              example: {
                success: false,
                message: 'Missing required fields. Please provide name, email, phone, and subject.',
                error: 'Please provide name, email, phone, and subject.'
              }
            }
          }
        },
        InternalServerError: {
          description: 'Internal Server Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse'
              },
              example: {
                success: false,
                message: 'Internal server error',
                error: 'Database connection failed'
              }
            }
          }
        },
        NotFound: {
          description: 'Not Found - Endpoint not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse'
              },
              example: {
                success: false,
                message: 'Endpoint not found',
                available_endpoints: {
                  'POST /api/start_quiz': 'Start a new quiz session',
                  'GET /health': 'Health check',
                  'GET /': 'API information'
                }
              }
            }
          }
        }
      }
    }
  },
  apis: ['./routes/*.js', './server.js']
};

const specs = swaggerJSDoc(options);

module.exports = specs;
