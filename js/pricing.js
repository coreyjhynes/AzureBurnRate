const Pricing = (() => {
    const cache = new Map();
    const API_BASE = 'https://prices.azure.com/api/retail/prices';

    function cacheKey(serviceName, skuName, region) {
        return `${serviceName}|${skuName}|${region}`.toLowerCase();
    }

    async function fetchPrice(serviceName, skuName, region) {
        const key = cacheKey(serviceName, skuName, region);
        if (cache.has(key)) return cache.get(key);

        const filters = [
            `armRegionName eq '${region}'`,
            `armSkuName eq '${skuName}'`,
            `priceType eq 'Consumption'`
        ];

        const url = `${API_BASE}?$filter=${encodeURIComponent(filters.join(' and '))}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Azure Pricing API error: ${res.status}`);

        const data = await res.json();
        const items = data.Items || [];

        // Find best match — prefer per-hour retail price
        let hourlyRate = 0;
        if (items.length > 0) {
            // Look for a direct hourly rate first
            const hourItem = items.find(i => i.unitOfMeasure === '1 Hour');
            if (hourItem) {
                hourlyRate = hourItem.retailPrice;
            } else {
                // Convert monthly to hourly (730 hours/month)
                const monthItem = items.find(i => i.unitOfMeasure === '1/Month' || i.unitOfMeasure.includes('Month'));
                if (monthItem) {
                    hourlyRate = monthItem.retailPrice / 730;
                } else if (items[0]) {
                    // Fallback — use first item as-is with note
                    hourlyRate = items[0].retailPrice;
                }
            }
        }

        cache.set(key, hourlyRate);
        return hourlyRate;
    }

    async function lookupResources(resources) {
        const results = [];
        for (const r of resources) {
            try {
                const rate = await fetchPrice(r.type, r.sku, r.region);
                results.push({ ...r, hourlyRate: rate });
            } catch (e) {
                console.warn(`Pricing lookup failed for ${r.name}: ${e.message}`);
                results.push({ ...r, hourlyRate: 0 });
            }
        }
        return results;
    }

    // Bulk lookup via Claude when Azure API returns 0 — ask Claude for estimates
    async function estimateMissing(resources) {
        const missing = resources.filter(r => r.hourlyRate === 0);
        if (missing.length === 0) return resources;

        const prompt = `You are an Azure pricing expert. For each resource below, estimate the approximate per-hour cost in USD based on current Azure pay-as-you-go retail pricing. Return ONLY a JSON array of objects with "name" and "hourlyRate" fields. No explanation.

Resources:
${JSON.stringify(missing.map(r => ({ name: r.name, type: r.type, sku: r.sku, region: r.region })), null, 2)}`;

        try {
            const response = await ApiKey.callClaude(
                'You estimate Azure resource pricing. Return only valid JSON arrays.',
                prompt
            );
            const estimates = JSON.parse(response.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
            const estimateMap = new Map(estimates.map(e => [e.name, e.hourlyRate]));

            return resources.map(r => {
                if (r.hourlyRate === 0 && estimateMap.has(r.name)) {
                    return { ...r, hourlyRate: estimateMap.get(r.name), estimated: true };
                }
                return r;
            });
        } catch (e) {
            console.warn('Claude pricing estimation failed:', e.message);
            return resources;
        }
    }

    function clearCache() {
        cache.clear();
    }

    return { fetchPrice, lookupResources, estimateMissing, clearCache };
})();
