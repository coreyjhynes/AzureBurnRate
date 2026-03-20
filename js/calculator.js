const Calculator = (() => {

    function burnRate(resources) {
        return resources.reduce((sum, r) => sum + (r.quantity * r.hourlyRate), 0);
    }

    function timeToThreshold(rate, thresholdDollars) {
        if (rate <= 0) return Infinity;
        return thresholdDollars / rate; // hours
    }

    function formatHours(hours) {
        if (!isFinite(hours)) return '--';
        if (hours < 1) return `${Math.round(hours * 60)}m`;
        if (hours < 48) return `${hours.toFixed(1)}h`;
        const days = hours / 24;
        if (days < 60) return `${days.toFixed(1)}d`;
        return `${(days / 30).toFixed(1)}mo`;
    }

    function formatRate(rate) {
        if (rate < 0.01) return `$${rate.toFixed(4)}/hr`;
        return `$${rate.toFixed(2)}/hr`;
    }

    function projectedSpend(rate, maxHours, pointCount) {
        pointCount = pointCount || 50;
        const step = maxHours / pointCount;
        const points = [];
        for (let h = 0; h <= maxHours; h += step) {
            points.push({ hours: h, spend: rate * h });
        }
        return points;
    }

    return { burnRate, timeToThreshold, formatHours, formatRate, projectedSpend };
})();
