const Navigation = (() => {
    let _pages = [];
    let _tabs = [];
    let _currentPage = 'estimator';

    function init() {
        _pages = document.querySelectorAll('.page-content');
        _tabs = document.querySelectorAll('.nav-tab');

        _tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                showPage(tab.dataset.page);
            });
        });
    }

    function showPage(pageId) {
        _currentPage = pageId;

        _pages.forEach(p => {
            p.style.display = p.id === 'page-' + pageId ? '' : 'none';
        });

        _tabs.forEach(t => {
            if (t.dataset.page === pageId) {
                t.classList.add('active');
            } else {
                t.classList.remove('active');
            }
        });

        // Hide sidebar on non-estimator pages unless dashboard is visible
        const sidebar = document.getElementById('messages-sidebar');
        if (sidebar) {
            if (pageId === 'estimator') {
                const dash = document.getElementById('dashboard-section');
                if (dash && dash.style.display !== 'none') {
                    sidebar.classList.add('visible');
                }
            } else {
                sidebar.classList.remove('visible');
            }
        }
    }

    function getCurrentPage() {
        return _currentPage;
    }

    return { init, showPage, getCurrentPage };
})();
