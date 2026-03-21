const History = (() => {
    let _events = [];

    // Record a change event. Automatically computes cumulative spend
    // based on previous segments so spend NEVER decreases.
    function record(simulatedTimeMs, burnRatePerHour, label) {
        let cumulativeSpend = 0;

        if (_events.length > 0) {
            const prev = _events[_events.length - 1];
            const deltaHours = (simulatedTimeMs - prev.simulatedTimeMs) / 3600000;
            cumulativeSpend = prev.cumulativeSpend + (prev.burnRatePerHour * Math.max(0, deltaHours));
        }

        _events.push({
            simulatedTimeMs,
            burnRatePerHour,
            cumulativeSpend,
            label,
            timestamp: new Date()
        });
    }

    function getEvents() {
        return [..._events];
    }

    // Get cumulative spend at any point in simulated time.
    // Uses segments so spend only ever increases.
    function getSpendAt(elapsedMs) {
        if (_events.length === 0) return 0;

        // Find the last event at or before elapsedMs
        let lastEvent = _events[0];
        for (const e of _events) {
            if (e.simulatedTimeMs <= elapsedMs) lastEvent = e;
            else break;
        }

        const deltaHours = (elapsedMs - lastEvent.simulatedTimeMs) / 3600000;
        return lastEvent.cumulativeSpend + (lastEvent.burnRatePerHour * Math.max(0, deltaHours));
    }

    // Returns [{x: hours, y: cumulativeSpend}] for Chart.js actual spend line
    function getSpendDataPoints() {
        return _events.map(e => ({
            x: e.simulatedTimeMs / 3600000,
            y: e.cumulativeSpend
        }));
    }

    // Returns [{x: hours, y: burnRate}] for Chart.js burn rate stepped line
    function getBurnRateDataPoints() {
        return _events.map(e => ({
            x: e.simulatedTimeMs / 3600000,
            y: e.burnRatePerHour
        }));
    }

    // Returns Chart.js annotation objects for event vertical lines
    function getAnnotations() {
        const annotations = {};
        _events.forEach((e, i) => {
            if (i === 0) return;  // skip initial deployment annotation
            const xVal = e.simulatedTimeMs / 3600000;
            annotations['event_' + i] = {
                type: 'line',
                scaleID: 'x',
                value: xVal,
                borderColor: 'rgba(139,92,246,0.6)',
                borderWidth: 1,
                borderDash: [4, 4],
                label: {
                    display: true,
                    content: e.label,
                    position: 'start',
                    backgroundColor: 'rgba(139,92,246,0.75)',
                    color: '#fff',
                    font: { size: 9 }
                }
            };
        });
        return annotations;
    }

    function getCurrentRate() {
        if (_events.length === 0) return 0;
        return _events[_events.length - 1].burnRatePerHour;
    }

    function clear() {
        _events = [];
    }

    return { record, getEvents, getSpendAt, getSpendDataPoints, getBurnRateDataPoints, getAnnotations, getCurrentRate, clear };
})();
