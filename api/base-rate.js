// Vercel Serverless Function — GET /api/base-rate
// Returns the current Bank of England Bank Rate (base rate).
// Public data, no API key required. Source: Bank of England IADB
// (series IUDBEDR — Bank Rate). Docs: https://www.bankofengland.co.uk/boeapps/database

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const url =
    'https://www.bankofengland.co.uk/boeapps/database/_iadb-fromshowcolumns.asp' +
    '?csv.x=yes&Datefrom=01/Jan/2020&Dateto=now&SeriesCodes=IUDBEDR' +
    '&CSVF=TN&UsingCodes=Y&VPD=Y&VFD=N';

  try {
    const upstream = await fetch(url);
    if (!upstream.ok) throw new Error('Upstream status ' + upstream.status);
    const text = await upstream.text();

    const lines = text.trim().split('\n').filter(Boolean);
    if (lines.length < 2) throw new Error('Unexpected response shape');

    const lastLine = lines[lines.length - 1].replace(/"/g, '');
    const [date, rateStr] = lastLine.split(',');
    const rate = parseFloat(rateStr);

    if (isNaN(rate)) throw new Error('Could not parse rate');

    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
    res.status(200).json({
      rate,
      date: date.trim(),
      unit: '%',
      label: 'Bank of England Bank Rate',
      source: 'https://www.bankofengland.co.uk/boeapps/database (series IUDBEDR)',
    });
  } catch (err) {
    res.status(502).json({ error: 'Could not fetch the Bank of England base rate right now.' });
  }
};
