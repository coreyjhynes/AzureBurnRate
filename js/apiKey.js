const ApiKey = (() => {
    const STORAGE_KEY = 'azure-burn-rate-settings';

    function _loadSettings() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) return JSON.parse(raw);
        } catch (e) {
            console.error('Failed to load settings:', e);
        }
        return { apiKey: '' };
    }

    function _saveSettings(s) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
        } catch (e) {
            console.error('Failed to save settings:', e);
        }
    }

    function get() {
        return _loadSettings().apiKey || '';
    }

    function save(key) {
        key = (key || '').trim();
        if (!key) throw new Error('API key cannot be empty');
        const s = _loadSettings();
        s.apiKey = key;
        _saveSettings(s);
    }

    function clear() {
        const s = _loadSettings();
        s.apiKey = '';
        _saveSettings(s);
    }

    function isSet() {
        return !!get();
    }

    function _getProviderConfig() {
        const key = get();
        if (!key) return null;
        return {
            url: 'https://api.anthropic.com/v1/messages',
            model: 'claude-sonnet-4-20250514',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': key,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true',
            }
        };
    }

    async function callClaude(systemPrompt, userMessage) {
        const config = _getProviderConfig();
        if (!config) throw new Error('No API key configured');

        const resp = await fetch(config.url, {
            method: 'POST',
            headers: config.headers,
            body: JSON.stringify({
                model: config.model,
                max_tokens: 8192,
                system: systemPrompt,
                messages: [{ role: 'user', content: userMessage }],
            }),
        });

        if (!resp.ok) {
            const errText = await resp.text();
            console.error('AI API error:', resp.status, errText);
            throw new Error('API error ' + resp.status);
        }

        const data = await resp.json();
        return data.content?.[0]?.text || null;
    }

    async function testConnection() {
        const config = _getProviderConfig();
        if (!config) return { success: false, message: 'No API key configured.' };

        const result = await callClaude(
            'You are a test assistant. Respond with exactly: CONNECTION_OK',
            'Test connection. Reply with CONNECTION_OK.'
        );

        if (result && result.includes('CONNECTION_OK')) {
            return { success: true, model: config.model, message: 'Connected to ' + config.model };
        } else if (result) {
            return { success: true, model: config.model, message: 'Connected - got response from ' + config.model };
        }
        return { success: false, message: 'Connection failed. Check your API key.' };
    }

    return { get, save, clear, isSet, callClaude, testConnection };
})();
