(function () {
    const targetSelector = '#gitZone';
    const dataUrl = '/data/github-calendar.json';
    const colors = ['#ebedf0', '#fdcdec', '#fc9bd9', '#fa6ac5', '#f838b2'];

    function ready(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn, { once: true });
        } else {
            fn();
        }
    }

    function ensureStyle() {
        if (document.getElementById('dat-github-calendar-style')) return;

        const style = document.createElement('style');
        style.id = 'dat-github-calendar-style';
        style.textContent = `
            .dat-github-calendar{width:100%;height:auto;padding:10px;overflow:hidden}
            .dat-github-calendar__head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;color:var(--font-color)}
            .dat-github-calendar__title{font-weight:700}
            .dat-github-calendar__meta{font-size:.9em;opacity:.72}
            .dat-github-calendar__scroll{max-width:100%;overflow-x:auto;padding-bottom:4px}
            .dat-github-calendar__grid{display:grid;grid-auto-flow:column;grid-auto-columns:11px;grid-template-rows:repeat(7,11px);gap:4px;min-height:101px}
            .dat-github-calendar__day{width:11px;height:11px;border-radius:2px;background:#ebedf0;outline:1px solid rgba(27,31,35,.04)}
            .dat-github-calendar__legend{display:flex;align-items:center;justify-content:flex-end;gap:4px;margin-top:8px;font-size:.82em;opacity:.72}
            .dat-github-calendar__legend .dat-github-calendar__day{display:inline-block}
            .dat-github-calendar__empty{min-height:120px;display:flex;align-items:center;justify-content:center;color:var(--font-color);opacity:.75}
            [data-theme='dark'] .dat-github-calendar__day{outline-color:rgba(255,255,255,.06)}
        `;
        document.head.appendChild(style);
    }

    function levelColor(level) {
        return colors[Math.max(0, Math.min(colors.length - 1, Number(level) || 0))];
    }

    function renderEmpty(zone, message) {
        zone.innerHTML = `<div class="recent-post-item dat-github-calendar" id="gitcalendarBar"><div class="dat-github-calendar__empty">${message}</div></div>`;
    }

    function renderCalendar(zone, data) {
        if (!Array.isArray(data.days) || data.days.length === 0) {
            renderEmpty(zone, 'GitHub 贡献数据暂时不可用');
            return;
        }

        const days = data.days.map((day) => {
            const count = Number(day.count) || 0;
            const title = `${day.date}: ${count} contribution${count === 1 ? '' : 's'}`;
            return `<span class="dat-github-calendar__day" title="${title}" aria-label="${title}" style="background:${levelColor(day.level)}"></span>`;
        }).join('');

        const legend = colors.map((color) => `<span class="dat-github-calendar__day" style="background:${color}"></span>`).join('');
        const fetchedAt = data.fetchedAt ? new Date(data.fetchedAt).toLocaleDateString('zh-CN') : '';
        const total = Number(data.total) || data.days.reduce((sum, day) => sum + (Number(day.count) || 0), 0);

        zone.innerHTML = `
            <div class="recent-post-item dat-github-calendar" id="gitcalendarBar">
                <div class="dat-github-calendar__head">
                    <div class="dat-github-calendar__title">GitHub Contributions</div>
                    <div class="dat-github-calendar__meta">${total} contributions${fetchedAt ? ` · ${fetchedAt}` : ''}</div>
                </div>
                <div class="dat-github-calendar__scroll">
                    <div class="dat-github-calendar__grid" role="img" aria-label="${data.username || 'GitHub'} contributions calendar">${days}</div>
                </div>
                <div class="dat-github-calendar__legend"><span>Less</span>${legend}<span>More</span></div>
            </div>
        `;
    }

    async function loadCalendar() {
        const zone = document.querySelector(targetSelector);
        if (!zone) return;

        if (zone.dataset.datGithubCalendarRendered === 'true') return;
        zone.dataset.datGithubCalendarRendered = 'true';
        ensureStyle();

        try {
            const response = await fetch(dataUrl, { cache: 'no-cache' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            renderCalendar(zone, await response.json());
        } catch (error) {
            renderEmpty(zone, 'GitHub 贡献数据暂时不可用');
        }
    }

    ready(loadCalendar);
    document.addEventListener('pjax:complete', loadCalendar);
})();
