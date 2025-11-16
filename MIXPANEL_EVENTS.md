# Mixpanel Events Reference

This document provides a complete reference of all Mixpanel events tracked in the Certified InWhatsApp Quiz Application. Use this guide to understand the event funnel and set up dashboards in Mixpanel.

## Event Funnel Flow

```
1. Quiz Started
   ↓
2. Quiz Questions Generated (or Quiz Questions Generation Failed)
   ↓
3. Answer Saved (repeated for each question)
   ↓
4. Next Question Retrieved (repeated for each question)
   ↓
5. Quiz Submitted / Quiz Auto Submitted
   ↓
6. Quiz Scored
```

## Event Catalog

### 1. Quiz Started

**Event Name:** `Quiz Started`

**Description:** Triggered when a user initiates a quiz session through any start_quiz endpoint.

**When it fires:**
- User calls `/api/start_quiz`
- User calls `/api/start_quiz_clone`
- User calls `/api/start_quiz_clone_v2`
- User calls `/api/start_quiz_clone_v3`

**Properties:**
- `user_id` (string, UUID) - User ID (may be null if user not yet created)
- `email` (string) - User email address
- `phone` (string) - User phone number
- `name` (string) - User name
- `subject` (string) - Quiz subject/course name
- `endpoint` (string) - API endpoint name (e.g., "start_quiz", "start_quiz_clone_v3")
- `list` (string, optional) - List parameter (for start_quiz_clone_v3)
- `option` (string, optional) - Option parameter (for start_quiz_clone_v3)
- `timestamp` (string, ISO 8601) - Event timestamp

**Example:**
```json
{
  "event": "Quiz Started",
  "properties": {
    "email": "user@example.com",
    "phone": "+1234567890",
    "name": "John Doe",
    "subject": "Java",
    "endpoint": "start_quiz",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

---

### 2. Quiz Questions Generated

**Event Name:** `Quiz Questions Generated`

**Description:** Triggered when quiz questions are successfully generated and stored in the database.

**When it fires:**
- Questions are successfully generated and stored after quiz start
- Background polling successfully retrieves and stores questions

**Properties:**
- `user_id` (string, UUID) - User ID
- `session_id` (string, UUID) - Session ID
- `email` (string) - User email address
- `phone` (string) - User phone number
- `subject` (string) - Quiz subject/course name
- `total_questions` (number) - Total number of questions generated (typically 10)
- `question_types` (object) - Breakdown by difficulty:
  - `easy` (number) - Count of easy questions
  - `medium` (number) - Count of medium questions
  - `hard` (number) - Count of hard questions
- `timestamp` (string, ISO 8601) - Event timestamp

**Example:**
```json
{
  "event": "Quiz Questions Generated",
  "properties": {
    "user_id": "123e4567-e89b-12d3-a456-426614174000",
    "session_id": "123e4567-e89b-12d3-a456-426614174001",
    "email": "user@example.com",
    "phone": "+1234567890",
    "subject": "Java",
    "total_questions": 10,
    "question_types": {
      "easy": 5,
      "medium": 3,
      "hard": 2
    },
    "timestamp": "2024-01-15T10:30:05.000Z"
  }
}
```

---

### 3. Quiz Questions Generation Failed

**Event Name:** `Quiz Questions Generation Failed`

**Description:** Triggered when quiz question generation fails.

**When it fires:**
- API call to generate questions fails
- Question extraction fails
- Question storage fails

**Properties:**
- `user_id` (string, UUID) - User ID
- `session_id` (string, UUID) - Session ID
- `email` (string) - User email address
- `phone` (string) - User phone number
- `subject` (string) - Quiz subject/course name
- `error_message` (string) - Error description
- `timestamp` (string, ISO 8601) - Event timestamp

**Example:**
```json
{
  "event": "Quiz Questions Generation Failed",
  "properties": {
    "user_id": "123e4567-e89b-12d3-a456-426614174000",
    "session_id": "123e4567-e89b-12d3-a456-426614174001",
    "email": "user@example.com",
    "phone": "+1234567890",
    "subject": "Java",
    "error_message": "API request failed",
    "timestamp": "2024-01-15T10:30:05.000Z"
  }
}
```

---

### 4. Answer Saved

**Event Name:** `Answer Saved`

**Description:** Triggered each time a user saves an answer to a question.

**When it fires:**
- User calls `/api/save_answer` and answer is successfully saved

**Properties:**
- `question_id` (string, UUID) - Question ID
- `session_id` (string, UUID) - Session ID
- `question_number` (number) - Current question number (1-10)
- `answer` (string) - User's selected answer (A, B, C, or D)
- `total_questions` (number) - Total questions in quiz
- `timestamp` (string, ISO 8601) - Event timestamp

**Example:**
```json
{
  "event": "Answer Saved",
  "properties": {
    "question_id": "123e4567-e89b-12d3-a456-426614174002",
    "session_id": "123e4567-e89b-12d3-a456-426614174001",
    "question_number": 3,
    "answer": "B",
    "total_questions": 10,
    "timestamp": "2024-01-15T10:35:00.000Z"
  }
}
```

---

### 5. Next Question Retrieved

**Event Name:** `Next Question Retrieved`

**Description:** Triggered when the next question is successfully retrieved after saving an answer.

**When it fires:**
- After saving an answer, if there are more questions remaining

**Properties:**
- `question_id` (string, UUID) - Next question ID
- `session_id` (string, UUID) - Session ID
- `question_number` (number) - Next question number
- `total_questions` (number) - Total questions in quiz
- `timestamp` (string, ISO 8601) - Event timestamp

**Example:**
```json
{
  "event": "Next Question Retrieved",
  "properties": {
    "question_id": "123e4567-e89b-12d3-a456-426614174003",
    "session_id": "123e4567-e89b-12d3-a456-426614174001",
    "question_number": 4,
    "total_questions": 10,
    "timestamp": "2024-01-15T10:35:01.000Z"
  }
}
```

---

### 6. Quiz Submitted

**Event Name:** `Quiz Submitted`

**Description:** Triggered when a user manually submits their quiz response.

**When it fires:**
- User calls `/api/submit_quiz_response`

**Properties:**
- `email` (string) - User email address
- `phone` (string) - User phone number
- `name` (string) - User name
- `certified_user_skill_id` (number) - Certified user skill ID
- `submission_type` (string) - Always "manual"
- `endpoint` (string) - "submit_quiz_response"
- `timestamp` (string, ISO 8601) - Event timestamp

**Example:**
```json
{
  "event": "Quiz Submitted",
  "properties": {
    "email": "user@example.com",
    "phone": "+1234567890",
    "name": "John Doe",
    "certified_user_skill_id": 1771031,
    "submission_type": "manual",
    "endpoint": "submit_quiz_response",
    "timestamp": "2024-01-15T10:40:00.000Z"
  }
}
```

---

### 7. Quiz Auto Submitted

**Event Name:** `Quiz Auto Submitted`

**Description:** Triggered when a quiz is automatically submitted via auto_submit endpoints.

**When it fires:**
- User calls `/api/auto_submit_quiz`
- User calls `/api/auto_submit_quiz_v2`

**Properties:**
- `email` (string) - User email address
- `phone` (string) - User phone number
- `name` (string) - User name
- `subject` (string) - Quiz subject/course name
- `session_id` (string, UUID) - Session ID
- `user_id` (string, UUID, optional) - User ID (for v2)
- `certified_user_skill_id` (number) - Certified user skill ID
- `submission_type` (string) - Always "auto"
- `endpoint` (string) - "auto_submit_quiz" or "auto_submit_quiz_v2"
- `type` (string, optional) - Type parameter (for v2: "1" or "2")
- `email_updated` (boolean, optional) - Whether email was updated (for v2)
- `timestamp` (string, ISO 8601) - Event timestamp

**Example:**
```json
{
  "event": "Quiz Auto Submitted",
  "properties": {
    "email": "user@example.com",
    "phone": "+1234567890",
    "name": "John Doe",
    "subject": "Java",
    "session_id": "123e4567-e89b-12d3-a456-426614174001",
    "certified_user_skill_id": 1771031,
    "submission_type": "auto",
    "endpoint": "auto_submit_quiz",
    "timestamp": "2024-01-15T10:40:00.000Z"
  }
}
```

---

### 8. Quiz Submission Failed

**Event Name:** `Quiz Submission Failed`

**Description:** Triggered when quiz submission fails.

**When it fires:**
- Submission API call fails
- Service returns empty data
- Any error during submission process

**Properties:**
- `email` (string, optional) - User email address
- `phone` (string, optional) - User phone number
- `certified_user_skill_id` (number, optional) - Certified user skill ID
- `subject` (string, optional) - Quiz subject/course name
- `error_message` (string) - Error description
- `endpoint` (string) - API endpoint name
- `timestamp` (string, ISO 8601) - Event timestamp

**Example:**
```json
{
  "event": "Quiz Submission Failed",
  "properties": {
    "email": "user@example.com",
    "phone": "+1234567890",
    "certified_user_skill_id": 1771031,
    "error_message": "Service returned empty data",
    "endpoint": "submit_quiz_response",
    "timestamp": "2024-01-15T10:40:00.000Z"
  }
}
```

---

### 9. Quiz Scored

**Event Name:** `Quiz Scored`

**Description:** Triggered when a quiz is successfully scored after submission.

**When it fires:**
- After successful quiz submission, when score is calculated

**Properties:**
- `user_id` (string, UUID) - User ID
- `session_id` (string, UUID) - Session ID
- `email` (string) - User email address
- `phone` (string) - User phone number
- `score` (number) - Quiz score (0-100)
- `score_category` (string) - Score category:
  - `true_high_100` - Score of 100
  - `true_high_90` - Score of 90
  - `true_high_80` - Score of 80
  - `true_high_70` - Score of 70
  - `true_pass` - Score between 50-60
  - `true_low` - Score between 0-40
- `correct_answers` (number) - Number of correct answers
- `total_questions` (number) - Total number of questions
- `certified_user_skill_id` (number) - Certified user skill ID
- `timestamp` (string, ISO 8601) - Event timestamp

**Example:**
```json
{
  "event": "Quiz Scored",
  "properties": {
    "user_id": "123e4567-e89b-12d3-a456-426614174000",
    "session_id": "123e4567-e89b-12d3-a456-426614174001",
    "email": "user@example.com",
    "phone": "+1234567890",
    "score": 80,
    "score_category": "true_high_80",
    "correct_answers": 8,
    "total_questions": 10,
    "certified_user_skill_id": 1771031,
    "timestamp": "2024-01-15T10:40:05.000Z"
  }
}
```

---

### 10. Quiz Error

**Event Name:** `Quiz Error`

**Description:** Triggered when any error occurs in the quiz flow.

**When it fires:**
- Any unhandled error in quiz endpoints
- Validation errors
- Database errors
- API errors

**Properties:**
- `endpoint` (string) - API endpoint name where error occurred
- `error_message` (string) - Error description
- `subject` (string, optional) - Quiz subject/course name
- `question_id` (string, UUID, optional) - Question ID (if applicable)
- `timestamp` (string, ISO 8601) - Event timestamp

**Example:**
```json
{
  "event": "Quiz Error",
  "properties": {
    "endpoint": "save_answer",
    "error_message": "Question not found",
    "question_id": "123e4567-e89b-12d3-a456-426614174002",
    "timestamp": "2024-01-15T10:35:00.000Z"
  }
}
```

---

## Funnel Analysis

### Primary Funnel

1. **Quiz Started** → Users who initiate a quiz
2. **Quiz Questions Generated** → Users whose questions were successfully generated
3. **Answer Saved** (first time) → Users who start answering questions
4. **Answer Saved** (10 times) → Users who complete all questions
5. **Quiz Submitted / Quiz Auto Submitted** → Users who submit their quiz
6. **Quiz Scored** → Users who receive a score

### Conversion Metrics

- **Quiz Start to Question Generation Rate:** `Quiz Questions Generated` / `Quiz Started`
- **Question Generation to First Answer Rate:** First `Answer Saved` / `Quiz Questions Generated`
- **Completion Rate:** 10th `Answer Saved` / `Quiz Started`
- **Submission Rate:** `Quiz Submitted` + `Quiz Auto Submitted` / `Quiz Started`
- **Scoring Rate:** `Quiz Scored` / (`Quiz Submitted` + `Quiz Auto Submitted`)

### Score Distribution

Use the `score_category` property in `Quiz Scored` events to analyze:
- Percentage of users scoring in each category
- Average score by subject
- Score trends over time

---

## User Identification

Mixpanel uses the following priority for user identification (`distinct_id`):
1. Email (if available)
2. Phone number (if email not available)
3. User ID (if neither email nor phone available)
4. "anonymous" (if none of the above)

User properties are automatically set when events are tracked:
- `email`
- `phone`
- `user_id`
- `name`
- `subject`

---

## Setup Instructions

1. **Get Mixpanel Project Token:**
   - Log in to your Mixpanel account
   - Go to Project Settings
   - Copy your Project Token

2. **Set Environment Variable:**
   ```bash
   MIXPANEL_PROJECT_TOKEN=your_project_token_here
   ```

3. **Verify Tracking:**
   - Check Mixpanel Live View to see events in real-time
   - Events should appear within seconds of API calls

---

## Notes

- All tracking calls are non-blocking (fire and forget)
- Tracking failures will not break the application
- Events include timestamps automatically
- User properties are updated automatically when events are tracked
- In development mode, tracking errors are logged to console

