const ApiKey = (() => {
    const STORAGE_KEY = 'azure-burn-rate-api-key';

    function sanitize(key) {
        // Strip non-ASCII characters (fetch headers require ISO-8859-1)
        return key.replace(/[^\x20-\x7E]/g, '').trim();
    }

    function get() {
        return sanitize(localStorage.getItem(STORAGE_KEY) || '');
    }

    function save(key) {
        key = sanitize(key);
        if (!key) throw new Error('API key cannot be empty');
        if (!/^sk-ant-/.test(key)) throw new Error('Key must start with sk-ant-');
        localStorage.setItem(STORAGE_KEY, key);
    }

    function clear() {
        localStorage.removeItem(STORAGE_KEY);
    }

    function isSet() {
        return !!get();
    }

    async function callClaude(systemPrompt, userMessage) {
        const key = get();
        if (!key) throw new Error('No API key configured');

        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': key,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-6-20250514',
                max_tokens: 4096,
                system: systemPrompt,
                messages: [{ role: 'user', content: userMessage }]
            })
        });

        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error?.message || `API error ${res.status}`);
        }

        const data = await res.json();
        return data.content[0].text;
    }

    async function testConnection() {
        const key = get();
        if (!key) throw new Error('No API key configured');

        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': key,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-6-20250514',
                max_tokens: 16,
                messages: [{ role: 'user', content: 'Reply with only: OK' }]
            })
        });

        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error?.message || `API error ${res.status}`);
        }

        const data = await res.json();
        return { success: true, model: data.model, reply: data.content[0].text };
    }

    return { get, save, clear, isSet, callClaude, testConnection };
})();
