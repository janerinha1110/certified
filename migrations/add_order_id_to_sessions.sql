-- Add order_id column to sessions table
-- This column will store the order ID returned from the create_v2_test API

ALTER TABLE sessions 
ADD COLUMN order_id INTEGER;

-- Add comment to the column for documentation
COMMENT ON COLUMN sessions.order_id IS 'Order ID returned from create_v2_test API response';
