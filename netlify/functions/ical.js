const https = require('https');

const LOGEMENTS = {
  refuge:   'https://pms.rentalready.io/staffing/icalowner/a9ccc2f1-5152-44c6-9899-6d391a85f894/calendar.ics',
  studio:   'https://pms.rentalready.io/staffing/icalowner/106ce878-fa48-4064-a90e-67e063fd27c4/calendar.ics',
  cles:     'https://pms.rentalready.io/staffing/icalowner/153796ad-5388-4c7e-96af-ae7009515637/calendar.ics',
  escapade: 'https://pms.rentalready.io/staffing/icalowner/e9fb76b6-46ce-4d22-8cd6-69e9535ab694/calendar.ics',
  secret:   'https://pms.rentalready.io/staffing/icalowner/fa548063-20c2-4dc9-aa39-b25e3a561b3c/calendar.ics',
  patio:    'https://pms.rentalready.io/staffing/icalowner/70efc820-ea01-473c-bdf8-37403d0df27f/calendar.ics',
};

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function parseIcal(icsData) {
  const events = [];
  const lines = icsData.replace(/\r\n /g, '').split(/\r?\n/);
  let current = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = {};
    } else if (line === 'END:VEVENT' && current) {
      if (current.start && current.end) events.push(current);
      current = null;
    } else if (current) {
      if (line.startsWith('DTSTART')) {
        current.start = line.split(/[:;]/)[1]?.substring(0, 8);
      } else if (line.startsWith('DTEND')) {
        current.end = line.split(/[:;]/)[1]?.substring(0, 8);
      } else if (line.startsWith('SUMMARY')) {
        current.summary = line.split(':').slice(1).join(':');
      }
    }
  }
  return events;
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=300',
  };

  const id = event.queryStringParameters?.id || '';

  // Retourner tous les logements
  if (id === 'all') {
    try {
      const results = {};
      await Promise.all(
        Object.entries(LOGEMENTS).map(async ([key, url]) => {
          try {
            const ics = await fetchUrl(url);
            results[key] = parseIcal(ics);
          } catch (e) {
            console.error(`Erreur ${key}:`, e.message);
            results[key] = [];
          }
        })
      );
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(results),
      };
    } catch (err) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: err.message }),
      };
    }
  }

  // Retourner un logement spécifique
  if (!LOGEMENTS[id]) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: `Logement inconnu: ${id}` }),
    };
  }

  try {
    const ics = await fetchUrl(LOGEMENTS[id]);
    const events = parseIcal(ics);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(events),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
