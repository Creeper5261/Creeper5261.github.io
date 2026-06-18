(function () {
    const services = window.DAT_PUBLIC_SERVICES || {};
    const fallbackClass = 'dat-service-fallback';

    function ready(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn, { once: true });
        } else {
            fn();
        }
    }

    function ensureStyle() {
        if (document.getElementById('dat-service-fallback-style')) return;

        const style = document.createElement('style');
        style.id = 'dat-service-fallback-style';
        style.textContent = `
            .${fallbackClass}{border-radius:8px;padding:12px 14px;text-align:center;color:var(--font-color);background:rgba(127,127,127,.08);line-height:1.8}
            .${fallbackClass} .dat-fallback-title{font-weight:700;color:var(--theme-color);margin-bottom:2px}
            .${fallbackClass} .dat-fallback-note{font-size:.92em;opacity:.82}
            .dat-clock-fallback{min-height:120px;display:flex;flex-direction:column;align-items:center;justify-content:center}
            .dat-clock-time{font-size:2rem;font-weight:700;color:var(--theme-color);line-height:1.2}
        `;
        document.head.appendChild(style);
    }

    function fallbackHtml(title, note) {
        return `<div class="${fallbackClass}"><div class="dat-fallback-title">${title}</div><div class="dat-fallback-note">${note}</div></div>`;
    }

    function hasSpinner(element) {
        return !!element && !!element.querySelector('.fa-spinner,.loading,#card-clock-loading,#git_loading');
    }

    function hasRealText(element) {
        return !!element && element.textContent.replace(/\s+/g, '').length > 0;
    }

    function fillWelcome() {
        const target = document.querySelector('#welcome-info');
        if (!target || hasRealText(target)) return;

        const hour = new Date().getHours();
        const greeting = hour >= 5 && hour < 11 ? '上午好' : hour >= 11 && hour < 19 ? '下午好' : '晚上好';
        target.innerHTML = `<b><center>🎉 欢迎信息 🎉</center>&emsp;&emsp;<span>${greeting}</span>，欢迎回家。定位服务暂时不可用，先在这里歇一会儿。</b>`;
    }

    function fillCounters() {
        ['#busuanzi_value_site_uv', '#busuanzi_value_site_pv'].forEach((selector) => {
            const target = document.querySelector(selector);
            if (!target) return;

            const value = target.textContent.trim();
            if (!value || hasSpinner(target)) target.textContent = '--';
        });
    }

    function fillClock() {
        const card = document.querySelector('.card-clock');
        const target = document.querySelector('#hexo_electric_clock');
        if (!card || !target) return;

        const hasRenderedClock = target.children.length > 1 || (hasRealText(target) && !hasSpinner(target));
        if (hasRenderedClock) return;

        const now = new Date();
        const time = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        const note = (services.qweatherKey && (services.gaudMapKey || services.baiduMapAk))
            ? '天气时钟脚本暂时不可用'
            : '天气服务待配置';

        target.innerHTML = `<div class="${fallbackClass} dat-clock-fallback"><div class="dat-clock-time">${time}</div><div class="dat-fallback-note">${note}</div></div>`;
    }

    function fillTwikoo() {
        const target = document.querySelector('#twikoo-wrap');
        if (!target) return;

        const hasCommentUi = target.children.length > 0 || hasRealText(target);
        if (hasCommentUi) return;

        const note = (services.giscusRepo && services.giscusRepoId && services.giscusCategory && services.giscusCategoryId)
            ? 'Giscus 暂时未加载'
            : 'Giscus 待配置';
        target.innerHTML = fallbackHtml('评论', note);
    }

    function fillGitCalendar() {
        const zone = document.querySelector('#gitZone');
        if (!zone) return;

        const localCalendar = zone.querySelector('.dat-github-calendar');
        if (localCalendar || zone.dataset.datGithubCalendarRendered === 'true') return;

        const container = zone.querySelector('#git_container');
        const hasCalendar = container && container.children.length > 0 && getComputedStyle(container).display !== 'none';
        if (hasCalendar) return;

        zone.innerHTML = `<div class="recent-post-item" id="gitcalendarBar" style="width:100%;height:auto;padding:10px;">${fallbackHtml('Git 日历', 'GitHub 贡献数据暂时不可用')}</div>`;
    }

    function runSoon() {
        ensureStyle();
        setTimeout(fillWelcome, 3000);
        setTimeout(fillCounters, 8000);
        setTimeout(fillClock, 8000);
        setTimeout(fillTwikoo, 10000);
        setTimeout(fillGitCalendar, 10000);
    }

    ready(runSoon);
    document.addEventListener('pjax:complete', runSoon);
})();
