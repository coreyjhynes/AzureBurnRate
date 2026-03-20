const App = (() => {
    // DOM references
    const $ = id => document.getElementById(id);

    const els = {};
    function cacheDom() {
        els.apiKeyInput = $('api-key-input');
        els.saveKeyBtn = $('save-key-btn');
        els.clearKeyBtn = $('clear-key-btn');
        els.testKeyBtn = $('test-key-btn');
        els.keyStatus = $('key-status');
        els.warningThreshold = $('warning-threshold');
        els.killThreshold = $('kill-threshold');
        els.maxTime = $('max-time');
        els.templateInput = $('template-input');
        els.analyzeBtn = $('analyze-btn');
        els.parseStatus = $('parse-status');
        els.dashboard = $('dashboard-section');
        els.burnRate = $('burn-rate');
        els.timeToWarning = $('time-to-warning');
        els.timeToKill = $('time-to-kill');
        els.resourceTableBody = document.querySelector('#resource-table tbody');
        els.changeInput = $('change-input');
        els.applyChangeBtn = $('apply-change-btn');
        els.changeStatus = $('change-status');
        els.changeLog = $('change-log');
    }

    // --- Status helpers ---
    function setStatus(el, msg, type) {
        el.className = `status-msg ${type || ''}`;
        el.innerHTML = type === 'loading' ? `<span class="spinner"></span>${msg}` : msg;
    }

    // --- API Key ---
    function initApiKey() {
        if (ApiKey.isSet()) {
            els.apiKeyInput.value = '************';
            els.apiKeyInput.disabled = true;
            els.saveKeyBtn.style.display = 'none';
            els.clearKeyBtn.style.display = '';
            els.testKeyBtn.style.display = '';
            els.analyzeBtn.disabled = false;
            setStatus(els.keyStatus, 'Key saved.', 'success');
        }

        els.saveKeyBtn.addEventListener('click', () => {
            try {
                ApiKey.save(els.apiKeyInput.value);
                initApiKey();
            } catch (e) {
                setStatus(els.keyStatus, e.message, 'error');
            }
        });

        els.clearKeyBtn.addEventListener('click', () => {
            ApiKey.clear();
            els.apiKeyInput.value = '';
            els.apiKeyInput.disabled = false;
            els.saveKeyBtn.style.display = '';
            els.clearKeyBtn.style.display = 'none';
            els.testKeyBtn.style.display = 'none';
            els.analyzeBtn.disabled = true;
            setStatus(els.keyStatus, 'Key cleared.', '');
        });

        els.testKeyBtn.addEventListener('click', async () => {
            els.testKeyBtn.disabled = true;
            setStatus(els.keyStatus, 'Testing connection...', 'loading');
            try {
                const result = await ApiKey.testConnection();
                setStatus(els.keyStatus, `Connected - model: ${result.model}`, 'success');
            } catch (e) {
                setStatus(els.keyStatus, `Connection failed: ${e.message}`, 'error');
            } finally {
                els.testKeyBtn.disabled = false;
            }
        });

        els.apiKeyInput.addEventListener('input', () => {
            els.analyzeBtn.disabled = !els.apiKeyInput.value.trim();
        });
    }

    // --- Threshold listeners ---
    function initThresholds() {
        const refresh = () => {
            if (Environment.getResources().length > 0) refreshDashboard();
        };
        els.warningThreshold.addEventListener('change', refresh);
        els.killThreshold.addEventListener('change', refresh);
        els.maxTime.addEventListener('change', refresh);
    }

    // --- Template Analysis ---
    function initAnalyze() {
        els.analyzeBtn.addEventListener('click', async () => {
            const text = els.templateInput.value.trim();
            if (!text) return;

            els.analyzeBtn.disabled = true;
            setStatus(els.parseStatus, 'Parsing template with Claude...', 'loading');

            try {
                const resources = await Parser.parseTemplate(text);
                setStatus(els.parseStatus, `Found ${resources.length} resource(s). Fetching pricing...`, 'loading');

                const priced = await Pricing.lookupResources(resources);
                const estimated = await Pricing.estimateMissing(priced);

                Environment.setResources(estimated);
                setStatus(els.parseStatus, `${estimated.length} resource(s) loaded with pricing.`, 'success');

                els.dashboard.style.display = '';
                BurnChart.create('burn-chart');
                refreshDashboard();
            } catch (e) {
                setStatus(els.parseStatus, `Error: ${e.message}`, 'error');
            } finally {
                els.analyzeBtn.disabled = false;
            }
        });
    }

    // --- Dashboard Refresh ---
    function refreshDashboard() {
        const resources = Environment.getResources();
        const rate = Calculator.burnRate(resources);
        const warn = parseFloat(els.warningThreshold.value) || 0;
        const kill = parseFloat(els.killThreshold.value) || 0;
        const maxH = parseFloat(els.maxTime.value) || 720;

        const ttw = Calculator.timeToThreshold(rate, warn);
        const ttk = Calculator.timeToThreshold(rate, kill);

        els.burnRate.textContent = Calculator.formatRate(rate);
        els.timeToWarning.textContent = Calculator.formatHours(ttw);
        els.timeToKill.textContent = Calculator.formatHours(ttk);

        // Table
        els.resourceTableBody.innerHTML = '';
        for (const r of resources) {
            const tr = document.createElement('tr');
            const subtotal = r.quantity * r.hourlyRate;
            const estMark = r.estimated ? ' *' : '';
            tr.innerHTML = `
                <td>${esc(r.name)}</td>
                <td>${esc(r.type)}</td>
                <td>${esc(r.sku)}</td>
                <td>${esc(r.region)}</td>
                <td>${r.quantity}</td>
                <td>$${r.hourlyRate.toFixed(4)}${estMark}</td>
                <td>$${subtotal.toFixed(4)}</td>`;
            els.resourceTableBody.appendChild(tr);
        }

        // Chart
        BurnChart.update(rate, maxH, warn, kill);
    }

    function esc(s) {
        const d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }

    // --- Changes ---
    function initChanges() {
        els.applyChangeBtn.addEventListener('click', async () => {
            const desc = els.changeInput.value.trim();
            if (!desc) return;

            els.applyChangeBtn.disabled = true;
            setStatus(els.changeStatus, 'Interpreting changes with Claude...', 'loading');

            try {
                const ops = await Changes.interpretChanges(desc);
                setStatus(els.changeStatus, 'Applying changes and fetching pricing...', 'loading');
                await Changes.applyChanges(ops);

                // Log
                const li = document.createElement('li');
                const time = new Date().toLocaleTimeString();
                const summary = ops.map(o => `${o.action}: ${o.name}${o.quantity ? ` x${o.quantity}` : ''}`).join(', ');
                li.innerHTML = `<span class="timestamp">${time}</span>${esc(desc)} &mdash; <em>${esc(summary)}</em>`;
                els.changeLog.prepend(li);

                setStatus(els.changeStatus, 'Changes applied.', 'success');
                els.changeInput.value = '';
                refreshDashboard();
            } catch (e) {
                setStatus(els.changeStatus, `Error: ${e.message}`, 'error');
            } finally {
                els.applyChangeBtn.disabled = false;
            }
        });
    }

    // --- Init ---
    function init() {
        cacheDom();
        initApiKey();
        initThresholds();
        initAnalyze();
        initChanges();
    }

    document.addEventListener('DOMContentLoaded', init);

    return { refreshDashboard };
})();
