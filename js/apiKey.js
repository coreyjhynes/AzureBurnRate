const ApiKey = (() => {
    const STORAGE_KEY = 'azure-burn-rate-api-key';

    function sanitize(key) {
        // Keep only printable ASCII (0x21-0x7E) — no spaces, no control chars, no unicode
        return String(key || '').split('').filter(c => {
            const code = c.charCodeAt(0);
            return code >= 0x21 && code <= 0x7E;
        }).join('');
    }

    function get() {
        return sanitize(localStorage.getItem(STORAGE_KEY));
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

    async function apiFetch(body) {
        const key = get();
        if (!key) throw new Error('No API key configured');

        // Build headers with a plain Headers object to catch encoding issues early
        const headers = new Headers();
        headers.set('Content-Type', 'application/json');
        headers.set('anthropic-version', '2023-06-01');
        headers.set('anthropic-dangerous-direct-browser-access', 'true');
        headers.set('x-api-key', key);

        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error?.message || 'API error ' + res.status);
        }

        return res.json();
    }

    async function callClaude(systemPrompt, userMessage) {
        const data = await apiFetch({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 4096,
            system: systemPrompt,
            messages: [{ role: 'user', content: userMessage }]
        });
        return data.content[0].text;
    }

    async function testConnection() {
        const data = await apiFetch({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 16,
            messages: [{ role: 'user', content: 'Reply with only: OK' }]
        });
        return { success: true, model: data.model, reply: data.content[0].text };
    }

    return { get, save, clear, isSet, callClaude, testConnection };
})();
