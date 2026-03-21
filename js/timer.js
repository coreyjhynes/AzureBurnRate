const Timer = (() => {
    let _elapsed = 0;          // simulated milliseconds
    let _intervalId = null;
    let _speed = 10;           // 10x real time
    let _state = 'stopped';    // stopped | running | paused | ended
    const _tickListeners = [];
    const _stateListeners = [];

    const TICK_MS = 100;       // real-time interval

    function start() {
        if (_state === 'ended') return;
        if (_state === 'running') return;
        _state = 'running';
        _fireState();
        _intervalId = setInterval(() => {
            _elapsed += TICK_MS * _speed;
            for (const cb of _tickListeners) cb(_elapsed);
        }, TICK_MS);
    }

    function pause() {
        if (_state !== 'running') return;
        clearInterval(_intervalId);
        _intervalId = null;
        _state = 'paused';
        _fireState();
    }

    function reset() {
        clearInterval(_intervalId);
        _intervalId = null;
        _elapsed = 0;
        _state = 'stopped';
        _fireState();
        for (const cb of _tickListeners) cb(_elapsed);
    }

    function stop() {
        clearInterval(_intervalId);
        _intervalId = null;
        _state = 'ended';
        _fireState();
    }

    function getElapsed() { return _elapsed; }
    function getState() { return _state; }
    function getSpeed() { return _speed; }

    function onTick(cb) { _tickListeners.push(cb); }
    function onStateChange(cb) { _stateListeners.push(cb); }

    function _fireState() {
        for (const cb of _stateListeners) cb(_state);
    }

    function formatElapsed(ms) {
        ms = ms !== undefined ? ms : _elapsed;
        const totalSec = Math.floor(ms / 1000);
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        return String(h).padStart(2, '0') + 'h ' +
               String(m).padStart(2, '0') + 'm ' +
               String(s).padStart(2, '0') + 's';
    }

    function formatCountdown(ms) {
        if (!isFinite(ms) || ms <= 0) return '00h 00m 00s';
        return formatElapsed(ms);
    }

    return {
        start, pause, reset, stop,
        getElapsed, getState, getSpeed,
        onTick, onStateChange,
        formatElapsed, formatCountdown
    };
})();
