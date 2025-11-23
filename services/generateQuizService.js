const axios = require('axios');
const config = require('../config');

class GenerateQuizService {
  constructor() {
    this.baseURL = 'https://certified-new.learntube.ai/generate';
  }

  async generateQuiz(certifiedUserSkillId) {
    try {
      const url = this.baseURL;
      
      const headers = {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9,de;q=0.8',
        'Connection': 'keep-alive',
        'Content-Type': 'application/json',
        'Origin': 'https://certified.learntube.ai',
        'Referer': 'https://certified.learntube.ai/',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-site',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
        'sec-ch-ua': '"Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
        'sec-ch-ua-mobile': '?1',
        'sec-ch-ua-platform': '"Android"'
      };

      const data = {
        certified_user_skill_id: certifiedUserSkillId,
        is_new_ui: true
      };

      console.log('🌐 Calling generate quiz API for skill ID:', certifiedUserSkillId);

      const response = await axios.post(url, data, {
        headers,
        timeout: 15000, // 15 second timeout
        httpsAgent: new (require('https').Agent)({
          rejectUnauthorized: false // Ignore SSL certificate errors
        })
      });

      console.log('✅ Generate quiz API response received');
      return response.data;
    } catch (error) {
      console.error('❌ Generate Quiz API Error:', error.message);
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
      }
      throw new Error(`Failed to generate quiz: ${error.message}`);
    }
  }

  extractQuestions(quizData) {
    try {
      const questions = [];
      
      if (!quizData.data || !quizData.data.quiz_question_answer || !quizData.data.quiz_question_answer.questionaire) {
        throw new Error('Invalid quiz data structure');
      }

      const questionnaire = quizData.data.quiz_question_answer.questionaire;
      
      // Helper function to process all questions (including those with code snippets)
      const processAllQuestions = (questionList) => {
        return questionList.map(q => {
          const baseQuestion = q.formatted_question || q.question || '';
          const snippetRaw = (q.code_snippet || '').trim();
          const hasCodeSnippet = snippetRaw !== '';
          
          if (hasCodeSnippet) {
            const normalizedSnippet = snippetRaw.replace(/\r\n/g, '\n');
            const snippetBlock = `\`\`\`js\n${normalizedSnippet}\n\`\`\``;
            console.log(`📝 Question ${q.q_id} includes code snippet: "${normalizedSnippet.substring(0, 50)}..."`);
            if (baseQuestion.includes(snippetBlock)) {
              q.formatted_question = baseQuestion;
            } else if (baseQuestion.includes('```')) {
              // Already has some fenced code, preserve as-is
              q.formatted_question = baseQuestion;
            } else {
              q.formatted_question = `${baseQuestion}\n\n${snippetBlock}`.trim();
            }
          } else {
            q.formatted_question = baseQuestion;
          }
          
          return q;
        });
      };
      
      // Collect all available questions (including those with code snippets)
      let allEasyQuestions = [];
      let allMediumQuestions = [];
      let allHardQuestions = [];
      
      // Extract easy questions - try specific q_ids first, then fallback to first 5 available
      if (questionnaire.easy && Array.isArray(questionnaire.easy)) {
        const easyQIds = [1, 2, 3, 4, 5];
        let easyQuestions = questionnaire.easy.filter(q => easyQIds.includes(q.q_id));
        
        // If we don't have 5 questions from specific IDs, take first 5 available
        if (easyQuestions.length < 5) {
          if (questionnaire.easy.length >= 5) {
            console.log(`⚠️  Only found ${easyQuestions.length} easy questions with q_ids 1-5, using first 5 available instead`);
            easyQuestions = questionnaire.easy.slice(0, 5);
          } else if (questionnaire.easy.length > 0) {
            console.log(`⚠️  Only found ${easyQuestions.length} easy questions with q_ids 1-5, and only ${questionnaire.easy.length} total available. Using all available.`);
            easyQuestions = questionnaire.easy.slice(0, Math.min(5, questionnaire.easy.length));
          }
        }
        
        allEasyQuestions = processAllQuestions(easyQuestions);
        console.log(`📋 Found ${allEasyQuestions.length} easy questions (including those with code snippets)`);
      }

      // Extract medium questions - try specific q_ids first, then fallback to first 3 available
      if (questionnaire.medium && Array.isArray(questionnaire.medium)) {
        const mediumQIds = [11, 12, 13];
        let mediumQuestions = questionnaire.medium.filter(q => mediumQIds.includes(q.q_id));
        
        // If we don't have 3 questions from specific IDs, take first 3 available
        if (mediumQuestions.length < 3) {
          if (questionnaire.medium.length >= 3) {
            console.log(`⚠️  Only found ${mediumQuestions.length} medium questions with q_ids 11-13, using first 3 available instead`);
            mediumQuestions = questionnaire.medium.slice(0, 3);
          } else if (questionnaire.medium.length > 0) {
            console.log(`⚠️  Only found ${mediumQuestions.length} medium questions with q_ids 11-13, and only ${questionnaire.medium.length} total available. Using all available.`);
            mediumQuestions = questionnaire.medium.slice(0, Math.min(3, questionnaire.medium.length));
          }
        }
        
        allMediumQuestions = processAllQuestions(mediumQuestions);
        console.log(`📋 Found ${allMediumQuestions.length} medium questions (including those with code snippets)`);
      }

      // Extract hard questions - try specific q_ids first, then fallback to first 3 available
      if (questionnaire.hard && Array.isArray(questionnaire.hard)) {
        const hardQIds = [17, 18];
        let hardQuestions = questionnaire.hard.filter(q => hardQIds.includes(q.q_id));
        
        // If we don't have 3 questions from specific IDs, take first 3 available
        if (hardQuestions.length < 3) {
          if (questionnaire.hard.length >= 3) {
            console.log(`⚠️  Only found ${hardQuestions.length} hard questions with q_ids 17-18, using first 3 available instead`);
            hardQuestions = questionnaire.hard.slice(0, 3);
          } else if (questionnaire.hard.length > 0) {
            console.log(`⚠️  Only found ${hardQuestions.length} hard questions with q_ids 17-18, and only ${questionnaire.hard.length} total available. Using all available.`);
            hardQuestions = questionnaire.hard.slice(0, Math.min(3, questionnaire.hard.length));
          }
        }
        
        allHardQuestions = processAllQuestions(hardQuestions);
        console.log(`📋 Found ${allHardQuestions.length} hard questions (including those with code snippets)`);
      }

      // CRITICAL RULE: Always maintain exact question distribution
      // Easy: 4 questions (positions 1-4, quiz_id 1-4)
      // Medium: 3 questions (positions 5-7, quiz_id 5-7)
      // Hard: 3 questions (positions 8-10, quiz_id 8-10)
      // Total: 10 questions
      const targetTotal = 10;
      const easyCount = Math.min(4, allEasyQuestions.length);   // Always try to get 4
      const mediumCount = Math.min(3, allMediumQuestions.length); // Always try to get 3
      const hardCount = Math.min(3, allHardQuestions.length);   // Always try to get 3
      
      const totalPlanned = easyCount + mediumCount + hardCount;
      if (totalPlanned !== targetTotal) {
        console.log(`⚠️  Planned distribution is ${totalPlanned} (Easy ${easyCount}, Medium ${mediumCount}, Hard ${hardCount}). Some categories may have insufficient questions.`);
      }
      
      // Add questions to the final array with sequential quiz_id based on final position (1-10)
      // This ensures no duplicate quiz_ids even if same q_id appears in different difficulty levels
      // IMPORTANT: quiz_id must match question position to maintain the rule (1-4 Easy, 5-7 Medium, 8-10 Hard)
      let questionNumber = 1;
      
      // Easy questions: positions 1-4 (quiz_id 1-4)
      allEasyQuestions.slice(0, easyCount).forEach((q, index) => {
        questions.push({
          ...q,
          question_type: 'Easy',
          unique_quiz_id: `${questionNumber}` // Use sequential position instead of q_id
        });
        questionNumber++;
      });

      // Medium questions: positions 5-7 (quiz_id 5-7)
      // Ensure first selected (Q5) has scenario if possible
      if (mediumCount > 0) {
        const hasScenario = (q) => (q.scenario_title && q.scenario_title.trim() !== '') || (q.text_context && q.text_context.trim() !== '');
        const mediumWithScenarioIndex = allMediumQuestions.findIndex(hasScenario);
        const mediumSelected = [];
        if (mediumWithScenarioIndex !== -1) {
          // Put the one with scenario first
          mediumSelected.push(allMediumQuestions[mediumWithScenarioIndex]);
          // Fill remaining from others excluding the chosen one
          for (let i = 0; i < allMediumQuestions.length && mediumSelected.length < mediumCount; i++) {
            if (i === mediumWithScenarioIndex) continue;
            mediumSelected.push(allMediumQuestions[i]);
          }
        } else {
          // No scenario present, fallback to first N
          mediumSelected.push(...allMediumQuestions.slice(0, mediumCount));
        }
        mediumSelected.forEach((q) => {
          questions.push({
            ...q,
            question_type: 'Medium',
            unique_quiz_id: `${questionNumber}` // Use sequential position instead of q_id
          });
          questionNumber++;
        });
      }

      // Hard questions: positions 8-10 (quiz_id 8-10)
      // Ensure first selected (Q8) has scenario if possible
      if (hardCount > 0) {
        const hasScenario = (q) => (q.scenario_title && q.scenario_title.trim() !== '') || (q.text_context && q.text_context.trim() !== '');
        const hardWithScenarioIndex = allHardQuestions.findIndex(hasScenario);
        const hardSelected = [];
        if (hardWithScenarioIndex !== -1) {
          // Put the one with scenario first
          hardSelected.push(allHardQuestions[hardWithScenarioIndex]);
          // Fill remaining from others excluding the chosen one
          for (let i = 0; i < allHardQuestions.length && hardSelected.length < hardCount; i++) {
            if (i === hardWithScenarioIndex) continue;
            hardSelected.push(allHardQuestions[i]);
          }
        } else {
          // No scenario present, fallback to first N
          hardSelected.push(...allHardQuestions.slice(0, hardCount));
        }
        hardSelected.forEach((q) => {
          questions.push({
            ...q,
            question_type: 'Hard',
            unique_quiz_id: `${questionNumber}` // Use sequential position instead of q_id
          });
          questionNumber++;
        });
      }

      console.log(`📋 Final distribution (ordered): ${easyCount} Easy (1-4), ${mediumCount} Medium (5-7), ${hardCount} Hard (8-10) = ${questions.length} total questions`);
      
      // If we still don't have exactly 10 questions, log a warning
      if (questions.length !== targetTotal) {
        console.log(`⚠️  Warning: Could only get ${questions.length} questions (target: ${targetTotal})`);
      }
      
      return questions;
    } catch (error) {
      console.error('❌ Error extracting questions:', error.message);
      throw new Error(`Failed to extract questions: ${error.message}`);
    }
  }

  // Format HTTP log entries into readable format
  formatHttpLogs(markdownText) {
    try {
      // Pattern: IP - - [DD/MMM/YYYY:HH:MM:SS] "METHOD /path HTTP/1.1" status_code
      // Handle cases where HTTP/1.1 might be in the path or separate
      const logPattern = /(\d+\.\d+\.\d+\.\d+)\s+-\s+-\s+\[(\d{2})\/(\w+)\/(\d{4}):(\d{2}):(\d{2}):(\d{2})\]\s+"(\w+)\s+([^"]+)"\s+(\d+)/g;
      
      const logs = [];
      let match;
      let firstDate = null;
      let firstIP = null;
      const statusCodes = new Set();
      
      while ((match = logPattern.exec(markdownText)) !== null) {
        const ip = match[1];
        const day = match[2];
        const month = match[3];
        const year = match[4];
        const hour = match[5];
        const minute = match[6];
        const second = match[7];
        const method = match[8];
        let path = match[9].trim();
        const statusCode = match[10];
        
        // Remove HTTP/1.1 or HTTP/1.0 from path if present
        path = path.replace(/\s+HTTP\/[\d.]+$/, '');
        
        if (!firstDate) {
          firstDate = `${day}/${month}/${year}`;
          firstIP = ip;
        }
        
        statusCodes.add(statusCode);
        logs.push({
          time: `${hour}:${minute}:${second}`,
          method,
          path,
          statusCode
        });
      }
      
      if (logs.length === 0) {
        // Fallback if pattern doesn't match
        return `\`\`\`\n${markdownText}\n\`\`\``;
      }
      
      // Build formatted output
      let formatted = `*Server Logs - ${firstDate}*\n\n`;
      formatted += `IP: ${firstIP}\n\n`;
      
      logs.forEach(log => {
        formatted += `${log.time} → ${log.method} ${log.path} (${log.statusCode})\n`;
      });
      
      // Add status summary
      const uniqueStatusCodes = Array.from(statusCodes);
      if (uniqueStatusCodes.length === 1) {
        const code = uniqueStatusCodes[0];
        if (code.startsWith('4') || code.startsWith('5')) {
          formatted += `\nStatus: All failed (${code} errors)`;
        } else {
          formatted += `\nStatus: All ${code}`;
        }
      } else {
        formatted += `\nStatus: Mixed responses (${uniqueStatusCodes.join(', ')})`;
      }
      
      return formatted;
    } catch (error) {
      console.error('Error formatting HTTP logs:', error);
      return `\`\`\`\n${markdownText}\n\`\`\``;
    }
  }

  // Format process list into readable format
  formatProcessList(markdownText) {
    try {
      // Clean up escaped newlines and backslashes
      let cleaned = markdownText.replace(/\\n/g, '\n').replace(/\\/g, '');
      const lines = cleaned.split('\n').filter(line => line.trim());
      if (lines.length === 0) return `\`\`\`\n${markdownText}\n\`\`\``;
      
      // Find header line
      const headerIndex = lines.findIndex(line => /PID\s+USER/i.test(line));
      if (headerIndex === -1) return `\`\`\`\n${markdownText}\n\`\`\``;
      
      let formatted = '*Process List*\n\n';
      
      // Add header - trim backslashes from start and end
      const header = lines[headerIndex].replace(/^\\+|\\+$/g, '').trim();
      formatted += `${header}\n\n`;
      
      // Add process entries - trim backslashes from start and end
      for (let i = headerIndex + 1; i < lines.length; i++) {
        const line = lines[i].replace(/^\\+|\\+$/g, '').trim();
        if (line) {
          formatted += `${line}\n`;
        }
      }
      
      return formatted.trim();
    } catch (error) {
      console.error('Error formatting process list:', error);
      return `\`\`\`\n${markdownText}\n\`\`\``;
    }
  }

  // Format network traffic table into readable format
  formatNetworkTraffic(markdownText) {
    try {
      // Clean up escaped newlines and backslashes
      let cleaned = markdownText.replace(/\\n/g, '\n').replace(/\\/g, '');
      const lines = cleaned.split('\n').filter(line => line.trim());
      if (lines.length === 0) return `\`\`\`\n${markdownText}\n\`\`\``;
      
      let formatted = '*Network Traffic*\n\n';
      
      // Trim backslashes from start and end of each line
      lines.forEach(line => {
        const cleanedLine = line.replace(/^\\+|\\+$/g, '').trim();
        if (cleanedLine) {
          formatted += `${cleanedLine}\n`;
        }
      });
      
      return formatted.trim();
    } catch (error) {
      console.error('Error formatting network traffic:', error);
      return `\`\`\`\n${markdownText}\n\`\`\``;
    }
  }

  // Format JSON policy into readable format
  formatJsonPolicy(markdownText) {
    try {
      // Try to parse and pretty-print JSON
      const jsonObj = JSON.parse(markdownText);
      const prettyJson = JSON.stringify(jsonObj, null, 2);
      return `*JSON Policy*\n\n\`\`\`json\n${prettyJson}\n\`\`\``;
    } catch (error) {
      // If not valid JSON, return as code block
      return `\`\`\`json\n${markdownText}\n\`\`\``;
    }
  }

  // Format bash script into readable format
  formatBashScript(markdownText) {
    return `*Bash Script*\n\n\`\`\`bash\n${markdownText}\n\`\`\``;
  }

  // Format security logs into readable format
  formatSecurityLogs(markdownText) {
    try {
      // Pattern: [YYYY-MM-DDTHH:MM:SSZ] key=value pairs
      const logPattern = /\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)\]\s+(.+)/g;
      
      const logs = [];
      let match;
      
      while ((match = logPattern.exec(markdownText)) !== null) {
        const timestamp = match[1];
        const content = match[2];
        logs.push({ timestamp, content });
      }
      
      if (logs.length === 0) {
        return `\`\`\`\n${markdownText}\n\`\`\``;
      }
      
      let formatted = '*Security Logs*\n\n';
      
      logs.forEach(log => {
        formatted += `[${log.timestamp}]\n${log.content}\n\n`;
      });
      
      return formatted.trim();
    } catch (error) {
      console.error('Error formatting security logs:', error);
      return `\`\`\`\n${markdownText}\n\`\`\``;
    }
  }

  // Default formatter (fallback)
  formatDefault(markdownText) {
    return `\`\`\`\n${markdownText}\n\`\`\``;
  }

  // Main function to detect content type and format accordingly
  formatMarkdownContent(markdownText) {
    if (!markdownText || markdownText.trim() === '') {
      return '';
    }

    const normalized = markdownText.trim();

    // Detection order matters - check more specific patterns first
    
    // 1. HTTP Logs: IP addresses, timestamps [DD/MMM/YYYY:HH:MM:SS], HTTP methods
    if (/\d+\.\d+\.\d+\.\d+\s+-\s+-\s+\[\d{2}\/\w+\/\d{4}:\d{2}:\d{2}:\d{2}\]/.test(normalized)) {
      return this.formatHttpLogs(normalized);
    }

    // 2. Security Logs: ISO timestamps [YYYY-MM-DDTHH:MM:SSZ]
    if (/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z\]/.test(normalized)) {
      return this.formatSecurityLogs(normalized);
    }

    // 3. Process List: Headers with PID, USER, COMMAND
    if (/PID\s+USER\s+COMMAND/i.test(normalized) || /^\s*\d+\s+\w+\s+/.test(normalized.split('\n')[0])) {
      return this.formatProcessList(normalized);
    }

    // 4. Network Traffic: Headers with Source, Destination, Protocol
    if (/Source\s+Destination\s+Protocol/i.test(normalized) || /Local Address\s+Remote Address/i.test(normalized)) {
      return this.formatNetworkTraffic(normalized);
    }

    // 5. JSON: Starts with { or [
    if (/^\s*[\{\[]/.test(normalized)) {
      return this.formatJsonPolicy(normalized);
    }

    // 6. Bash Script: Starts with #!/bin/bash or contains bash keywords
    if (/^#!\/bin\/bash/.test(normalized) || /(while|if|for)\s+.*\s+do/.test(normalized)) {
      return this.formatBashScript(normalized);
    }

    // 7. Fallback: Default code block
    return this.formatDefault(normalized);
  }

  extractQuestionsCybersecurity(quizData) {
    try {
      const questions = [];
      
      if (!quizData.data || !quizData.data.quiz_question_answer || !quizData.data.quiz_question_answer.questionaire) {
        throw new Error('Invalid quiz data structure');
      }

      const questionnaire = quizData.data.quiz_question_answer.questionaire;
      
      // Helper function to process questions for cybersecurity format
      // Rules:
      // 1. If code_snippet is empty AND markdown is NOT empty → append markdown to question
      // 2. If markdown is empty AND code_snippet is NOT empty:
      //    - If code_image is available → use code_image as code_snippet_imageLink (don't append code)
      //    - If code_image is NOT available → append code_snippet to question
      // 3. If both are empty → keep question as-is
      const processCybersecurityQuestions = (questionList) => {
        return questionList.map(q => {
          const baseQuestion = q.question || '';
          const snippetRaw = (q.code_snippet || '').trim();
          const markdownRaw = (q.markdown || '').trim();
          const hasCodeSnippet = snippetRaw !== '';
          const hasMarkdown = markdownRaw !== '';
          
          // Handle code_image (check both code_image and codee_image typo)
          const codeImage = q.code_image || q.codee_image || null;
          const hasCodeImage = codeImage && codeImage.trim() !== '';
          
          // Rule 1: code_snippet is empty AND markdown is NOT empty → append markdown
          if (!hasCodeSnippet && hasMarkdown) {
            const normalizedMarkdown = markdownRaw.replace(/\r\n/g, '\n');
            const formattedMarkdown = this.formatMarkdownContent(normalizedMarkdown);
            q.formatted_question = `${baseQuestion}\n\n${formattedMarkdown}`.trim();
            q.code_snippet_imageLink = null;
            console.log(`📝 Question ${q.q_id} has markdown (no code_snippet) - formatting and appending markdown to question`);
          }
          // Rule 2: markdown is empty AND code_snippet is NOT empty
          else if (hasCodeSnippet && !hasMarkdown) {
            if (hasCodeImage) {
              // code_image is available → use it as code_snippet_imageLink (don't append code)
              q.formatted_question = baseQuestion;
              q.code_snippet_imageLink = codeImage;
              console.log(`📝 Question ${q.q_id} has code_snippet with code_image - using code_image: ${codeImage}`);
            } else {
              // code_image is NOT available → append code_snippet to question
              const normalizedSnippet = snippetRaw.replace(/\r\n/g, '\n');
              const snippetBlock = `\`\`\`js\n${normalizedSnippet}\n\`\`\``;
              q.formatted_question = `${baseQuestion}\n\n${snippetBlock}`.trim();
              q.code_snippet_imageLink = null;
              console.log(`📝 Question ${q.q_id} has code_snippet without code_image - appending code_snippet to question`);
            }
          }
          // Rule 3: both are empty OR other combinations → keep question as-is
          else {
            q.formatted_question = baseQuestion;
            q.code_snippet_imageLink = hasCodeImage ? codeImage : null;
            if (hasCodeSnippet && hasMarkdown) {
              console.log(`📝 Question ${q.q_id} has both code_snippet and markdown - keeping question as-is, code_snippet_imageLink: ${q.code_snippet_imageLink || 'null'}`);
            } else {
              console.log(`📝 Question ${q.q_id} has neither code_snippet nor markdown - keeping question as-is`);
            }
          }
          
          return q;
        });
      };
      
      // Collect all available questions
      let allEasyQuestions = [];
      let allMediumQuestions = [];
      let allHardQuestions = [];
      
      // Extract easy questions - try specific q_ids first, then fallback to first 4 available
      if (questionnaire.easy && Array.isArray(questionnaire.easy)) {
        const easyQIds = [1, 2, 3, 4, 5];
        let easyQuestions = questionnaire.easy.filter(q => easyQIds.includes(q.q_id));
        
        // If we don't have 4 questions from specific IDs, take first 4 available
        if (easyQuestions.length < 4) {
          if (questionnaire.easy.length >= 4) {
            console.log(`⚠️  Only found ${easyQuestions.length} easy questions with q_ids 1-5, using first 4 available instead`);
            easyQuestions = questionnaire.easy.slice(0, 4);
          } else if (questionnaire.easy.length > 0) {
            console.log(`⚠️  Only found ${easyQuestions.length} easy questions with q_ids 1-5, and only ${questionnaire.easy.length} total available. Using all available.`);
            easyQuestions = questionnaire.easy.slice(0, Math.min(4, questionnaire.easy.length));
          }
        }
        
        allEasyQuestions = processCybersecurityQuestions(easyQuestions);
        console.log(`📋 Found ${allEasyQuestions.length} easy questions`);
      }

      // Extract medium questions - try specific q_ids first, then fallback to first 3 available
      if (questionnaire.medium && Array.isArray(questionnaire.medium)) {
        const mediumQIds = [11, 12, 13];
        let mediumQuestions = questionnaire.medium.filter(q => mediumQIds.includes(q.q_id));
        
        // If we don't have 3 questions from specific IDs, take first 3 available
        if (mediumQuestions.length < 3) {
          if (questionnaire.medium.length >= 3) {
            console.log(`⚠️  Only found ${mediumQuestions.length} medium questions with q_ids 11-13, using first 3 available instead`);
            mediumQuestions = questionnaire.medium.slice(0, 3);
          } else if (questionnaire.medium.length > 0) {
            console.log(`⚠️  Only found ${mediumQuestions.length} medium questions with q_ids 11-13, and only ${questionnaire.medium.length} total available. Using all available.`);
            mediumQuestions = questionnaire.medium.slice(0, Math.min(3, questionnaire.medium.length));
          }
        }
        
        allMediumQuestions = processCybersecurityQuestions(mediumQuestions);
        console.log(`📋 Found ${allMediumQuestions.length} medium questions`);
      }

      // Extract hard questions - try specific q_ids first, then fallback to first 3 available
      if (questionnaire.hard && Array.isArray(questionnaire.hard)) {
        const hardQIds = [17, 18];
        let hardQuestions = questionnaire.hard.filter(q => hardQIds.includes(q.q_id));
        
        // If we don't have 3 questions from specific IDs, take first 3 available
        if (hardQuestions.length < 3) {
          if (questionnaire.hard.length >= 3) {
            console.log(`⚠️  Only found ${hardQuestions.length} hard questions with q_ids 17-18, using first 3 available instead`);
            hardQuestions = questionnaire.hard.slice(0, 3);
          } else if (questionnaire.hard.length > 0) {
            console.log(`⚠️  Only found ${hardQuestions.length} hard questions with q_ids 17-18, and only ${questionnaire.hard.length} total available. Using all available.`);
            hardQuestions = questionnaire.hard.slice(0, Math.min(3, questionnaire.hard.length));
          }
        }
        
        allHardQuestions = processCybersecurityQuestions(hardQuestions);
        console.log(`📋 Found ${allHardQuestions.length} hard questions`);
      }

      // CRITICAL RULE: Always maintain exact question distribution
      // Easy: 4 questions (positions 1-4, quiz_id 1-4)
      // Medium: 3 questions (positions 5-7, quiz_id 5-7)
      // Hard: 3 questions (positions 8-10, quiz_id 8-10)
      // Total: 10 questions
      const targetTotal = 10;
      const easyCount = Math.min(4, allEasyQuestions.length);   // Always try to get 4
      const mediumCount = Math.min(3, allMediumQuestions.length); // Always try to get 3
      const hardCount = Math.min(3, allHardQuestions.length);   // Always try to get 3
      
      const totalPlanned = easyCount + mediumCount + hardCount;
      if (totalPlanned !== targetTotal) {
        console.log(`⚠️  Planned distribution is ${totalPlanned} (Easy ${easyCount}, Medium ${mediumCount}, Hard ${hardCount}). Some categories may have insufficient questions.`);
      }
      
      // Add questions to the final array with sequential quiz_id based on final position (1-10)
      let questionNumber = 1;
      
      // Easy questions: positions 1-4 (quiz_id 1-4)
      allEasyQuestions.slice(0, easyCount).forEach((q, index) => {
        questions.push({
          ...q,
          question_type: 'Easy',
          unique_quiz_id: `${questionNumber}`,
          // Ensure code_snippet_imageLink is included (null if not present)
          code_snippet_imageLink: q.code_snippet_imageLink || null
        });
        questionNumber++;
      });

      // Medium questions: positions 5-7 (quiz_id 5-7)
      // Ensure first selected (Q5) has scenario if possible
      if (mediumCount > 0) {
        const hasScenario = (q) => (q.scenario_title && q.scenario_title.trim() !== '') || (q.text_context && q.text_context.trim() !== '');
        const mediumWithScenarioIndex = allMediumQuestions.findIndex(hasScenario);
        const mediumSelected = [];
        if (mediumWithScenarioIndex !== -1) {
          // Put the one with scenario first
          mediumSelected.push(allMediumQuestions[mediumWithScenarioIndex]);
          // Fill remaining from others excluding the chosen one
          for (let i = 0; i < allMediumQuestions.length && mediumSelected.length < mediumCount; i++) {
            if (i === mediumWithScenarioIndex) continue;
            mediumSelected.push(allMediumQuestions[i]);
          }
        } else {
          // No scenario present, fallback to first N
          mediumSelected.push(...allMediumQuestions.slice(0, mediumCount));
        }
        mediumSelected.forEach((q) => {
          questions.push({
            ...q,
            question_type: 'Medium',
            unique_quiz_id: `${questionNumber}`,
            // Ensure code_snippet_imageLink is included (null if not present)
            code_snippet_imageLink: q.code_snippet_imageLink || null
          });
          questionNumber++;
        });
      }

      // Hard questions: positions 8-10 (quiz_id 8-10)
      // Ensure first selected (Q8) has scenario if possible
      if (hardCount > 0) {
        const hasScenario = (q) => (q.scenario_title && q.scenario_title.trim() !== '') || (q.text_context && q.text_context.trim() !== '');
        const hardWithScenarioIndex = allHardQuestions.findIndex(hasScenario);
        const hardSelected = [];
        if (hardWithScenarioIndex !== -1) {
          // Put the one with scenario first
          hardSelected.push(allHardQuestions[hardWithScenarioIndex]);
          // Fill remaining from others excluding the chosen one
          for (let i = 0; i < allHardQuestions.length && hardSelected.length < hardCount; i++) {
            if (i === hardWithScenarioIndex) continue;
            hardSelected.push(allHardQuestions[i]);
          }
        } else {
          // No scenario present, fallback to first N
          hardSelected.push(...allHardQuestions.slice(0, hardCount));
        }
        hardSelected.forEach((q) => {
          questions.push({
            ...q,
            question_type: 'Hard',
            unique_quiz_id: `${questionNumber}`,
            // Ensure code_snippet_imageLink is included (null if not present)
            code_snippet_imageLink: q.code_snippet_imageLink || null
          });
          questionNumber++;
        });
      }

      console.log(`📋 Final distribution (ordered): ${easyCount} Easy (1-4), ${mediumCount} Medium (5-7), ${hardCount} Hard (8-10) = ${questions.length} total questions`);
      
      // If we still don't have exactly 10 questions, log a warning
      if (questions.length !== targetTotal) {
        console.log(`⚠️  Warning: Could only get ${questions.length} questions (target: ${targetTotal})`);
      }
      
      return questions;
    } catch (error) {
      console.error('❌ Error extracting cybersecurity questions:', error.message);
      throw new Error(`Failed to extract cybersecurity questions: ${error.message}`);
    }
  }
}

module.exports = new GenerateQuizService();
