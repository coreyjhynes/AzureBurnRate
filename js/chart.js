const BurnChart = (() => {
    let chart = null;

    function create(canvasId) {
        if (chart) chart.destroy();
        const ctx = document.getElementById(canvasId).getContext('2d');
        chart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [
                    {
                        label: 'Actual Spend ($)',
                        data: [],
                        borderColor: '#22d3ee',
                        backgroundColor: 'rgba(34,211,238,0.15)',
                        fill: true,
                        tension: 0,
                        pointRadius: 3,
                        pointBackgroundColor: '#22d3ee',
                        borderWidth: 2
                    },
                    {
                        label: 'Projected Spend ($)',
                        data: [],
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59,130,246,0.08)',
                        fill: true,
                        tension: 0.1,
                        pointRadius: 0,
                        borderDash: [6, 4],
                        borderWidth: 2
                    },
                    {
                        label: 'Burn Rate ($/hr)',
                        data: [],
                        borderColor: '#a78bfa',
                        fill: false,
                        stepped: 'before',
                        pointRadius: 3,
                        pointBackgroundColor: '#a78bfa',
                        borderWidth: 2,
                        yAxisID: 'yRate'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { intersect: false, mode: 'nearest' },
                scales: {
                    x: {
                        type: 'linear',
                        title: { display: true, text: 'Simulated Hours', color: '#8b8fa3' },
                        ticks: {
                            color: '#8b8fa3',
                            callback: function(v) {
                                if (v < 48) return v + 'h';
                                return Math.round(v / 24) + 'd';
                            }
                        },
                        grid: { color: '#2a2d3a' },
                        min: 0
                    },
                    y: {
                        title: { display: true, text: 'Cumulative Spend ($)', color: '#8b8fa3' },
                        ticks: { color: '#8b8fa3', callback: v => '$' + v.toLocaleString() },
                        grid: { color: '#2a2d3a' },
                        beginAtZero: true,
                        position: 'left'
                    },
                    yRate: {
                        title: { display: true, text: 'Burn Rate ($/hr)', color: '#a78bfa' },
                        ticks: { color: '#a78bfa', callback: v => '$' + v.toFixed(2) },
                        grid: { drawOnChartArea: false },
                        beginAtZero: true,
                        position: 'right',
                        display: false
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

    // Full update: projection from elapsed time forward, thresholds, history
    function update(currentRate, maxHours, warningThreshold, killThreshold, elapsedMs, currentSpend) {
        if (!chart) return;

        elapsedMs = elapsedMs || 0;
        currentSpend = currentSpend || 0;
        const elapsedHours = elapsedMs / 3600000;

        // --- Dataset 0: Actual Spend (from history) ---
        const spendPoints = History.getSpendDataPoints();
        // Add current point
        const actualData = [...spendPoints];
        if (elapsedMs > 0 || actualData.length > 0) {
            actualData.push({ x: elapsedHours, y: currentSpend });
        }
        chart.data.datasets[0].data = actualData;

        // --- Dataset 1: Projected Spend (from now forward to max time window) ---
        const projPoints = [];
        const projCount = 50;
        const projMaxHours = maxHours;
        const projStep = (projMaxHours - elapsedHours) / projCount;
        for (let i = 0; i <= projCount; i++) {
            const h = elapsedHours + (projStep * i);
            const spend = currentSpend + currentRate * (h - elapsedHours);
            projPoints.push({ x: h, y: spend });
        }
        chart.data.datasets[1].data = projPoints;

        // --- Dataset 2: Burn Rate (from history) ---
        const ratePoints = History.getBurnRateDataPoints();
        if (ratePoints.length > 0) {
            // Extend last rate to current time
            const rateData = [...ratePoints];
            rateData.push({ x: elapsedHours, y: currentRate });
            chart.data.datasets[2].data = rateData;
            chart.options.scales.yRate.display = true;
        }

        // --- X-axis range: fixed to max lab duration ---
        chart.options.scales.x.max = maxHours;

        // --- Y-axis range ---
        const maxProjectedSpend = currentSpend + currentRate * (maxHours - elapsedHours);
        const maxY = Math.max(maxProjectedSpend, killThreshold * 1.2, warningThreshold * 1.5);
        chart.options.scales.y.max = maxY;

        // --- Annotations: thresholds + events ---
        const eventAnnotations = History.getAnnotations();
        chart.options.plugins.annotation.annotations = {
            ...eventAnnotations,
            warningLine: {
                type: 'line',
                yMin: warningThreshold,
                yMax: warningThreshold,
                borderColor: '#f59e0b',
                borderWidth: 2,
                borderDash: [6, 4],
                label: {
                    display: true,
                    content: 'Warning: $' + warningThreshold.toLocaleString(),
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
                    content: 'Kill (DECO): $' + killThreshold.toLocaleString(),
                    position: 'start',
                    backgroundColor: 'rgba(239,68,68,0.8)',
                    color: '#fff',
                    font: { size: 11 }
                }
            },
            nowLine: elapsedMs > 0 ? {
                type: 'line',
                scaleID: 'x',
                value: elapsedHours,
                borderColor: 'rgba(255,255,255,0.3)',
                borderWidth: 1,
                borderDash: [3, 3],
                label: {
                    display: true,
                    content: 'Now',
                    position: 'start',
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    color: '#fff',
                    font: { size: 10 }
                }
            } : undefined
        };

        chart.update('none');  // 'none' disables animation to prevent stack issues
    }

    function destroy() {
        if (chart) {
            chart.destroy();
            chart = null;
        }
    }

    return { create, update, destroy };
})();
