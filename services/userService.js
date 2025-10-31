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
      
      // Check if user exists with same email but different subject
      const userWithSameEmailQuery = `
        SELECT id, name, email, phone, subject, created_at 
        FROM users 
        WHERE email = $1
      `;
      
      const userWithSameEmailResult = await query(userWithSameEmailQuery, [email]);
      
      if (userWithSameEmailResult.rows.length > 0) {
        // User exists with same email but different subject - update the subject
        console.log('User exists with email:', email, 'but different subject. Updating subject to:', subject);
        
        const updateUserQuery = `
          UPDATE users 
          SET subject = $1, updated_at = NOW()
          WHERE email = $2
          RETURNING id, name, email, phone, subject, created_at
        `;
        
        const updateResult = await query(updateUserQuery, [subject, email]);
        const updatedUser = updateResult.rows[0];
        
        console.log('User subject updated for email:', email, 'to subject:', subject);
        return updatedUser;
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

  async createSession(userId, certifiedUserId, certifiedToken, certifiedTokenExpir, subject) {
    try {
      // Ensure subject column exists on sessions (idempotent for Postgres)
      try {
        await query('ALTER TABLE sessions ADD COLUMN IF NOT EXISTS subject TEXT');
      } catch (e) {
        // Non-fatal: continue if cannot alter (e.g. permissions). We'll still insert without subject if column missing.
      }

      const sessionQuery = `
        INSERT INTO sessions(user_id, certified_user_id, certified_token, certified_token_expires_at, subject)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, user_id, certified_user_id, certified_token, certified_token_expires_at, subject, created_at
      `;
      
      const sessionResult = await query(sessionQuery, [
        userId, 
        certifiedUserId, 
        certifiedToken, 
        certifiedTokenExpir,
        subject
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
