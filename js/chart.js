const BurnChart = (() => {
    let chart = null;

    function create(canvasId) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Projected Spend ($)',
                    data: [],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59,130,246,0.1)',
                    fill: true,
                    tension: 0.1,
                    pointRadius: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { intersect: false, mode: 'index' },
                scales: {
                    x: {
                        title: { display: true, text: 'Hours', color: '#8b8fa3' },
                        ticks: { color: '#8b8fa3' },
                        grid: { color: '#2a2d3a' }
                    },
                    y: {
                        title: { display: true, text: 'Cumulative Spend ($)', color: '#8b8fa3' },
                        ticks: { color: '#8b8fa3', callback: v => '$' + v.toLocaleString() },
                        grid: { color: '#2a2d3a' },
                        beginAtZero: true
                    }
                },
                plugins: {
                    legend: { labels: { color: '#e1e4ed' } },
                    annotation: { annotations: {} }
                }
            }
        });
        return chart;
    }

    function update(rate, maxHours, warningThreshold, killThreshold) {
        if (!chart) return;

        const points = Calculator.projectedSpend(rate, maxHours);
        chart.data.labels = points.map(p => {
            if (p.hours < 48) return `${p.hours.toFixed(0)}h`;
            return `${(p.hours / 24).toFixed(0)}d`;
        });
        chart.data.datasets[0].data = points.map(p => p.spend);

        // Max Y should show at least the kill threshold
        const maxSpend = Math.max(rate * maxHours, killThreshold * 1.2);
        chart.options.scales.y.max = maxSpend;

        // Threshold annotations
        chart.options.plugins.annotation.annotations = {
            warningLine: {
                type: 'line',
                yMin: warningThreshold,
                yMax: warningThreshold,
                borderColor: '#f59e0b',
                borderWidth: 2,
                borderDash: [6, 4],
                label: {
                    display: true,
                    content: `Warning: $${warningThreshold.toLocaleString()}`,
                    position: 'start',
                    backgroundColor: 'rgba(245,158,11,0.8)',
                    color: '#fff',
                    font: { size: 11 }
                }
            },
            killLine: {
                type: 'line',
                yMin: killThreshold,
                yMax: killThreshold,
                borderColor: '#ef4444',
                borderWidth: 2,
                borderDash: [6, 4],
                label: {
                    display: true,
                    content: `Kill (DECO): $${killThreshold.toLocaleString()}`,
                    position: 'start',
                    backgroundColor: 'rgba(239,68,68,0.8)',
                    color: '#fff',
                    font: { size: 11 }
                }
            }
        };

        chart.update();
    }

    function destroy() {
        if (chart) {
            chart.destroy();
            chart = null;
        }
    }

    return { create, update, destroy };
})();
