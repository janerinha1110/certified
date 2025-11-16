# Auto Submit Quiz API Flow

This document details all the external APIs called when using `/api/auto_submit_quiz` or `/api/auto_submit_quiz_v2` endpoints.

## Overview

Both `auto_submit_quiz` and `auto_submit_quiz_v2` endpoints call the shared `handleQuizResponseSubmission` function, which internally calls `quizResponseService.submitQuizResponse()`. This service makes a sequence of external API calls to complete the quiz submission process.

## API Call Sequence

The following APIs are called **in order** during the auto submit quiz flow:

### 1. **Continue API** (Get Authentication Token)
- **Endpoint:** `POST https://certified-new.learntube.ai/continue`
- **Purpose:** Authenticates the user and retrieves a certified token for subsequent API calls
- **Request Body:**
  ```json
  {
    "certified_user_skill_id": 1771031,
    "email": "user@example.com",
    "phone_number": "+1234567890",
    "name": "John Doe",
    "password": "user@example.com"
  }
  ```
- **Response:** Returns an authentication token
- **Status:** **REQUIRED** - If this fails, the entire flow stops

---

### 2. **Save User Response API**
- **Endpoint:** `POST https://certified-new.learntube.ai/save_user_response`
- **Purpose:** Saves the user's quiz answers and calculates the quiz score
- **Request Body:**
  ```json
  {
    "certified_user_skill_quiz_id": 1771031,
    "quiz_attempt_object": [
      {
        "quiz_id": 123,
        "user_answer": "Option A text",
        "is_correct": 1
      },
      // ... more questions
    ],
    "quiz_completion_time_in_seconds": 300,
    "quiz_score": 80
  }
  ```
- **Response:** Confirmation that user responses were saved
- **Status:** **OPTIONAL** - If this fails, the flow continues (error is logged but doesn't stop the process)

---

### 3. **Certificate Claim API**
- **Endpoint:** `POST https://certified-new.learntube.ai/certified_user_skill/claim_available_certificate`
- **Purpose:** Claims the certificate for the user based on their quiz score
- **Headers:**
  - `Authorization: Bearer {token}` (from Continue API)
- **Request Body:**
  ```json
  {
    "certified_user_skill_id": 1771031
  }
  ```
- **Response:** Certificate claim result
- **Status:** **OPTIONAL** - If this fails, the flow continues (error is logged but doesn't stop the process)

---

### 4. **Create V2 Test API**
- **Endpoint:** `POST https://certified-new.learntube.ai/create_v2_test`
- **Purpose:** Creates an order/test record for the certificate
- **Headers:**
  - `Authorization: Bearer {token}` (from Continue API)
- **Request Body:**
  ```json
  {
    "items": [
      {
        "product_slug": "certificate_type_3",
        "product_quantity": 1,
        "entity_type": "skill",
        "entity_id": 1771031
      }
    ],
    "utm_source": "",
    "scholarship_type": ""
  }
  ```
- **Response:** Returns order ID (stored in `sessions.order_id`)
- **Status:** **OPTIONAL** - If this fails, the flow continues (error is logged but doesn't stop the process)

---

### 5. **Quiz Analysis API**
- **Endpoint:** `GET https://certified-new.learntube.ai/analysis`
- **Purpose:** Retrieves detailed quiz analysis and results
- **Headers:**
  - `Authorization: Bearer {token}` (from Continue API)
- **Query Parameters:**
  ```
  certified_user_skill_quiz_id=1771031
  ```
- **Response:** Quiz analysis data including detailed results
- **Status:** **OPTIONAL** - If this fails, the flow continues (error is logged but doesn't stop the process)

---

## Complete Flow Diagram

```
┌─────────────────────────────────────┐
│  /api/auto_submit_quiz              │
│  or /api/auto_submit_quiz_v2        │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  handleQuizResponseSubmission()     │
│  (shared function)                  │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  quizResponseService                │
│  .submitQuizResponse()              │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  1. Continue API                    │
│  POST /continue                     │
│  → Returns auth token               │
└──────────────┬──────────────────────┘
               │ (Token required)
               ▼
┌─────────────────────────────────────┐
│  2. Save User Response API           │
│  POST /save_user_response            │
│  → Saves quiz answers                │
└──────────────┬──────────────────────┘
               │ (Continues even if fails)
               ▼
┌─────────────────────────────────────┐
│  3. Certificate Claim API            │
│  POST /certified_user_skill/         │
│      claim_available_certificate     │
│  → Claims certificate                │
└──────────────┬──────────────────────┘
               │ (Continues even if fails)
               ▼
┌─────────────────────────────────────┐
│  4. Create V2 Test API               │
│  POST /create_v2_test                │
│  → Creates order, returns order_id  │
└──────────────┬──────────────────────┘
               │ (Continues even if fails)
               ▼
┌─────────────────────────────────────┐
│  5. Quiz Analysis API                │
│  GET /analysis                       │
│  → Returns quiz analysis             │
└──────────────┬──────────────────────┘
               │ (Continues even if fails)
               ▼
┌─────────────────────────────────────┐
│  Update Database                     │
│  - Set quiz_completed = true        │
│  - Set quiz_analysis_generated       │
│  - Store order_id                   │
│  - Store quiz_attempt_object        │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Return Response                     │
│  - User data                         │
│  - Session data                      │
│  - Quiz results (score, etc.)        │
│  - API call results                 │
└─────────────────────────────────────┘
```

## Database Operations

In addition to external API calls, the following database operations occur:

1. **Query User:** Lookup user by email
2. **Query Session:** Get most recent session for user
3. **Query Questions:** Get all questions for the session to build quiz attempt object
4. **Update Session Token:** Update `certified_token` with token from Continue API
5. **Update Session:** Mark quiz as completed, store analysis status, order_id, and quiz attempt object

## Error Handling

- **Continue API Failure:** Stops the entire flow (throws error)
- **Other API Failures:** Logged but don't stop the flow - process continues
- **Database Errors:** Thrown and stop the flow

## Response Structure

The final response includes:
- User information
- Session information (including `order_id` from Create V2 Test API)
- Quiz attempt array (all questions with answers)
- Quiz results (score, correct answers, total questions, completion time)
- Results from each API call:
  - `save_user_response`
  - `certificate_claim`
  - `create_v2_test`
  - `quiz_analysis`

## Notes

- All API calls use the same base URL: `https://certified-new.learntube.ai`
- The Continue API token is used for authentication in subsequent API calls (steps 3, 4, and 5)
- The order_id from Create V2 Test API is stored in the `sessions.order_id` column
- Quiz score is calculated locally before calling Save User Response API
- All APIs have a 30-second timeout

