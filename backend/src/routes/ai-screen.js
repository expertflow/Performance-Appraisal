'use strict';
const express = require('express');
const router  = express.Router();
const https   = require('https');

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL   = 'claude-opus-4-5';

/**
 * POST /api/v1/ai/screen-resume
 * Body: { resumeText, coverLetter, requirements: string[], jobTitle }
 * Returns: { requirements: [{name, score, reason}], overallScore, summary }
 */
router.post('/screen-resume', async (req, res) => {
  const { resumeText, coverLetter, requirements, jobTitle } = req.body;

  if (!requirements || !Array.isArray(requirements) || requirements.length === 0) {
    return res.status(400).json({ error: 'requirements array is required' });
  }
  if (!resumeText && !coverLetter) {
    return res.status(400).json({ error: 'resumeText or coverLetter is required' });
  }

  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'CLAUDE_API_KEY not configured on server' });
  }

  const candidateContent = [
    resumeText   ? `RESUME:\n${resumeText}`        : '',
    coverLetter  ? `COVER LETTER:\n${coverLetter}` : '',
  ].filter(Boolean).join('\n\n');

  const requirementsList = requirements
    .map((r, i) => `${i + 1}. ${typeof r === 'string' ? r : r.text || JSON.stringify(r)}`)
    .join('\n');

  const systemPrompt = `You are an expert HR recruiter and resume screener. 
Analyze the candidate's resume and cover letter against the job requirements.
For each requirement, provide a match score from 0 to 100 and a brief reason.
Respond ONLY with valid JSON in this exact format:
{
  "requirements": [
    { "name": "requirement text", "score": 85, "reason": "brief explanation" }
  ],
  "overallScore": 78,
  "summary": "2-3 sentence overall assessment"
}`;

  const userPrompt = `Job Title: ${jobTitle || 'Not specified'}

JOB REQUIREMENTS:
${requirementsList}

CANDIDATE PROFILE:
${candidateContent}

Evaluate how well this candidate meets each requirement. Be objective and specific.`;

  const payload = JSON.stringify({
    model: CLAUDE_MODEL,
    max_tokens: 1500,
    system: systemPrompt,
    messages: [
      { role: 'user', content: userPrompt },
    ],
  });

  try {
    const result = await callClaudeApi(apiKey, payload);
    res.json(result);
  } catch (err) {
    console.error('[ai-screen] Error:', err.message);
    res.status(500).json({ error: err.message || 'AI screening failed' });
  }
});

function callClaudeApi(apiKey, payload) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.anthropic.com',
      path:     '/v1/messages',
      method:   'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length':    Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (resp) => {
      let data = '';
      resp.on('data', chunk => { data += chunk; });
      resp.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            return reject(new Error(parsed.error.message || JSON.stringify(parsed.error)));
          }
          const content = parsed.content?.[0]?.text;
          if (!content) return reject(new Error('Empty response from Claude API'));

          // Extract JSON from the response (handle markdown code blocks)
          const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
          const jsonStr = jsonMatch[1].trim();
          const aiResult = JSON.parse(jsonStr);
          resolve(aiResult);
        } catch (e) {
          reject(new Error(`Failed to parse Claude response: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

module.exports = router;
