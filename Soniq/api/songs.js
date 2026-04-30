/**
 * SONIQ — Songs stub
 * GET/POST/DELETE /api/songs
 * Placeholder — wire up Supabase later for cloud library.
 */
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  return res.status(200).json({ songs: [], message: 'Cloud library not yet configured.' });
};
