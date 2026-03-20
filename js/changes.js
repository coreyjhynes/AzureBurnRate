const Changes = (() => {
    const SYSTEM_PROMPT = `You are an Azure environment change interpreter. You receive a description of the current simulated Azure environment and a user's change request in plain English.

Your job is to output a JSON array of change operations. Each operation is one of:
- {"action":"add","name":"...","type":"...","sku":"...","region":"...","quantity":N}
- {"action":"remove","name":"..."}
- {"action":"modify","name":"...","updates":{"quantity":N}} (or other fields to update)

Rules:
- Use ARM SKU names (e.g. "Standard_D4s_v3", "Standard_LRS")
- Default region to "eastus" if not specified
- If user says "add 3 VMs", create one add operation with quantity:3
- If user says "remove" something, match by name from the current environment
- Return ONLY the JSON array. No explanation, no markdown fencing.`;

    async function interpretChanges(changeDescription) {
        const currentEnv = Environment.toSummary();
        const userMessage = `Current environment:
${currentEnv || '(empty)'}

Change request: ${changeDescription}`;

        const response = await ApiKey.callClaude(SYSTEM_PROMPT, userMessage);
        const cleaned = response.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
        const operations = JSON.parse(cleaned);

        if (!Array.isArray(operations)) {
            throw new Error('Expected an array of change operations');
        }

        return operations;
    }

    async function applyChanges(operations) {
        const added = [];

        for (const op of operations) {
            switch (op.action) {
                case 'add':
                    const newRes = {
                        id: `res-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                        name: op.name,
                        type: op.type || 'Unknown',
                        sku: op.sku || 'Unknown',
                        region: (op.region || 'eastus').toLowerCase(),
                        quantity: Math.max(1, parseInt(op.quantity) || 1),
                        hourlyRate: 0
                    };
                    Environment.addResource(newRes);
                    added.push(newRes);
                    break;

                case 'remove':
                    const found = Environment.findByName(op.name);
                    if (found) Environment.removeResource(found.id);
                    break;

                case 'modify':
                    const target = Environment.findByName(op.name);
                    if (target && op.updates) {
                        Environment.updateResource(target.id, op.updates);
                    }
                    break;
            }
        }

        // Look up pricing for any newly added resources
        if (added.length > 0) {
            const priced = await Pricing.lookupResources(added);
            const estimated = await Pricing.estimateMissing(priced);
            for (const r of estimated) {
                Environment.updateResource(r.id, { hourlyRate: r.hourlyRate, estimated: r.estimated });
            }
        }

        return operations;
    }

    return { interpretChanges, applyChanges };
})();
