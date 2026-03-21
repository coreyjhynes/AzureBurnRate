const History = (() => {
    let _events = [];

    function record(simulatedTimeMs, burnRate, label) {
        _events.push({
            simulatedTimeMs,
            burnRatePerHour: burnRate,
            label,
            timestamp: new Date()
        });
    }

    function getEvents() {
        return [..._events];
    }

    // Returns [{x: hours, y: burnRate}] for Chart.js stepped line
    function getDataPoints() {
        return _events.map(e => ({
            x: e.simulatedTimeMs / 3600000,   // ms to hours
            y: e.burnRatePerHour
        }));
    }

    // Returns Chart.js annotation objects for event vertical lines
    function getAnnotations() {
        const annotations = {};
        _events.forEach((e, i) => {
            const xVal = e.simulatedTimeMs / 3600000;
            annotations['event_' + i] = {
                type: 'line',
                xMin: xVal,
                xMax: xVal,
                borderColor: 'rgba(139,92,246,0.6)',
                borderWidth: 1,
                borderDash: [4, 4],
                label: {
                    display: true,
                    content: e.label,
                    position: 'start',
                    backgroundColor: 'rgba(139,92,246,0.75)',
                    color: '#fff',
                    font: { size: 9 },
                    rotation: -90,
                    yAdjust: -40
                }
            };
        });
        return annotations;
    }

    function clear() {
        _events = [];
    }

    return { record, getEvents, getDataPoints, getAnnotations, clear };
})();
