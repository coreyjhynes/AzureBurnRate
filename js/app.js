const App = (() => {
    // DOM references
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
        // Timer
        els.timerDisplay = $('timer-display');
        els.btnStart = $('btn-timer-start');
        els.btnPause = $('btn-timer-pause');
        els.btnReset = $('btn-timer-reset');
        // Countdowns
        els.countdownWarning = $('countdown-warning');
        els.countdownKill = $('countdown-kill');
        els.simulatedSpend = $('simulated-spend');
        // Sidebar
        els.sidebar = $('messages-sidebar');
        els.btnClearMessages = $('btn-clear-messages');
        // Overlay
        els.labEndedOverlay = $('lab-ended-overlay');
        els.btnLabReset = $('btn-lab-reset');
    }

    // --- Status helpers ---
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
                setStatus(els.parseStatus, 'Found ' + resources.length + ' resource(s). Fetching pricing...', 'loading');

                const priced = await Pricing.lookupResources(resources);
                const estimated = await Pricing.estimateMissing(priced);

                Environment.setResources(estimated);
                setStatus(els.parseStatus, estimated.length + ' resource(s) loaded with pricing.', 'success');

                showDashboard();

                // Record initial state in history
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

    // --- Show Dashboard + Sidebar ---
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

        // Chart — update projection + historical
        BurnChart.update(rate, maxH, warn, kill);
        BurnChart.updateWithHistory(History.getDataPoints(), History.getAnnotations());
    }

    function esc(s) {
        const d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }

    // --- Timer ---
    function initTimer() {
        els.btnStart.addEventListener('click', () => {
            Timer.start();
            Messages.add('info', 'Simulation started', 'Running at ' + Timer.getSpeed() + 'x speed.');
        });
        els.btnPause.addEventListener('click', () => {
            Timer.pause();
            Messages.add('info', 'Simulation paused', 'Elapsed: ' + Timer.formatElapsed());
        });
        els.btnReset.addEventListener('click', () => {
            Timer.reset();
            _warningFired = false;
            _killFired = false;
            History.clear();
            Messages.clear();
            els.labEndedOverlay.style.display = 'none';
            Messages.add('info', 'Simulation reset', 'Timer and history cleared.');
            // Re-record current state
            const rate = Calculator.burnRate(Environment.getResources());
            if (rate > 0) History.record(0, rate, 'Reset baseline');
            refreshDashboard();
        });

        // Timer state changes update button states
        Timer.onStateChange(state => {
            els.btnStart.disabled = (state === 'running' || state === 'ended');
            els.btnPause.disabled = (state !== 'running');
            els.btnReset.disabled = (state === 'stopped');
        });

        // Tick handler — updates display, countdowns, triggers warnings
        Timer.onTick(elapsedMs => {
            // Update timer display
            els.timerDisplay.textContent = Timer.formatElapsed();

            const resources = Environment.getResources();
            if (resources.length === 0) return;

            const rate = Calculator.burnRate(resources);
            const warn = parseFloat(els.warningThreshold.value) || 0;
            const kill = parseFloat(els.killThreshold.value) || 0;

            // Simulated spend
            const elapsedHours = elapsedMs / 3600000;
            const currentSpend = rate * elapsedHours;
            els.simulatedSpend.textContent = '$' + currentSpend.toFixed(2);

            // Countdowns
            const warnRemainingMs = Calculator.countdownRemainingMs(rate, elapsedMs, warn);
            const killRemainingMs = Calculator.countdownRemainingMs(rate, elapsedMs, kill);

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
                let suggestions = 'Time remaining until kill: ' + killTimeLeft + '\n\n';
                suggestions += 'Consider deleting these high-cost resources:\n';
                for (const r of topResources) {
                    suggestions += '  - ' + r.name + ' (' + r.type + ') - saves $' + (r.quantity * r.hourlyRate).toFixed(2) + '/hr\n';
                }
                Messages.add('warning', 'WARNING: Spending threshold exceeded!', suggestions);
                Messages.add('suggestion', 'Suggestion: Delete resources to extend lab time', 'Use the Modify Environment section to remove high-cost resources.');
            }

            // Kill trigger
            if (killRemainingMs <= 0 && !_killFired) {
                _killFired = true;
                Timer.stop();
                Messages.add('danger', 'LAB ENDED - Kill threshold exceeded', 'Total simulated spend: $' + currentSpend.toFixed(2));
                els.labEndedOverlay.style.display = '';
            }
        });
    }

    // --- Messages Sidebar ---
    function initMessages() {
        Messages.init('#messages-list');
        els.btnClearMessages.addEventListener('click', () => Messages.clear());
    }

    // --- Lab Reset ---
    function initLabReset() {
        els.btnLabReset.addEventListener('click', () => {
            els.labEndedOverlay.style.display = 'none';
            Timer.reset();
            _warningFired = false;
            _killFired = false;
            History.clear();
            Messages.clear();
            const rate = Calculator.burnRate(Environment.getResources());
            if (rate > 0) History.record(0, rate, 'Reset baseline');
            Messages.add('info', 'Simulation reset', 'Ready to restart.');
            refreshDashboard();
        });
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

                // Build label for history
                const summary = ops.map(o => o.action + ': ' + o.name + (o.quantity ? ' x' + o.quantity : '')).join(', ');

                // Record in history
                const rate = Calculator.burnRate(Environment.getResources());
                History.record(Timer.getElapsed(), rate, summary);

                // Log to change log
                const li = document.createElement('li');
                const simTime = Timer.formatElapsed();
                li.innerHTML = '<span class="timestamp">[' + esc(simTime) + ']</span> ' + esc(desc) + ' &mdash; <em>' + esc(summary) + '</em>';
                els.changeLog.prepend(li);

                // Message
                Messages.add('info', 'Environment updated', desc + '\nNew burn rate: ' + Calculator.formatRate(rate));

                setStatus(els.changeStatus, 'Changes applied.', 'success');
                els.changeInput.value = '';

                // Reset warning/kill if thresholds are now OK
                const warn = parseFloat(els.warningThreshold.value) || 0;
                const warnRemaining = Calculator.countdownRemainingMs(rate, Timer.getElapsed(), warn);
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
