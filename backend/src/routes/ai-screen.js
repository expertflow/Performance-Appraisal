'use strict';
const express = require('express');
const router  = express.Router();
const https   = require('https');

const KIMI_API_URL = 'https://api.moonshot.cn/v1/chat/completions';
const KIMI_MODEL   = 'moonshot-v1-8k';

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

  const apiKey = process.env.KIMI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'KIMI_API_KEY not configured on server' });
  }

  const candidateContent = [
    resumeText   ? `RESUME:\n${resumeText}`     : '',
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
    model: KIMI_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt   },
    ],
    temperature: 0.3,
    max_tokens:  1500,
  });

  try {
    const result = await callKimiApi(apiKey, payload);
    res.json(result);
  } catch (err) {
    console.error('[ai-screen] Error:', err.message);
    res.status(500).json({ error: err.message || 'AI screening failed' });
  }
});

function callKimiApi(apiKey, payload) {
  return new Promise((resolve, reject) => {
    const url = new URL(KIMI_API_URL);
    const options = {
      hostname: url.hostname,
      path:     url.pathname,
      method:   'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(payload),
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
          const content = parsed.choices?.[0]?.message?.content;
          if (!content) return reject(new Error('Empty response from Kimi API'));

          // Extract JSON from the response (handle markdown code blocks)
          const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
          const jsonStr = jsonMatch[1].trim();
          const aiResult = JSON.parse(jsonStr);
          resolve(aiResult);
        } catch (e) {
          reject(new Error(`Failed to parse Kimi response: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

module.exports = router;
