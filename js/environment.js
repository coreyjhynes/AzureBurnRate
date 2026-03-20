const Environment = (() => {
    let resources = [];

    function getResources() {
        return [...resources];
    }

    function setResources(list) {
        resources = list.map(r => ({ ...r }));
    }

    function addResource(resource) {
        resource.id = resource.id || `res-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        resources.push({ ...resource });
    }

    function removeResource(id) {
        resources = resources.filter(r => r.id !== id);
    }

    function updateResource(id, updates) {
        const idx = resources.findIndex(r => r.id === id);
        if (idx !== -1) {
            resources[idx] = { ...resources[idx], ...updates };
        }
    }

    function findByName(name) {
        return resources.find(r => r.name.toLowerCase() === name.toLowerCase());
    }

    function clear() {
        resources = [];
    }

    function toSummary() {
        return resources.map(r =>
            `${r.name}: ${r.quantity}x ${r.sku} ${r.type} in ${r.region} ($${r.hourlyRate.toFixed(4)}/hr each)`
        ).join('\n');
    }

    return { getResources, setResources, addResource, removeResource, updateResource, findByName, clear, toSummary };
})();
