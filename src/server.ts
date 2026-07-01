import express from 'express';
import dotenv from 'dotenv';

// Load .env.local first (used for local secrets), then fallback to default .env
dotenv.config({ path: '.env.local' });
dotenv.config();

const app = express();
app.use(express.json());

const MAILCHIMP_API_KEY = process.env.MAILCHIMP_API_KEY;
const MAILCHIMP_LIST_ID = process.env.MAILCHIMP_LIST_ID;

if (!MAILCHIMP_API_KEY || !MAILCHIMP_LIST_ID) {
  console.warn('Mailchimp API key or List ID is not configured. /api/subscribe will fail until configured.');
}

// Debug: show whether env vars are visible (masked)
console.log('MAILCHIMP_API_KEY present:', !!MAILCHIMP_API_KEY, 'MAILCHIMP_LIST_ID present:', !!MAILCHIMP_LIST_ID);
if (MAILCHIMP_API_KEY) console.log('MAILCHIMP_API_KEY (masked):', MAILCHIMP_API_KEY.slice(0,6) + '...' + MAILCHIMP_API_KEY.slice(-4));
if (MAILCHIMP_LIST_ID) console.log('MAILCHIMP_LIST_ID:', MAILCHIMP_LIST_ID);

const getMailchimpServer = (apiKey: string) => {
  const match = apiKey.match(/-([a-z0-9]+)$/i);
  return match ? match[1] : 'us1';
};

app.post('/api/subscribe', async (req, res) => {
  if (!MAILCHIMP_API_KEY || !MAILCHIMP_LIST_ID) {
    return res.status(500).json({ error: 'Mailchimp configuration is missing.' });
  }

  const { email, marketplace } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'A valid email address is required.' });
  }

  const data = {
    email_address: email,
    status: 'subscribed',
    merge_fields: {
      MARKETPLACE: marketplace || 'Other'
    }
  };

  const server = getMailchimpServer(MAILCHIMP_API_KEY);
  const url = `https://${server}.api.mailchimp.com/3.0/lists/${MAILCHIMP_LIST_ID}/members`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `apikey ${MAILCHIMP_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();
    if (!response.ok) {
      const errorMessage = result.detail || 'Subscription failed.';
      return res.status(400).json({ error: errorMessage });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Mailchimp subscribe error:', error);
    return res.status(500).json({ error: 'Unable to subscribe at this time.' });
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Mailchimp subscription server running on http://localhost:${port}`);
});