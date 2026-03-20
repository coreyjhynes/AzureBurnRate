const Parser = (() => {
    const SYSTEM_PROMPT = `You are an Azure ARM/Bicep template parser. Your job is to analyze ARM JSON templates or Bicep code and extract a list of deployed resources.

For each resource, extract:
- name: the resource name (from the template)
- type: the Azure service type (e.g. "Virtual Machines", "Storage Accounts", "SQL Database")
- sku: the SKU or VM size (e.g. "Standard_D4s_v3", "Standard_LRS", "S1"). Use the ARM SKU name format.
- region: the Azure region (e.g. "eastus", "westus2"). If the template uses a parameter, default to "eastus".
- quantity: number of instances (usually 1 unless a copy loop is used)

Return ONLY a valid JSON array. No explanation, no markdown fencing. Example:
[{"name":"myVM","type":"Virtual Machines","sku":"Standard_D4s_v3","region":"eastus","quantity":2}]

If the template uses parameters with defaults, use the default values. If no default, make a reasonable assumption and note it in the name field like "myVM (assumed Standard_D2s_v3)".`;

    async function parseTemplate(templateText) {
        const response = await ApiKey.callClaude(SYSTEM_PROMPT, templateText);
        // Strip any markdown fencing Claude might add despite instructions
        const cleaned = response.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
        const resources = JSON.parse(cleaned);

        if (!Array.isArray(resources)) {
            throw new Error('Expected an array of resources from Claude');
        }

        // Validate and normalize each resource
        return resources.map((r, i) => ({
            id: `res-${Date.now()}-${i}`,
            name: r.name || `resource-${i}`,
            type: r.type || 'Unknown',
            sku: r.sku || 'Unknown',
            region: (r.region || 'eastus').toLowerCase(),
            quantity: Math.max(1, parseInt(r.quantity) || 1),
            hourlyRate: 0
        }));
    }

    return { parseTemplate };
})();
