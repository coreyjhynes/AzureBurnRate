const App = (() => {
    const $ = id => document.getElementById(id);

    const els = {};
    let _warningFired = false;
    let _killFired = false;

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
        els.timerDisplay = $('timer-display');
        els.btnStart = $('btn-timer-start');
        els.btnPause = $('btn-timer-pause');
        els.btnReset = $('btn-timer-reset');
        els.speedSelect = $('speed-select');
        els.countdownWarning = $('countdown-warning');
        els.countdownKill = $('countdown-kill');
        els.simulatedSpend = $('simulated-spend');
        els.sidebar = $('messages-sidebar');
        els.btnClearMessages = $('btn-clear-messages');
        els.labEndedOverlay = $('lab-ended-overlay');
        els.btnLabReset = $('btn-lab-reset');
    }

    function setStatus(el, msg, type) {
        el.className = 'status-msg ' + (type || '');
        el.innerHTML = type === 'loading' ? '<span class="spinner"></span>' + msg : msg;
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
                // Re-apply UI state without recursive initApiKey call
                els.apiKeyInput.value = '************';
                els.apiKeyInput.disabled = true;
                els.saveKeyBtn.style.display = 'none';
                els.clearKeyBtn.style.display = '';
                els.testKeyBtn.style.display = '';
                els.analyzeBtn.disabled = false;
                setStatus(els.keyStatus, 'Key saved.', 'success');
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
                if (result.success) {
                    setStatus(els.keyStatus, result.message, 'success');
                } else {
                    setStatus(els.keyStatus, result.message, 'error');
                }
            } catch (e) {
                setStatus(els.keyStatus, 'Connection failed: ' + e.message, 'error');
            } finally {
                els.testKeyBtn.disabled = false;
            }
        });

        els.apiKeyInput.addEventListener('input', () => {
            els.analyzeBtn.disabled = !els.apiKeyInput.value.trim();
        });
    }

    // --- Thresholds ---
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
                setStatus(els.parseStatus, 'Found ' + resources.length + ' resource(s). Fetching pricing...', 'loading');

                const priced = await Pricing.lookupResources(resources);
                const estimated = await Pricing.estimateMissing(priced);

                Environment.setResources(estimated);
                setStatus(els.parseStatus, estimated.length + ' resource(s) loaded with pricing.', 'success');

                showDashboard();

                const rate = Calculator.burnRate(Environment.getResources());
                History.record(Timer.getElapsed(), rate, 'Initial deployment');

                refreshDashboard();
                Messages.add('info', 'Environment loaded', estimated.length + ' resources parsed from template.');
            } catch (e) {
                setStatus(els.parseStatus, 'Error: ' + e.message, 'error');
            } finally {
                els.analyzeBtn.disabled = false;
            }
        });
    }

    function showDashboard() {
        els.dashboard.style.display = '';
        els.sidebar.classList.add('visible');
        BurnChart.create('burn-chart');
    }

    // --- Dashboard Refresh ---
    function refreshDashboard() {
        const resources = Environment.getResources();
        const rate = Calculator.burnRate(resources);
        const warn = parseFloat(els.warningThreshold.value) || 0;
        const kill = parseFloat(els.killThreshold.value) || 0;
        const maxH = parseFloat(els.maxTime.value) || 720;
        const elapsedMs = Timer.getElapsed();

        // Cumulative spend from history segments (never decreases)
        const currentSpend = History.getSpendAt(elapsedMs);

        // Countdown based on cumulative spend
        const warnRemainingMs = _countdownFromSpend(rate, currentSpend, warn);
        const killRemainingMs = _countdownFromSpend(rate, currentSpend, kill);

        const ttw = warnRemainingMs / 3600000;
        const ttk = killRemainingMs / 3600000;

        els.burnRate.textContent = Calculator.formatRate(rate);
        els.timeToWarning.textContent = Calculator.formatHours(ttw);
        els.timeToKill.textContent = Calculator.formatHours(ttk);

        // Table
        els.resourceTableBody.innerHTML = '';
        for (const r of resources) {
            const tr = document.createElement('tr');
            const subtotal = r.quantity * r.hourlyRate;
            const estMark = r.estimated ? ' *' : '';
            tr.innerHTML =
                '<td>' + esc(r.name) + '</td>' +
                '<td>' + esc(r.type) + '</td>' +
                '<td>' + esc(r.sku) + '</td>' +
                '<td>' + esc(r.region) + '</td>' +
                '<td>' + r.quantity + '</td>' +
                '<td>$' + r.hourlyRate.toFixed(4) + estMark + '</td>' +
                '<td>$' + subtotal.toFixed(4) + '</td>';
            els.resourceTableBody.appendChild(tr);
        }

        // Chart: single update call with all data
        BurnChart.update(rate, maxH, warn, kill, elapsedMs, currentSpend);
    }

    // Returns remaining ms until spend reaches threshold from current spend at current rate
    function _countdownFromSpend(rate, currentSpend, threshold) {
        if (currentSpend >= threshold) return 0;
        if (rate <= 0) return Infinity;
        const remainingDollars = threshold - currentSpend;
        const remainingHours = remainingDollars / rate;
        return remainingHours * 3600000;
    }

    function esc(s) {
        const d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }

    // --- Timer ---
    function initTimer() {
        els.speedSelect.addEventListener('change', () => {
            const newSpeed = parseInt(els.speedSelect.value);
            Timer.setSpeed(newSpeed);
            Messages.add('info', 'Speed changed', 'Simulation now running at ' + newSpeed + 'x speed.');
        });

        els.btnStart.addEventListener('click', () => {
            Timer.start();
            Messages.add('info', 'Simulation started', 'Running at ' + Timer.getSpeed() + 'x speed.');
        });
        els.btnPause.addEventListener('click', () => {
            Timer.pause();
            Messages.add('info', 'Simulation paused', 'Elapsed: ' + Timer.formatElapsed());
        });
        els.btnReset.addEventListener('click', () => {
            _resetSimulation();
        });

        Timer.onStateChange(state => {
            els.btnStart.disabled = (state === 'running' || state === 'ended');
            els.btnPause.disabled = (state !== 'running');
            els.btnReset.disabled = (state === 'stopped');
        });

        // Tick handler
        Timer.onTick(elapsedMs => {
            els.timerDisplay.textContent = Timer.formatElapsed();

            const resources = Environment.getResources();
            if (resources.length === 0) return;

            const rate = Calculator.burnRate(resources);
            const warn = parseFloat(els.warningThreshold.value) || 0;
            const kill = parseFloat(els.killThreshold.value) || 0;

            // Cumulative spend from history segments (never decreases)
            const currentSpend = History.getSpendAt(elapsedMs);
            els.simulatedSpend.textContent = '$' + currentSpend.toFixed(2);

            // Countdowns based on remaining dollars at current rate
            const warnRemainingMs = _countdownFromSpend(rate, currentSpend, warn);
            const killRemainingMs = _countdownFromSpend(rate, currentSpend, kill);

            els.countdownWarning.textContent = Timer.formatCountdown(warnRemainingMs);
            els.countdownKill.textContent = Timer.formatCountdown(killRemainingMs);

            // Color coding
            els.countdownWarning.className = 'countdown-value' +
                (warnRemainingMs <= 0 ? ' countdown-critical' :
                 warnRemainingMs < 3600000 ? ' countdown-warning' : '');

            els.countdownKill.className = 'countdown-value countdown-danger' +
                (killRemainingMs <= 0 ? ' countdown-critical' :
                 killRemainingMs < 3600000 ? ' countdown-critical' : '');

            // Warning trigger
            if (warnRemainingMs <= 0 && !_warningFired) {
                _warningFired = true;
                const killTimeLeft = Timer.formatCountdown(killRemainingMs);
                const topResources = Environment.getResourcesByCost().slice(0, 3);

                let details = 'Current spend: $' + currentSpend.toFixed(2) + ' (Warning: $' + warn.toLocaleString() + ')\n';
                details += 'TIME REMAINING UNTIL LAB KILLED: ' + killTimeLeft + '\n\n';
                details += 'Delete these resources to create more time:\n';
                for (const r of topResources) {
                    const costPerHr = (r.quantity * r.hourlyRate);
                    const hoursGained = (kill - currentSpend) > 0 ? ((costPerHr / rate) * ((kill - currentSpend) / rate)).toFixed(1) : '0';
                    details += '  - ' + r.name + ' (' + r.sku + ') - saves $' + costPerHr.toFixed(2) + '/hr\n';
                }

                Messages.add('warning', 'WARNING: Spending threshold reached!', details);
                Messages.add('suggestion', 'Delete high-cost resources to extend lab time', 'Use Modify Environment below to remove resources.');
            }

            // Kill trigger
            if (killRemainingMs <= 0 && !_killFired) {
                _killFired = true;
                Timer.stop();
                Messages.add('danger', 'LAB ENDED - Kill threshold exceeded',
                    'Total simulated spend: $' + currentSpend.toFixed(2) + '\nKill threshold: $' + kill.toLocaleString());
                els.labEndedOverlay.style.display = '';
            }
        });
    }

    function _resetSimulation() {
        Timer.reset();
        _warningFired = false;
        _killFired = false;
        History.clear();
        Messages.clear();
        els.labEndedOverlay.style.display = 'none';
        Messages.add('info', 'Simulation reset', 'Timer and history cleared.');
        const rate = Calculator.burnRate(Environment.getResources());
        if (rate > 0) History.record(0, rate, 'Reset baseline');
        refreshDashboard();
    }

    // --- Messages Sidebar ---
    function initMessages() {
        Messages.init('#messages-list');
        els.btnClearMessages.addEventListener('click', () => Messages.clear());
    }

    // --- Lab Reset ---
    function initLabReset() {
        els.btnLabReset.addEventListener('click', () => _resetSimulation());
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

                const summary = ops.map(o => o.action + ': ' + o.name + (o.quantity ? ' x' + o.quantity : '')).join(', ');

                // Record new rate in history at current simulated time
                const rate = Calculator.burnRate(Environment.getResources());
                History.record(Timer.getElapsed(), rate, summary);

                // Log
                const li = document.createElement('li');
                const simTime = Timer.formatElapsed();
                li.innerHTML = '<span class="timestamp">[' + esc(simTime) + ']</span> ' + esc(desc) + ' &mdash; <em>' + esc(summary) + '</em>';
                els.changeLog.prepend(li);

                Messages.add('info', 'Environment updated', desc + '\nNew burn rate: ' + Calculator.formatRate(rate));

                setStatus(els.changeStatus, 'Changes applied.', 'success');
                els.changeInput.value = '';

                // Reset warning flag if we're now below warning again
                const warn = parseFloat(els.warningThreshold.value) || 0;
                const currentSpend = History.getSpendAt(Timer.getElapsed());
                const warnRemaining = _countdownFromSpend(rate, currentSpend, warn);
                if (warnRemaining > 0) _warningFired = false;

                refreshDashboard();
            } catch (e) {
                setStatus(els.changeStatus, 'Error: ' + e.message, 'error');
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
        initTimer();
        initMessages();
        initLabReset();
        initChanges();
    }

    document.addEventListener('DOMContentLoaded', init);

    return { refreshDashboard };
})();
