const ApiKey = (() => {
    const STORAGE_KEY = 'azure-burn-rate-api-key';

    function sanitize(key) {
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

    // Use XMLHttpRequest to avoid fetch's strict ISO-8859-1 header validation
    function apiFetch(body) {
        const key = get();
        if (!key) return Promise.reject(new Error('No API key configured'));

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', 'https://api.anthropic.com/v1/messages');
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.setRequestHeader('anthropic-version', '2023-06-01');
            xhr.setRequestHeader('anthropic-dangerous-direct-browser-access', 'true');
            xhr.setRequestHeader('x-api-key', key);

            xhr.onload = function () {
                try {
                    const data = JSON.parse(xhr.responseText);
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve(data);
                    } else {
                        reject(new Error(data.error?.message || 'API error ' + xhr.status));
                    }
                } catch (e) {
                    reject(new Error('Failed to parse API response'));
                }
            };

            xhr.onerror = function () {
                reject(new Error('Network error - check your connection and CORS'));
            };

            xhr.send(JSON.stringify(body));
        });
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
