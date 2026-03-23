const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const SKILLABLE_BASE = 'https://labondemand.com/api/v3';

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Proxy: test Skillable connection
app.post('/api/skillable/test', async (req, res) => {
    const apiKey = req.headers['x-skillable-key'];
    if (!apiKey) return res.status(400).json({ error: 'Missing x-skillable-key header' });

    try {
        const resp = await fetch(SKILLABLE_BASE + '/runningandsavedlabs', {
            headers: { 'api_key': apiKey }
        });
        if (!resp.ok) {
            const text = await resp.text();
            return res.status(resp.status).json({ error: 'Skillable API error: ' + resp.status, details: text });
        }
        const data = await resp.json();
        res.json({ success: true, message: 'Connected to Skillable API', labCount: Array.isArray(data) ? data.length : 0 });
    } catch (e) {
        res.status(500).json({ error: 'Failed to reach Skillable API: ' + e.message });
    }
});

// Proxy: get running and saved labs
app.get('/api/skillable/runningandsavedlabs', async (req, res) => {
    const apiKey = req.headers['x-skillable-key'];
    if (!apiKey) return res.status(400).json({ error: 'Missing x-skillable-key header' });

    try {
        const resp = await fetch(SKILLABLE_BASE + '/runningandsavedlabs', {
            headers: { 'api_key': apiKey }
        });
        if (!resp.ok) {
            const text = await resp.text();
            return res.status(resp.status).json({ error: 'Skillable API error: ' + resp.status, details: text });
        }
        const data = await resp.json();
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: 'Failed to reach Skillable API: ' + e.message });
    }
});

// Proxy: get lab instance details
app.get('/api/skillable/details/:id', async (req, res) => {
    const apiKey = req.headers['x-skillable-key'];
    if (!apiKey) return res.status(400).json({ error: 'Missing x-skillable-key header' });

    try {
        const resp = await fetch(SKILLABLE_BASE + '/details?labinstanceid=' + encodeURIComponent(req.params.id), {
            headers: { 'api_key': apiKey }
        });
        if (!resp.ok) {
            const text = await resp.text();
            return res.status(resp.status).json({ error: 'Skillable API error: ' + resp.status, details: text });
        }
        const data = await resp.json();
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: 'Failed to reach Skillable API: ' + e.message });
    }
});

app.listen(PORT, () => {
    console.log('Azure Burn Rate server running at http://localhost:' + PORT);
});
