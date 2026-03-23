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
            const data = await resp.json();
            if (resp.ok && data.success) {
                return { success: true, message: data.message + ' (' + data.labCount + ' labs found)' };
            }
            return { success: false, message: data.error || 'Connection failed' };
        } catch (e) {
            return { success: false, message: 'Connection failed: ' + e.message };
        }
    }

    async function getRunningLabs() {
        const key = getApiKey();
        if (!key) throw new Error('No Skillable API key configured');

        const resp = await fetch('/api/skillable/runningandsavedlabs', {
            headers: { 'x-skillable-key': key }
        });
        if (!resp.ok) {
            const data = await resp.json().catch(() => ({}));
            throw new Error(data.error || 'API error ' + resp.status);
        }
        return resp.json();
    }

    async function getLabDetails(labInstanceId) {
        const key = getApiKey();
        if (!key) throw new Error('No Skillable API key configured');

        const resp = await fetch('/api/skillable/details/' + encodeURIComponent(labInstanceId), {
            headers: { 'x-skillable-key': key }
        });
        if (!resp.ok) {
            const data = await resp.json().catch(() => ({}));
            throw new Error(data.error || 'API error ' + resp.status);
        }
        return resp.json();
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
        testConnection, getRunningLabs, getLabDetails,
        cloudProviderName, formatEpoch
    };
})();
