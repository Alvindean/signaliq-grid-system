/**
 * SONIQ — Auth stub
 * POST /api/auth
 * Placeholder — wire up Supabase later when you're ready for accounts.
 */
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  return res.status(200).json({ message: 'Auth not yet configured. Add Supabase to enable accounts.' });
};
