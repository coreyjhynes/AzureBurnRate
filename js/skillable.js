const Skillable = (() => {
    const SETTINGS_KEY = 'azure-burn-rate-settings';

    function _loadSettings() {
        try {
            const raw = localStorage.getItem(SETTINGS_KEY);
            if (raw) return JSON.parse(raw);
        } catch (e) { /* ignore */ }
        return {};
    }

    function _saveSettings(s) {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    }

    function getApiKey() {
        return _loadSettings().skillableApiKey || '';
    }

    function saveApiKey(key) {
        key = (key || '').trim();
        if (!key) throw new Error('Skillable API key cannot be empty');
        const s = _loadSettings();
        s.skillableApiKey = key;
        _saveSettings(s);
    }

    function clearApiKey() {
        const s = _loadSettings();
        s.skillableApiKey = '';
        _saveSettings(s);
    }

    function isKeySet() {
        return !!getApiKey();
    }

    async function _parseJsonOrError(resp) {
        const text = await resp.text();
        if (text.trimStart().startsWith('<')) {
            throw new Error('Skillable API requires the local server. Run "npm start" and use http://localhost:3000');
        }
        return JSON.parse(text);
    }

    async function testConnection() {
        const key = getApiKey();
        if (!key) return { success: false, message: 'No Skillable API key configured.' };

        try {
            const resp = await fetch('/api/skillable/test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-skillable-key': key
                }
            });
            const data = await _parseJsonOrError(resp);
            if (resp.ok && data.success) {
                return { success: true, message: data.message + ' (' + data.labCount + ' labs found)' };
            }
            return { success: false, message: data.error || 'Connection failed' };
        } catch (e) {
            return { success: false, message: e.message };
        }
    }

    async function getRunningLabs() {
        const key = getApiKey();
        if (!key) throw new Error('No Skillable API key configured');

        const resp = await fetch('/api/skillable/runningandsavedlabs', {
            headers: { 'x-skillable-key': key }
        });
        const data = await _parseJsonOrError(resp);
        if (!resp.ok) {
            throw new Error(data.error || 'API error ' + resp.status);
        }
        return data;
    }

    async function getLabDetails(labInstanceId) {
        const key = getApiKey();
        if (!key) throw new Error('No Skillable API key configured');

        const resp = await fetch('/api/skillable/details/' + encodeURIComponent(labInstanceId), {
            headers: { 'x-skillable-key': key }
        });
        const data = await _parseJsonOrError(resp);
        if (!resp.ok) {
            throw new Error(data.error || 'API error ' + resp.status);
        }
        return data;
    }

    // Send or update a notification in a running lab instance.
    // If name is provided, subsequent calls with the same name update the notification.
    // Send name with empty notification to delete it.
    async function sendNotification(labInstanceId, notification, name) {
        const key = getApiKey();
        if (!key) throw new Error('No Skillable API key configured');

        const body = { labInstanceId };
        if (notification) body.notification = notification;
        if (name) body.name = name;

        const resp = await fetch('/api/skillable/notification', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-skillable-key': key
            },
            body: JSON.stringify(body)
        });
        const data = await _parseJsonOrError(resp);
        if (!resp.ok) {
            throw new Error(data.error || 'Notification failed: ' + resp.status);
        }
        return data;
    }

    const CLOUD_PROVIDERS = { 10: 'Azure', 11: 'AWS' };

    function cloudProviderName(id) {
        return CLOUD_PROVIDERS[id] || 'Unknown (' + id + ')';
    }

    function formatEpoch(epoch) {
        if (!epoch) return '--';
        const d = new Date(epoch * 1000);
        return d.toLocaleString();
    }

    return {
        getApiKey, saveApiKey, clearApiKey, isKeySet,
        testConnection, getRunningLabs, getLabDetails, sendNotification,
        cloudProviderName, formatEpoch
    };
})();
