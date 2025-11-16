const mixpanel = require('mixpanel');

/**
 * Mixpanel Service
 * Handles all Mixpanel event tracking with consistent structure
 * All tracking calls are non-blocking and handle errors gracefully
 */
class MixpanelService {
  constructor() {
    this.mixpanel = null;
    this.isEnabled = false;
    this.init();
  }

  /**
   * Initialize Mixpanel client
   */
  init() {
    const projectToken = process.env.MIXPANEL_PROJECT_TOKEN;
    
    console.log('[Mixpanel] Initializing...');
    console.log('[Mixpanel] Token present:', !!projectToken);
    console.log('[Mixpanel] Token value:', projectToken ? `${projectToken.substring(0, 8)}...` : 'NOT SET');
    
    if (!projectToken) {
      console.warn('⚠️  MIXPANEL_PROJECT_TOKEN not set. Mixpanel tracking is disabled.');
      console.warn('⚠️  Please set MIXPANEL_PROJECT_TOKEN in your .env file or environment variables.');
      return;
    }

    try {
      this.mixpanel = mixpanel.init(projectToken, {
        debug: process.env.NODE_ENV === 'development',
        ignore_dnt: true
      });
      this.isEnabled = true;
      console.log('✅ Mixpanel initialized successfully with token:', `${projectToken.substring(0, 8)}...`);
    } catch (error) {
      console.error('❌ Failed to initialize Mixpanel:', error.message);
      this.isEnabled = false;
    }
  }

  /**
   * Get distinct_id for user identification
   * Priority: email > phone > user_id
   */
  getDistinctId(userData) {
    if (userData?.email) {
      return userData.email;
    }
    if (userData?.phone) {
      return userData.phone;
    }
    if (userData?.user_id) {
      return userData.user_id;
    }
    return 'anonymous';
  }

  /**
   * Track an event with properties
   * Non-blocking - fires and forgets
   */
  track(eventName, properties = {}) {
    if (!this.isEnabled || !this.mixpanel) {
      console.log(`[Mixpanel] Tracking disabled - event "${eventName}" not sent`);
      return;
    }

    try {
      // Add timestamp
      const eventProperties = {
        ...properties,
        timestamp: new Date().toISOString()
      };

      // Get distinct_id from properties if available
      const distinctId = this.getDistinctId(properties);

      // Log tracking attempt (for debugging)
      console.log(`[Mixpanel] Tracking event: "${eventName}" for user: ${distinctId}`);

      // Track event
      this.mixpanel.track(eventName, eventProperties, (err) => {
        if (err) {
          console.error(`[Mixpanel] Tracking error for event "${eventName}":`, err);
        } else {
          console.log(`[Mixpanel] ✅ Successfully tracked event: "${eventName}"`);
        }
      });

      // Set user properties if user data is available
      if (properties.email || properties.phone || properties.user_id) {
        const userProps = {};
        if (properties.email) userProps.email = properties.email;
        if (properties.phone) userProps.phone = properties.phone;
        if (properties.user_id) userProps.user_id = properties.user_id;
        if (properties.name) userProps.name = properties.name;
        if (properties.subject) userProps.subject = properties.subject;

        this.mixpanel.people.set(distinctId, userProps, (err) => {
          if (err && process.env.NODE_ENV === 'development') {
            console.error(`Mixpanel user properties error:`, err);
          }
        });
      }
    } catch (error) {
      // Silently fail - don't break the application
      if (process.env.NODE_ENV === 'development') {
        console.error(`Error tracking Mixpanel event "${eventName}":`, error.message);
      }
    }
  }

  /**
   * Track quiz started event
   */
  trackQuizStarted(properties) {
    this.track('Quiz Started', {
      ...properties,
      endpoint: properties.endpoint || 'start_quiz'
    });
  }

  /**
   * Track quiz questions generated event
   */
  trackQuizQuestionsGenerated(properties) {
    this.track('Quiz Questions Generated', {
      ...properties,
      total_questions: properties.total_questions || 0
    });
  }

  /**
   * Track quiz questions generation failed event
   */
  trackQuizQuestionsGenerationFailed(properties) {
    this.track('Quiz Questions Generation Failed', {
      ...properties,
      error_message: properties.error_message || 'Unknown error'
    });
  }

  /**
   * Track answer saved event
   */
  trackAnswerSaved(properties) {
    this.track('Answer Saved', {
      ...properties,
      question_number: properties.question_number || 0
    });
  }

  /**
   * Track next question retrieved event
   */
  trackNextQuestionRetrieved(properties) {
    this.track('Next Question Retrieved', {
      ...properties,
      question_number: properties.question_number || 0
    });
  }

  /**
   * Track quiz submitted event
   */
  trackQuizSubmitted(properties) {
    this.track('Quiz Submitted', {
      ...properties,
      submission_type: properties.submission_type || 'manual'
    });
  }

  /**
   * Track quiz auto submitted event
   */
  trackQuizAutoSubmitted(properties) {
    this.track('Quiz Auto Submitted', {
      ...properties,
      submission_type: 'auto'
    });
  }

  /**
   * Track quiz submission failed event
   */
  trackQuizSubmissionFailed(properties) {
    this.track('Quiz Submission Failed', {
      ...properties,
      error_message: properties.error_message || 'Unknown error'
    });
  }

  /**
   * Track quiz scored event
   */
  trackQuizScored(properties) {
    this.track('Quiz Scored', {
      ...properties,
      score: properties.score || 0,
      score_category: properties.score_category || 'unknown',
      correct_answers: properties.correct_answers || 0,
      total_questions: properties.total_questions || 0
    });
  }

  /**
   * Track quiz error event
   */
  trackQuizError(properties) {
    this.track('Quiz Error', {
      ...properties,
      error_message: properties.error_message || 'Unknown error',
      endpoint: properties.endpoint || 'unknown'
    });
  }
}

// Export singleton instance
module.exports = new MixpanelService();

