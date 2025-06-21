const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const whois = require('whois');
const moment = require('moment');
const cron = require('node-cron');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration for time override (for testing)
const TIME_OVERRIDE = process.env.TIME_OVERRIDE; // Format: YYYY-MM-DD

// Helper function to get current time (with override support)
function getCurrentMoment() {
  if (TIME_OVERRIDE) {
    console.log(`Using TIME_OVERRIDE: ${TIME_OVERRIDE}`);
    return moment(TIME_OVERRIDE);
  }
  const now = moment();
  console.log(`Using system time: ${now.format('YYYY-MM-DD HH:mm:ss')}`);
  return now;
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Database setup
const db = new sqlite3.Database('./domains.db');

// Initialize database
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS domains (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT UNIQUE NOT NULL,
    expiry_date TEXT,
    registrar TEXT,
    status TEXT,
    last_checked TEXT,
    domain_type TEXT DEFAULT 'my_domain',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// Helper function to parse whois data
function parseWhoisData(whoisData) {
  const lines = whoisData.split('\n');
  let expiryDate = null;
  let registrar = null;
  let status = null;
  let debugInfo = [];
  
  // Check for domain not found indicators
  const whoisLower = whoisData.toLowerCase();
  const notFoundIndicators = [
    'no match for',
    'not found',
    'no data found',
    'domain not found',
    'no matching record',
    'no entries found',
    'not registered',
    'available for registration',
    'no whois server',
    'not exist'
  ];
  
  for (let indicator of notFoundIndicators) {
    if (whoisLower.includes(indicator)) {
      debugInfo.push(`Domain not found indicator: ${indicator}`);
      return { expiryDate: null, registrar: null, status: 'not_found' };
    }
  }

  for (let line of lines) {
    const lowerLine = line.toLowerCase();
    
    // Check for expiry date patterns - more comprehensive
    if (lowerLine.includes('expiry date') || 
        lowerLine.includes('expiration date') || 
        lowerLine.includes('expires on') ||
        lowerLine.includes('registry expiry date') ||
        lowerLine.includes('expiry:') ||
        lowerLine.includes('expires:') ||
        lowerLine.includes('expire date') ||
        lowerLine.includes('domain expiry date') ||
        lowerLine.includes('paid-till')) {
      
      debugInfo.push(`Found expiry line: ${line.trim()}`);
      
      // More comprehensive date pattern matching
      const datePatterns = [
        /(\d{4}-\d{2}-\d{2})/,                          // 2025-06-03
        /(\d{2}\/\d{2}\/\d{4})/,                        // 06/03/2025
        /(\d{2}-\d{2}-\d{4})/,                          // 06-03-2025
        /(\d{1,2}-\w{3}-\d{4})/,                        // 3-Jun-2025
        /(\d{4}\/\d{2}\/\d{2})/,                        // 2025/06/03
        /(\d{4}\.\d{2}\.\d{2})/,                        // 2025.06.03
        /(\d{2}\.\d{2}\.\d{4})/,                        // 03.06.2025
        /(\w{3}\s+\d{1,2},?\s+\d{4})/,                  // Jun 3, 2025
        /(\d{1,2}\s+\w{3}\s+\d{4})/,                    // 3 Jun 2025
        /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/,       // 2025-06-03T00:00:00
        /(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/,       // 2025-06-03 00:00:00
        /(\d{1,2}[\.\/\-]\d{1,2}[\.\/\-]\d{4})/        // Various DD.MM.YYYY, DD/MM/YYYY formats
      ];
      
      for (let pattern of datePatterns) {
        const dateMatch = line.match(pattern);
        if (dateMatch) {
          try {
            const parsedDate = moment(dateMatch[1], [
              'YYYY-MM-DD',
              'MM/DD/YYYY',
              'DD/MM/YYYY',
              'MM-DD-YYYY',
              'DD-MM-YYYY',
              'DD-MMM-YYYY',
              'YYYY/MM/DD',
              'YYYY.MM.DD',
              'DD.MM.YYYY',
              'MM.DD.YYYY',
              'MMM DD, YYYY',
              'DD MMM YYYY',
              'YYYY-MM-DDTHH:mm:ss',
              'YYYY-MM-DD HH:mm:ss',
              'DD/MM/YYYY',
              'DD-MM-YYYY'
            ]);
            
            if (parsedDate.isValid()) {
              expiryDate = parsedDate.format('YYYY-MM-DD');
              debugInfo.push(`Successfully parsed date: ${dateMatch[1]} -> ${expiryDate}`);
              break;
            } else {
              debugInfo.push(`Failed to parse date: ${dateMatch[1]} (invalid moment)`);
            }
          } catch (e) {
            debugInfo.push(`Failed to parse date: ${dateMatch[1]} (exception: ${e.message})`);
          }
        }
      }
      
      if (expiryDate) break;
    }
    
    // Check for registrar
    if (lowerLine.includes('registrar:') && !registrar) {
      registrar = line.split(':')[1]?.trim();
    }
    
    // Check for status
    if (lowerLine.includes('status:') && !status) {
      status = line.split(':')[1]?.trim();
    }
  }

  if (debugInfo.length > 0) {
    console.log('WHOIS Parse Debug:', debugInfo.join('; '));
  }
  
  // If no expiry date found and no explicit status, likely domain doesn't exist or has issues
  if (!expiryDate && !status) {
    return { expiryDate: null, registrar, status: 'no_data' };
  }

  return { expiryDate, registrar, status };
}

// API Routes

// Get all domains
app.get('/api/domains', (req, res) => {
  const sortBy = req.query.sort || 'expiry_date';
  const sortOrder = req.query.order || 'ASC';
  const domainType = req.query.type || 'all';
  
  let query = 'SELECT * FROM domains';
  let params = [];
  
  // Filter by domain type
  if (domainType !== 'all') {
    query += ' WHERE domain_type = ?';
    params.push(domainType);
  }
  
  // Sort options
  if (sortBy === 'expiry_date') {
    query += ` ORDER BY 
      CASE WHEN expiry_date IS NULL THEN 1 ELSE 0 END,
      expiry_date ${sortOrder}`;
  } else if (sortBy === 'domain') {
    query += ` ORDER BY domain ${sortOrder}`;
  } else if (sortBy === 'status') {
    query += ` ORDER BY status ${sortOrder}, expiry_date ASC`;
  } else {
    query += ` ORDER BY created_at DESC`;
  }
  
  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    // Add days until expiry for each domain
    const currentMoment = getCurrentMoment();
    const domainsWithDays = rows.map(domain => {
      if (domain.expiry_date) {
        const expiryMoment = moment(domain.expiry_date);
        const daysUntilExpiry = expiryMoment.diff(currentMoment, 'days');
        
        // Debug logging for specific domains
        if (domain.domain === 'monkeymart.lol') {
          console.log(`DEBUG ${domain.domain}: expiry=${domain.expiry_date}, current=${currentMoment.format('YYYY-MM-DD')}, days=${daysUntilExpiry}`);
        }
        
        return { ...domain, days_until_expiry: daysUntilExpiry };
      }
      return { ...domain, days_until_expiry: null };
    });
    
    res.json({
      domains: domainsWithDays,
      server_time: currentMoment.format('YYYY-MM-DD HH:mm:ss'),
      server_timestamp: currentMoment.valueOf()
    });
  });
});

// Add new domain
app.post('/api/domains', (req, res) => {
  const { domain, domain_type = 'my_domain', notes = '' } = req.body;
  
  if (!domain) {
    return res.status(400).json({ error: 'Domain is required' });
  }
  
  // Clean domain name
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '').split('/')[0];
  
  db.run('INSERT INTO domains (domain, status, domain_type, notes) VALUES (?, ?, ?, ?)', 
    [cleanDomain, 'pending', domain_type, notes], 
    function(err) {
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT') {
          return res.status(400).json({ error: 'Domain already exists' });
        }
        return res.status(500).json({ error: err.message });
      }
      
      // Immediately check domain info
      checkDomainInfo(cleanDomain);
      
      res.json({ 
        id: this.lastID, 
        domain: cleanDomain, 
        domain_type: domain_type,
        message: 'Domain added successfully' 
      });
    });
});

// Delete domain
app.delete('/api/domains/:id', (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM domains WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Domain not found' });
    }
    
    res.json({ message: 'Domain deleted successfully' });
  });
});

// Update domain
app.put('/api/domains/:id', (req, res) => {
  const { id } = req.params;
  const { domain_type, notes } = req.body;
  
  db.run('UPDATE domains SET domain_type = ?, notes = ? WHERE id = ?', 
    [domain_type, notes, id], 
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Domain not found' });
      }
      
      res.json({ message: 'Domain updated successfully' });
    });
});

// Refresh domain info
app.post('/api/domains/:id/refresh', (req, res) => {
  const { id } = req.params;
  
  db.get('SELECT domain FROM domains WHERE id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (!row) {
      return res.status(404).json({ error: 'Domain not found' });
    }
    
    checkDomainInfo(row.domain);
    res.json({ message: 'Domain refresh initiated' });
  });
});

// Function to check DNS resolution
function checkDNS(domain) {
  return new Promise((resolve) => {
    const dns = require('dns');
    dns.resolve4(domain, (err, addresses) => {
      if (err) {
        resolve(false);
      } else {
        resolve(addresses && addresses.length > 0);
      }
    });
  });
}

// Function to check domain information
async function checkDomainInfo(domain) {
  console.log(`Checking domain: ${domain}`);
  
  // First check DNS resolution
  const hasDNS = await checkDNS(domain);
  console.log(`DNS check for ${domain}: ${hasDNS ? 'RESOLVED' : 'NOT RESOLVED'}`);
  
  whois.lookup(domain, async (err, data) => {
    if (err) {
      console.error(`Error checking ${domain}:`, err.message);
      
      // If WHOIS fails but DNS works, it might be a WHOIS server issue
      if (hasDNS) {
        console.log(`${domain}: WHOIS failed but DNS works - treating as active with unknown expiry`);
        db.run('UPDATE domains SET status = ?, expiry_date = ?, registrar = ?, last_checked = ? WHERE domain = ?', 
          ['active', null, 'Unknown (WHOIS unavailable)', new Date().toISOString(), domain]);
      } else {
        db.run('UPDATE domains SET status = ?, expiry_date = ?, registrar = ?, last_checked = ? WHERE domain = ?', 
          ['error', null, null, new Date().toISOString(), domain]);
      }
      return;
    }
    
    // Debug logging for problematic domains
    if (domain === 'slopegame3d.com' || domain === 'kjahskdlfahsdf.com' || domain === 'monkeymart.one') {
      console.log(`\n=== DEBUG WHOIS DATA FOR ${domain} ===`);
      console.log(data);
      console.log('=== END DEBUG ===\n');
    }
    
    const { expiryDate, registrar, status } = parseWhoisData(data);
    
    // Determine final status with DNS validation
    let finalStatus = 'active';
    
    if (status === 'not_found' || status === 'no_data') {
      // If WHOIS says not found but DNS resolves, it's likely a WHOIS issue
      if (hasDNS) {
        console.log(`${domain}: WHOIS says NOT FOUND but DNS resolves - treating as active`);
        finalStatus = 'active';
      } else {
        finalStatus = 'error';
      }
    } else if (status) {
      finalStatus = status;
    } else if (expiryDate) {
      finalStatus = 'active';
    } else {
      // No expiry date and no status - check DNS
      if (hasDNS) {
        finalStatus = 'active'; // DNS works, probably just missing WHOIS data
      } else {
        finalStatus = 'error';
      }
    }
    
    // If WHOIS data is incomplete but DNS works, use fallback registrar
    let finalRegistrar = registrar;
    if (!finalRegistrar && hasDNS && (status === 'not_found' || !expiryDate)) {
      finalRegistrar = 'Unknown (WHOIS limited)';
    }
    
    db.run(`UPDATE domains SET 
      expiry_date = ?, 
      registrar = ?, 
      status = ?, 
      last_checked = ? 
      WHERE domain = ?`, 
      [expiryDate, finalRegistrar, finalStatus, new Date().toISOString(), domain],
      (err) => {
        if (err) {
          console.error('Database update error:', err);
        } else {
          console.log(`Updated ${domain}: expires ${expiryDate}, status ${finalStatus}, DNS: ${hasDNS ? 'YES' : 'NO'} (enhanced validation)`);
        }
      });
  });
}

// Initialize with provided domains
const initialDomains = [
  'chromewebstore.google.com',
  'sites.google.com',
  'slopegame3d.io',
  'nointernetgame.com',
  'slope-unblocked-games.github.io',
  'slope3d.io',
  'chrome.google.com',
  'slope-game.online',
  'slopeio.io',
  'slope-3d.com',
  'slopegame3d.com',
  'slope-game.github.io',
  'slopegame.io',
  'slopegame.online',
  'doodoo.love',
  'br-nm.enjoy4fun.com',
  'spiele101.de',
  'igre.games',
  'www.spelletjes.nl',
  'gombis.nl',
  'www.friv2021.com',
  'www.juegos.com',
  'sz-games.github.io',
  'es.brightestgames.com',
  'arcadespot.com',
  'watchdocumentaries.com',
  'webcatalog.io',
  'www.silvergames.com',
  'retrobowl.me',
  'calcsimple.com',
  'tiny-fishing.com',
  'it.y8.com',
  'id.y8.com',
  'fr.y8.com',
  'de.y8.com',
  'pt.y8.com',
  'gamecomets.com',
  'es.y8.com',
  'www.goolgames.com',
  'retrobowl-unblocked.github.io',
  'classroom-6x.io',
  'skooldeliver.github.io',
  'monkeymart.lol',
  'forum.creative.gimkit.com',
  'ubg365.github.io'
];

// Add initial domains on startup and migrate existing domains
db.serialize(() => {
  // Add domain_type column if it doesn't exist (migration)
  db.run(`ALTER TABLE domains ADD COLUMN domain_type TEXT DEFAULT 'my_domain'`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Migration error:', err.message);
    }
  });
  
  db.run(`ALTER TABLE domains ADD COLUMN notes TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Migration error:', err.message);
    }
  });
  
  // Add initial domains
  initialDomains.forEach(domain => {
    db.run('INSERT OR IGNORE INTO domains (domain, status, domain_type) VALUES (?, ?, ?)', 
      [domain, 'pending', 'my_domain']);
  });
});

// Schedule automatic domain checks (every day at 2 AM)
cron.schedule('0 2 * * *', () => {
  console.log('Running scheduled domain checks...');
  db.all('SELECT domain FROM domains', (err, rows) => {
    if (!err && rows) {
      rows.forEach(row => {
        setTimeout(() => checkDomainInfo(row.domain), Math.random() * 10000);
      });
    }
  });
});

// Debug endpoint to check system time
app.get('/api/system-info', (req, res) => {
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
});



// Serve static files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Current system date: ${currentDate.toISOString()}`);
  console.log(`Current year: ${currentYear}`);
  
  // Check if system date seems incorrect
  if (currentYear < 2024 || currentYear > 2030) {
    console.warn(`⚠️  WARNING: System date appears to be incorrect (${currentYear}). This may affect domain expiry calculations.`);
  }
  
  // Initial domain check after startup
  setTimeout(() => {
    initialDomains.forEach((domain, index) => {
      setTimeout(() => checkDomainInfo(domain), index * 2000);
    });
  }, 3000);
}); 