# Create V2 Test API Integration

## Overview
This document describes the integration of the `create_v2_test` API into the auto submit quiz functionality.

## Changes Made

### 1. New Service Created
- **File**: `services/createV2TestService.js`
- **Purpose**: Handles API calls to `https://certified-new.learntube.ai/create_v2_test`
- **Features**:
  - Uses certified token from session for authentication
  - Sends entity_id as certified_user_skill_id from session table
  - Returns order_id from API response

### 2. Integration into Quiz Response Service
- **File**: `services/quizResponseService.js`
- **Changes**:
  - Added import for `createV2TestService`
  - Integrated API call after certificate claim and before analysis
  - Stores order_id in session table
  - Includes create_v2_test result in response

### 3. Database Schema Update
- **File**: `migrations/add_order_id_to_sessions.sql`
- **Purpose**: Adds `order_id` column to sessions table
- **Type**: INTEGER
- **Description**: Stores order ID returned from create_v2_test API

### 4. Documentation Updates
- **README.md**: Updated sessions table schema
- **swagger.js**: Added order_id field to Session schema

## API Flow
The create_v2_test API is now called in this sequence:
1. Continue API (get token)
2. Save User Response API
3. Certificate Claim API
4. **Create V2 Test API** ← NEW
5. Quiz Analysis API

## Request Format
```json
{
  "items": [
    {
      "product_slug": "certificate_type_3",
      "product_quantity": 1,
      "entity_type": "skill",
      "entity_id": 1781628
    }
  ],
  "utm_source": "",
  "scholarship_type": ""
}
```

## Response Format
```json
{
  "result": "success",
  "message": "",
  "data": {
    "id": 739568,
    "created_at": 1761152014.388964,
    "updated_at": 1761152014.3889642,
    "beta_user_id": 0,
    "razorpay_order_id": "order_RWak3bMMeB8Raa",
    "order_cost": 199,
    "payment_status": "attempted",
    "razorpay_payment_id": "",
    "paid_at": null,
    "payment_source": "",
    "order_creator": "webapp",
    "product_name": "Basic Quiz Certificate",
    "user_id": 1781628,
    "discount_type": ""
  }
}
```

## Database Migration Required

**IMPORTANT**: Before deploying, you must run the database migration:

```sql
-- Run this SQL command on your database
ALTER TABLE sessions ADD COLUMN order_id INTEGER;
COMMENT ON COLUMN sessions.order_id IS 'Order ID returned from create_v2_test API response';
```

## Testing
The API can be tested using the existing `/api/auto_submit_quiz` endpoint. The response will now include:
- `create_v2_test` object with the API result
- `session.order_id` field with the order ID from the API response

## Error Handling
- If create_v2_test API fails, the error is logged but doesn't stop the quiz submission process
- The order_id will be null if the API call fails
- All other API calls continue normally
