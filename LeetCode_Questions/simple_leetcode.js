
// simple-leetcode-scraper.js
const fs = require('fs');
const https = require('https');

// Function to make HTTP requests
function makeRequest(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve(data);
          }
        } else {
          reject(new Error(`Request failed with status code ${res.statusCode}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

// Main function to fetch LeetCode questions
async function fetchLeetCodeQuestions(startId, endId) {
  console.log(`Fetching LeetCode questions from ID ${startId} to ${endId}...`);
  
  const questions = [];
  
  for (let id = startId; id <= endId; id++) {
    try {
      console.log(`Fetching question ${id}...`);
      
      // First, get the question's titleSlug
      const allQuestionsResponse = await makeRequest('https://leetcode.com/api/problems/all/');
      
      const questionInfo = allQuestionsResponse.stat_status_pairs.find(
        (q) => parseInt(q.stat.frontend_question_id) === id
      );
      
      if (!questionInfo) {
        console.log(`Question with ID ${id} not found, skipping...`);
        continue;
      }
      
      const titleSlug = questionInfo.stat.question__title_slug;
      
      // Now fetch the detailed question content using GraphQL
      const graphqlResponse = await makeRequest('https://leetcode.com/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Referer': 'https://leetcode.com/problems/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      }, JSON.stringify({
        query: `
          query questionContent($titleSlug: String!) {
            question(titleSlug: $titleSlug) {
              questionId
              questionFrontendId
              title
              titleSlug
              content
              difficulty
            }
          }
        `,
        variables: {
          titleSlug
        }
      }));
      
      const question = graphqlResponse.data.question;
      
      questions.push({
        id: parseInt(question.questionFrontendId),
        title: question.title,
        content: question.content,
        difficulty: question.difficulty,
        titleSlug: question.titleSlug
      });
      
      console.log(`Successfully fetched question ${id}: ${question.title}`);
      
      // Add a delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Error fetching question ${id}:`, error);
    }
  }
  
  console.log(`Fetched ${questions.length} questions successfully.`);
  
  // Format questions for AI training
  const formattedText = questions.map(q => {
    // Strip HTML tags but preserve line breaks
    const cleanContent = q.content
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ') // Replace &nbsp; with spaces
      .replace(/&lt;/g, '<') // Replace &lt; with <
      .replace(/&gt;/g, '>') // Replace &gt; with >
      .replace(/&amp;/g, '&') // Replace &amp; with &
      .replace(/\n\s*\n/g, '\n\n'); // Normalize multiple line breaks
    
    return `QUESTION ${q.id}: ${q.title}
DIFFICULTY: ${q.difficulty}
URL: https://leetcode.com/problems/${q.titleSlug}/

${cleanContent}

----------------------------------------
`;
  }).join('\n');
  
  // Save to file
  fs.writeFileSync('leetcode-questions.txt', formattedText);
  console.log('Questions saved to leetcode-questions.txt');
  
  return questions;
}

// Get command line arguments
const args = process.argv.slice(2);
const startId = parseInt(args[0]) || 1;
const endId = parseInt(args[1]) || 10;

// Run the script
fetchLeetCodeQuestions(startId, endId).catch(console.error);
