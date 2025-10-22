const { query } = require('../database');
const { v4: uuidv4 } = require('uuid');

class UserService {
  async createUser(userData) {
    const { name, email, phone, subject } = userData;
    
    try {
      // First, check if user already exists with same email AND subject combination
      const existingUserQuery = `
        SELECT id, name, email, phone, subject, created_at 
        FROM users 
        WHERE email = $1 AND subject = $2
      `;
      
      const existingUserResult = await query(existingUserQuery, [email, subject]);
      
      if (existingUserResult.rows.length > 0) {
        console.log('User already exists with email:', email, 'and subject:', subject);
        return existingUserResult.rows[0];
      }
      
      // Insert new user into users table
      const userQuery = `
        INSERT INTO users(name, email, phone, subject) 
        VALUES ($1, $2, $3, $4) 
        RETURNING id, name, email, phone, subject, created_at
      `;
      
      const userResult = await query(userQuery, [name, email, phone, subject]);
      const user = userResult.rows[0];
      
      console.log('User record created with ID:', user.id);
      return user;
    } catch (error) {
      console.error('Error creating user:', error);
      throw new Error(`Failed to create user: ${error.message}`);
    }
  }

  async createSession(userId, certifiedUserId, certifiedToken, certifiedTokenExpir) {
    try {
      const sessionQuery = `
        INSERT INTO sessions(user_id, certified_user_id, certified_token, certified_token_expires_at)
        VALUES ($1, $2, $3, $4)
        RETURNING id, user_id, certified_user_id, certified_token, certified_token_expires_at, created_at
      `;
      
      const sessionResult = await query(sessionQuery, [
        userId, 
        certifiedUserId, 
        certifiedToken, 
        certifiedTokenExpir
      ]);
      
      console.log('Session record created with user_id:', userId, 'and session_id:', sessionResult.rows[0].id);
      return sessionResult.rows[0];
    } catch (error) {
      console.error('Error creating session:', error);
      throw new Error(`Failed to create session: ${error.message}`);
    }
  }

  generateCertifiedToken() {
    // Generate a random token similar to the example
    const chars = 'abcdefghijklmnopqrstuvwxyz[]';
    let token = '';
    for (let i = 0; i < 20; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }

  getTokenExpirationTime() {
    // Get current time in Asia/Kolkata timezone + 1 hour
    const now = new Date();
    const kolkataTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
    const expirationTime = new Date(kolkataTime.getTime() + (60 * 60 * 1000)); // +1 hour
    return expirationTime;
  }
}

module.exports = new UserService();
