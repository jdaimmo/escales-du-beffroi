// Netlify Function — proxy iCal
// Récupère les flux iCal RentalReady et les expose sans CORS

const ICAL_URLS = {
  refuge:   "https://pms.rentalready.io/staffing/icalowner/a9ccc2f1-5152-44c6-9899-6d391a85f894/calendar.ics",
  studio:   "https://pms.rentalready.io/staffing/icalowner/106ce878-fa48-4064-a90e-67e063fd27c4/calendar.ics",
  cles:     "https://pms.rentalready.io/staffing/icalowner/153796ad-5388-4c7e-96af-ae7009515637/calendar.ics",
  escapade: "https://pms.rentalready.io/staffing/icalowner/e9fb76b6-46ce-4d22-8cd6-69e9535ab694/calendar.ics",
  secret:   "https://pms.rentalready.io/staffing/icalowner/fa548063-20c2-4dc9-aa39-b25e3a561b3c/calendar.ics",
  patio:    "https://pms.rentalready.io/staffing/icalowner/70efc820-ea01-473c-bdf8-37403d0df27f/calendar.ics",
};

exports.handler = async (event) => {
  const logement = event.queryStringParameters?.logement;

  if (!logement || !ICAL_URLS[logement]) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Logement inconnu. Paramètre valide : " + Object.keys(ICAL_URLS).join(", ") }),
    };
  }

  try {
    const response = await fetch(ICAL_URLS[logement]);
    if (!response.ok) throw new Error(`Erreur HTTP ${response.status}`);
    const icsText = await response.text();

    // Parser les événements VEVENT du fichier iCal
    const events = [];
    const lines = icsText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

    let inEvent = false;
    let current = {};

    for (const line of lines) {
      if (line === "BEGIN:VEVENT") { inEvent = true; current = {}; continue; }
      if (line === "END:VEVENT") {
        if (current.start && current.end) events.push(current);
        inEvent = false; continue;
      }
      if (!inEvent) continue;

      if (line.startsWith("DTSTART")) {
        current.start = parseIcalDate(line.split(":")[1]);
      } else if (line.startsWith("DTEND")) {
        current.end = parseIcalDate(line.split(":")[1]);
      } else if (line.startsWith("SUMMARY")) {
        current.summary = line.split(":").slice(1).join(":").trim();
      } else if (line.startsWith("UID")) {
        current.uid = line.split(":").slice(1).join(":").trim();
      }
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=300", // Cache 5 min
      },
      body: JSON.stringify({ logement, events }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};

function parseIcalDate(raw) {
  // Format YYYYMMDD ou YYYYMMDDTHHmmssZ
  if (!raw) return null;
  const d = raw.replace(/[TZ]/g, "");
  return `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`;
}
