const sqlite3 = require('sqlite3').verbose();
const whois = require('whois');
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

// Database setup - Use in-memory database for serverless
let db;
function initDatabase() {
  if (!db) {
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
  
  // Check for domain not found indicators
  const whoisLower = whoisData.toLowerCase();
  const notFoundIndicators = [
    'no match for', 'not found', 'no data found', 'domain not found',
    'no matching record', 'no entries found', 'not registered',
    'available for registration', 'no whois server', 'not exist'
  ];
  
  for (let indicator of notFoundIndicators) {
    if (whoisLower.includes(indicator)) {
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
              'YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YYYY', 'MM-DD-YYYY',
              'DD-MM-YYYY', 'DD-MMM-YYYY', 'YYYY/MM/DD', 'YYYY.MM.DD',
              'DD.MM.YYYY', 'MM.DD.YYYY', 'MMM DD, YYYY', 'DD MMM YYYY',
              'YYYY-MM-DDTHH:mm:ss', 'YYYY-MM-DD HH:mm:ss'
            ]);
            
            if (parsedDate.isValid()) {
              expiryDate = parsedDate.format('YYYY-MM-DD');
              break;
            }
          } catch (e) {
            // Continue to next pattern
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
      resolve(!err);
    });
  });
}

// Check domain info function
async function checkDomainInfo(domain) {
  const db = initDatabase();
  const hasDNS = await checkDNS(domain);
  
  return new Promise((resolve) => {
    whois.lookup(domain, async (err, data) => {
      if (err) {
        const finalStatus = hasDNS ? 'active' : 'error';
        const finalRegistrar = hasDNS ? 'Unknown (WHOIS unavailable)' : null;
        
        db.run('UPDATE domains SET status = ?, expiry_date = ?, registrar = ?, last_checked = ? WHERE domain = ?', 
          [finalStatus, null, finalRegistrar, new Date().toISOString(), domain]);
        resolve();
        return;
      }
      
      const { expiryDate, registrar, status } = parseWhoisData(data);
      
      let finalStatus = 'active';
      
      if (status === 'not_found' || status === 'no_data') {
        finalStatus = hasDNS ? 'active' : 'error';
      } else if (status) {
        finalStatus = status;
      } else if (expiryDate) {
        finalStatus = 'active';
      } else {
        finalStatus = hasDNS ? 'active' : 'error';
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
        () => resolve());
    });
  });
}

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const db = initDatabase();
  
  if (req.method === 'GET') {
    const { sort = 'expiry_date', order = 'ASC', type = 'all' } = req.query;
    
    let query = 'SELECT * FROM domains';
    let params = [];
    
    if (type !== 'all') {
      query += ' WHERE domain_type = ?';
      params.push(type);
    }
    
    if (sort === 'expiry_date') {
      query += ` ORDER BY 
        CASE WHEN expiry_date IS NULL THEN 1 ELSE 0 END,
        expiry_date ${order}`;
    } else if (sort === 'domain') {
      query += ` ORDER BY domain ${order}`;
    } else if (sort === 'status') {
      query += ` ORDER BY status ${order}, expiry_date ASC`;
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
  } else if (req.method === 'POST') {
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
        
        // Check domain info asynchronously
        checkDomainInfo(domain.toLowerCase()).catch(console.error);
        res.json({ id: this.lastID, domain, status: 'pending' });
      });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}; 