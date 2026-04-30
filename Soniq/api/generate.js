/**
 * SONIQ — OpenRouter API Proxy
 * POST /api/generate
 * Keeps your API key server-side. Works with OpenRouter.
 */

const anonUsage = new Map();

function checkLimit(ip) {
  const now = Date.now();
  const entry = anonUsage.get(ip);
  if (!entry || (now - entry.reset) > 3600000) {
    anonUsage.set(ip, { count: 1, reset: now });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'OPENROUTER_API_KEY is not set. Go to Vercel → Settings → Environment Variables and add it.'
    });
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (!checkLimit(ip)) {
    return res.status(429).json({ error: 'Hourly limit reached. Come back soon.' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const { messages, system, max_tokens = 4096 } = body || {};
  if (!messages?.length) return res.status(400).json({ error: 'messages required' });

  // Build OpenRouter (OpenAI-compatible) request
  const orMessages = system
    ? [{ role: 'system', content: system }, ...messages]
    : messages;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
        'HTTP-Referer': 'https://soniq.vercel.app',
        'X-Title': 'SONIQ',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4-5',
        max_tokens: Math.min(max_tokens, 4096),
        messages: orMessages,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenRouter error:', response.status, errText);
      return res.status(response.status).json({
        error: 'OpenRouter API error ' + response.status,
        detail: errText,
      });
    }

    const data = await response.json();
    // Convert OpenAI format back to Anthropic format the frontend expects
    const text = data.choices?.[0]?.message?.content || '';
    return res.status(200).json({
      content: [{ type: 'text', text }]
    });

  } catch (err) {
    console.error('Proxy error:', err);
    return res.status(500).json({ error: err.message });
  }
};
