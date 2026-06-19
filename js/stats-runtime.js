(function () {
    const endpoint = '/api/stats';
    const visitorStorageKey = 'dat_stats_visitor_id';
    const counters = {
        site_uv: '#busuanzi_value_site_uv',
        site_pv: '#busuanzi_value_site_pv',
        page_pv: '#busuanzi_value_page_pv'
    };

    let lastRecordedPath = '';
    let runToken = 0;

    function ready(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn, { once: true });
        } else {
            fn();
        }
    }

    function createVisitorId() {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            return window.crypto.randomUUID();
        }

        return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    }

    function readVisitorId() {
        try {
            const existing = localStorage.getItem(visitorStorageKey);
            if (existing) return existing;

            const next = createVisitorId();
            localStorage.setItem(visitorStorageKey, next);
            return next;
        } catch (err) {
            return createVisitorId();
        }
    }

    function currentPath() {
        return window.location.pathname || '/';
    }

    function setCounter(selector, value) {
        const target = document.querySelector(selector);
        if (!target || value === undefined || value === null) return;
        target.textContent = String(value);
    }

    function updateCounters(payload) {
        Object.keys(counters).forEach((key) => {
            setCounter(counters[key], payload[key]);
        });
    }

    function recordVisit() {
        const path = currentPath();
        if (path === lastRecordedPath) return;

        lastRecordedPath = path;
        const token = ++runToken;

        fetch(endpoint, {
            method: 'POST',
            headers: {
                accept: 'application/json',
                'content-type': 'application/json'
            },
            cache: 'no-store',
            credentials: 'same-origin',
            body: JSON.stringify({
                path,
                visitorId: readVisitorId()
            })
        })
            .then((response) => {
                if (!response.ok) throw new Error('stats_unavailable');
                return response.json();
            })
            .then((payload) => {
                if (token === runToken && currentPath() === path) updateCounters(payload);
            })
            .catch(() => {
                // The fallback runtime will replace stale loading placeholders.
            });
    }

    ready(recordVisit);
    document.addEventListener('pjax:complete', recordVisit);
})();
