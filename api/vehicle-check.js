// Vercel Serverless Function — POST /api/vehicle-check
// Body: { "registrationNumber": "AB12CDE" }
//
// Proxies the DVLA Vehicle Enquiry Service (VES) API so the API key never
// reaches the browser. Returns real UK vehicle data: make, colour, year,
// fuel type, tax status/due date, and MOT status/expiry.
//
// SETUP (one-time, free):
//   1. Register at https://register-for-dvla-electronic-services.dvla.gov.uk
//      (or apply via https://developer-portal.driver-vehicle-licensing.api.gov.uk)
//      for the "Vehicle Enquiry Service" API — approval is usually quick.
//   2. In your Vercel project: Settings -> Environment Variables ->
//      add DVLA_API_KEY = <the key DVLA emails you>. Redeploy.
//   3. Done — this endpoint starts returning real data automatically.
//
// Until DVLA_API_KEY is set, this returns a clear 501 so the front-end can
// show a "not configured yet" message instead of a confusing failure.

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Use POST with { registrationNumber }' });
    return;
  }

  const apiKey = process.env.DVLA_API_KEY;
  if (!apiKey) {
    res.status(501).json({
      notConfigured: true,
      error: 'DVLA_API_KEY is not set yet. See api/vehicle-check.js for the free 2-step setup.',
    });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  const reg = (body && body.registrationNumber || '').toUpperCase().replace(/\s+/g, '');

  if (!reg || reg.length > 8) {
    res.status(400).json({ error: 'Please provide a valid UK registration number.' });
    return;
  }

  try {
    const upstream = await fetch(
      'https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles',
      {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ registrationNumber: reg }),
      }
    );

    const data = await upstream.json();

    if (!upstream.ok) {
      const message =
        upstream.status === 404
          ? 'No vehicle found for that registration number.'
          : (data && data.errors && data.errors[0] && data.errors[0].detail) ||
            'DVLA could not process that request.';
      res.status(upstream.status === 404 ? 404 : 502).json({ error: message });
      return;
    }

    res.status(200).json({
      registrationNumber: data.registrationNumber,
      make: data.make,
      colour: data.colour,
      fuelType: data.fuelType,
      yearOfManufacture: data.yearOfManufacture,
      engineCapacity: data.engineCapacity,
      co2Emissions: data.co2Emissions,
      taxStatus: data.taxStatus,
      taxDueDate: data.taxDueDate,
      motStatus: data.motStatus,
      motExpiryDate: data.motExpiryDate,
      markedForExport: data.markedForExport,
      wheelplan: data.wheelplan,
      typeApproval: data.typeApproval,
    });
  } catch (err) {
    res.status(502).json({ error: 'Could not reach the DVLA service right now — try again shortly.' });
  }
};
