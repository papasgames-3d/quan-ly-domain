const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const whois = require('whois');
const moment = require('moment');
const path = require('path');

const app = express();

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

// Database setup - Use in-memory database for serverless
let db;
function initDatabase() {
  if (!db) {
    // In production, you might want to use a cloud database like PlanetScale, Supabase, etc.
    db = new sqlite3.Database(':memory:');
    
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
      
      // Add initial domains
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
        'monkeymart.lol'
      ];
      
      initialDomains.forEach(domain => {
        db.run('INSERT OR IGNORE INTO domains (domain, status, domain_type) VALUES (?, ?, ?)', 
          [domain, 'pending', 'my_domain']);
      });
    });
  }
  return db;
}

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
    
    // Check for expiry date patterns
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
      
      const datePatterns = [
        /(\d{4}-\d{2}-\d{2})/,
        /(\d{2}\/\d{2}\/\d{4})/,
        /(\d{2}-\d{2}-\d{4})/,
        /(\d{1,2}-\w{3}-\d{4})/,
        /(\d{4}\/\d{2}\/\d{2})/,
        /(\d{4}\.\d{2}\.\d{2})/,
        /(\d{2}\.\d{2}\.\d{4})/,
        /(\w{3}\s+\d{1,2},?\s+\d{4})/,
        /(\d{1,2}\s+\w{3}\s+\d{4})/,
        /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/,
        /(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/,
        /(\d{1,2}[\.\/\-]\d{1,2}[\.\/\-]\d{4})/
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
  
  if (!expiryDate && !status) {
    return { expiryDate: null, registrar, status: 'no_data' };
  }

  return { expiryDate, registrar, status };
}

// DNS check function
function checkDNS(domain) {
  const dns = require('dns');
  return new Promise((resolve) => {
    dns.resolve(domain, (err) => {
      if (err) {
        console.log(`DNS check for ${domain}: NOT RESOLVED`);
        resolve(false);
      } else {
        console.log(`DNS check for ${domain}: RESOLVED`);
        resolve(true);
      }
    });
  });
}

// Check domain info function
async function checkDomainInfo(domain) {
  const db = initDatabase();
  const hasDNS = await checkDNS(domain);
  
  whois.lookup(domain, async (err, data) => {
    if (err) {
      console.error(`Error checking ${domain}:`, err.message);
      
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
    
    const { expiryDate, registrar, status } = parseWhoisData(data);
    
    let finalStatus = 'active';
    
    if (status === 'not_found' || status === 'no_data') {
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
      if (hasDNS) {
        finalStatus = 'active';
      } else {
        finalStatus = 'error';
      }
    }
    
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

// API Routes
app.get('/api/domains', (req, res) => {
  const db = initDatabase();
  const sortBy = req.query.sort || 'expiry_date';
  const sortOrder = req.query.order || 'ASC';
  const domainType = req.query.type || 'all';
  
  let query = 'SELECT * FROM domains';
  let params = [];
  
  if (domainType !== 'all') {
    query += ' WHERE domain_type = ?';
    params.push(domainType);
  }
  
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
      res.status(500).json({ error: err.message });
      return;
    }
    
    const currentMoment = getCurrentMoment();
    const domainsWithDays = rows.map(domain => {
      let daysUntilExpiry = null;
      if (domain.expiry_date) {
        const expiryMoment = moment(domain.expiry_date);
        daysUntilExpiry = expiryMoment.diff(currentMoment, 'days');
      }
      return { ...domain, days_until_expiry: daysUntilExpiry };
    });
    
    res.json(domainsWithDays);
  });
});

app.post('/api/domains', (req, res) => {
  const db = initDatabase();
  const { domain, domain_type = 'my_domain', notes = '' } = req.body;
  
  if (!domain) {
    return res.status(400).json({ error: 'Domain is required' });
  }
  
  db.run('INSERT INTO domains (domain, status, domain_type, notes) VALUES (?, ?, ?, ?)', 
    [domain.toLowerCase(), 'pending', domain_type, notes], 
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'Domain already exists' });
        }
        return res.status(500).json({ error: err.message });
      }
      
      setTimeout(() => checkDomainInfo(domain.toLowerCase()), 1000);
      res.json({ id: this.lastID, domain, status: 'pending' });
    });
});

app.delete('/api/domains/:id', (req, res) => {
  const db = initDatabase();
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

app.put('/api/domains/:id', (req, res) => {
  const db = initDatabase();
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

app.post('/api/domains/:id/check', (req, res) => {
  const db = initDatabase();
  const { id } = req.params;
  
  db.get('SELECT domain FROM domains WHERE id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (!row) {
      return res.status(404).json({ error: 'Domain not found' });
    }
    
    checkDomainInfo(row.domain);
    res.json({ message: 'Domain check initiated' });
  });
});

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
app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// Export for Vercel
module.exports = app; 