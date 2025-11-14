/**
 * Timezone utility functions for IST (Indian Standard Time)
 * IST is UTC+5:30 (Asia/Kolkata)
 */

/**
 * Get current timestamp in IST timezone as a Date object
 * @returns {Date} Current date/time in IST
 */
function getISTNow() {
  const now = new Date();
  // Convert to IST (UTC+5:30)
  const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
  const istTime = new Date(utcTime + istOffset);
  return istTime;
}

/**
 * Get current timestamp in IST timezone as ISO string
 * @returns {string} ISO string of current time in IST
 */
function getISTNowISO() {
  return getISTNow().toISOString();
}

/**
 * Get current timestamp in IST timezone formatted for PostgreSQL
 * Returns a string that can be used directly in SQL queries
 * @returns {string} PostgreSQL-compatible timestamp string in IST
 */
function getISTNowSQL() {
  const istDate = getISTNow();
  // Format: YYYY-MM-DD HH:mm:ss
  const year = istDate.getFullYear();
  const month = String(istDate.getMonth() + 1).padStart(2, '0');
  const day = String(istDate.getDate()).padStart(2, '0');
  const hours = String(istDate.getHours()).padStart(2, '0');
  const minutes = String(istDate.getMinutes()).padStart(2, '0');
  const seconds = String(istDate.getSeconds()).padStart(2, '0');
  const milliseconds = String(istDate.getMilliseconds()).padStart(3, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
}

/**
 * Convert a Date object to IST timezone
 * @param {Date} date - Date object to convert
 * @returns {Date} Date object in IST timezone
 */
function toIST(date) {
  if (!(date instanceof Date)) {
    date = new Date(date);
  }
  const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
  const utcTime = date.getTime() + (date.getTimezoneOffset() * 60 * 1000);
  return new Date(utcTime + istOffset);
}

/**
 * Get PostgreSQL NOW() equivalent in IST timezone
 * This function returns a SQL expression that can be used in queries
 * @returns {string} SQL expression for IST timestamp
 */
function getISTNowSQLExpression() {
  // Use PostgreSQL's timezone conversion
  return "(NOW() AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')";
}

module.exports = {
  getISTNow,
  getISTNowISO,
  getISTNowSQL,
  toIST,
  getISTNowSQLExpression
};

