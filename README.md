# Certified InWhatsApp API

Express.js server with Supabase integration for quiz management system.

## Features

- 🚀 Express.js REST API
- 🗄️ Supabase PostgreSQL database
- 📚 Swagger API documentation
- 🎯 Quiz management system
- 🔐 External API integrations
- ✅ Input validation
- 🔄 Retry logic with exponential backoff

## API Endpoints

- `POST /api/start_quiz` - Start a new quiz session
- `POST /api/save_answer` - Save answer and get next question
- `POST /api/submit_quiz_response` - Submit complete quiz response
- `GET /health` - Health check
- `GET /api-docs` - Swagger documentation
- `GET /` - API information

## Environment Variables

Create a `.env` file with the following variables:

```env
# Environment Configuration
NODE_ENV=production

# Database Configuration (Supabase)
DB_HOST=aws-1-us-east-2.pooler.supabase.com
DB_PORT=6543
DB_USER=postgres.eyjtbudtwfzkxypnixsg
DB_PASSWORD=tG#esRKbVA6m-7p
DB_NAME=postgres
DB_SSL=true

# Server Configuration
SERVER_PORT=3000
SERVER_ENV=production

# External API Configuration
CERTIFIED_API_URL=https://certified-new.learntube.ai/new_entry_test_v2
GENERATE_API_URL=https://certified-new.learntube.ai/generate
CONTINUE_API_URL=https://certified-new.learntube.ai/continue
SAVE_USER_RESPONSE_URL=https://certified-new.learntube.ai/save_user_response
CERTIFICATE_CLAIM_URL=https://certified-new.learntube.ai/certified_user_skill/claim_available_certificate
ANALYSIS_API_URL=https://certified-new.learntube.ai/analysis
```

## Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Start production server
npm start
```

## Vercel Deployment

### Prerequisites
- Vercel account
- GitHub repository connected to Vercel

### Deployment Steps

1. **Push your code to GitHub:**
   ```bash
   git add .
   git commit -m "Prepare for Vercel deployment"
   git push origin main
   ```

2. **Deploy to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Vercel will automatically detect it's a Node.js project

3. **Set Environment Variables:**
   In your Vercel dashboard, go to Settings → Environment Variables and add:
   - `NODE_ENV` = `production`
   - `DB_HOST` = `aws-1-us-east-2.pooler.supabase.com`
   - `DB_PORT` = `6543`
   - `DB_USER` = `postgres.eyjtbudtwfzkxypnixsg`
   - `DB_PASSWORD` = `tG#esRKbVA6m-7p`
   - `DB_NAME` = `postgres`
   - `DB_SSL` = `true`
   - `SERVER_PORT` = `3000`
   - `SERVER_ENV` = `production`
   - `CERTIFIED_API_URL` = `https://certified-new.learntube.ai/new_entry_test_v2`
   - `GENERATE_API_URL` = `https://certified-new.learntube.ai/generate`
   - `CONTINUE_API_URL` = `https://certified-new.learntube.ai/continue`
   - `SAVE_USER_RESPONSE_URL` = `https://certified-new.learntube.ai/save_user_response`
   - `CERTIFICATE_CLAIM_URL` = `https://certified-new.learntube.ai/certified_user_skill/claim_available_certificate`
   - `ANALYSIS_API_URL` = `https://certified-new.learntube.ai/analysis`

4. **Deploy:**
   - Click "Deploy" in Vercel dashboard
   - Your API will be available at `https://your-project-name.vercel.app`

### Vercel Configuration

The project includes a `vercel.json` file with:
- Node.js runtime configuration
- Route handling for all endpoints
- Environment variable setup

## Database Schema

### Users Table
- `id` (UUID, Primary Key)
- `name` (String)
- `email` (String, Unique)
- `phone` (String)
- `subject` (String)
- `created_at` (Timestamp)

### Sessions Table
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key)
- `certified_user_id` (Integer)
- `certified_token` (String)
- `certified_token_expires_at` (Timestamp)
- `quiz_completed` (Boolean)
- `quiz_analysis_generated` (Boolean)
- `quiz_attempt_object` (JSONB)
- `created_at` (Timestamp)

### Questions Table
- `id` (UUID, Primary Key)
- `session_id` (UUID, Foreign Key)
- `user_id` (UUID, Foreign Key)
- `question` (String)
- `option_a` (String)
- `option_b` (String)
- `option_c` (String)
- `option_d` (String)
- `correct_answer` (String)
- `answered` (Boolean)
- `answer` (String)
- `question_no` (Integer)
- `quiz_id` (String)
- `created_at` (Timestamp)

## API Documentation

Once deployed, visit `https://your-domain.vercel.app/api-docs` for interactive Swagger documentation.

## Testing

Test your deployed API:
```bash
# Health check
curl https://your-domain.vercel.app/health

# Start quiz
curl -X POST https://your-domain.vercel.app/api/start_quiz \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "phone": "1234567890",
    "subject": "Blender Advanced"
  }'
```

## Troubleshooting

- **Database Connection Issues**: Verify Supabase credentials and SSL settings
- **External API Failures**: Check API endpoints and headers
- **Vercel Deployment Issues**: Ensure all environment variables are set correctly
- **CORS Issues**: The app includes CORS middleware for cross-origin requests

## Support

For issues or questions, please check the API documentation at `/api-docs` or contact the development team.