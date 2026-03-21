const Messages = (() => {
    let _container = null;
    let _messages = [];
    let _idCounter = 0;

    function init(containerSelector) {
        _container = document.querySelector(containerSelector);
    }

    function add(type, text, details) {
        const msg = {
            id: ++_idCounter,
            type,        // info | warning | danger | suggestion
            text,
            details: details || '',
            timestamp: new Date()
        };
        _messages.push(msg);
        _render(msg);
        return msg.id;
    }

    function _render(msg) {
        if (!_container) return;
        const div = document.createElement('div');
        div.className = 'message-item ' + msg.type;
        div.dataset.msgId = msg.id;

        const timeStr = msg.timestamp.toLocaleTimeString();
        let html = '<div class="message-time">' + _esc(timeStr) + '</div>';
        html += '<div class="message-text">' + _esc(msg.text) + '</div>';
        if (msg.details) {
            html += '<div class="message-details">' + _esc(msg.details) + '</div>';
        }
        div.innerHTML = html;

        _container.appendChild(div);
        _container.scrollTop = _container.scrollHeight;
    }

    function clear() {
        _messages = [];
        if (_container) _container.innerHTML = '';
    }

    function getAll() {
        return [..._messages];
    }

    function _esc(s) {
        const d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }

    return { init, add, clear, getAll };
})();
