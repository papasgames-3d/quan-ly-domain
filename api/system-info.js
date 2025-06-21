const moment = require('moment');

// Configuration for time override (for testing)
const TIME_OVERRIDE = process.env.TIME_OVERRIDE;

// Helper function to get current time (with override support)
function getCurrentMoment() {
  if (TIME_OVERRIDE) {
    console.log(`Using TIME_OVERRIDE: ${TIME_OVERRIDE}`);
    return moment(TIME_OVERRIDE);
  }
  return moment();
}

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'GET') {
    const now = new Date();
    const momentNow = moment();
    const currentMoment = getCurrentMoment();
    
    res.json({
      system_date: now.toISOString(),
      system_year: now.getFullYear(),
      moment_date: momentNow.format('YYYY-MM-DD HH:mm:ss'),
      current_date_used: currentMoment.format('YYYY-MM-DD HH:mm:ss'),
      time_override: TIME_OVERRIDE || null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      warning: now.getFullYear() > 2024 ? 'System date appears to be in the future' : null
    });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}; 