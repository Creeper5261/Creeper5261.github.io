(function () {
    const services = window.DAT_PUBLIC_SERVICES || {};
    const targetSelector = '#twikoo-wrap';

    function ready(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn, { once: true });
        } else {
            fn();
        }
    }

    function ensureStyle() {
        if (document.getElementById('dat-comments-runtime-style')) return;

        const style = document.createElement('style');
        style.id = 'dat-comments-runtime-style';
        style.textContent = `
            .dat-comments-status{border-radius:8px;padding:14px 16px;text-align:center;color:var(--font-color);background:rgba(127,127,127,.08);line-height:1.8}
            .dat-comments-status strong{color:var(--theme-color)}
            .dat-comments-status a{color:var(--theme-color)}
        `;
        document.head.appendChild(style);
    }

    function configuredForGiscus() {
        return Boolean(
            services.giscusRepo &&
            services.giscusRepoId &&
            services.giscusCategory &&
            services.giscusCategoryId
        );
    }

    function renderStatus(target, message) {
        ensureStyle();
        target.innerHTML = `<div class="dat-comments-status"><strong>评论</strong><br>${message}</div>`;
    }

    function currentTheme() {
        return document.documentElement.getAttribute('data-theme') === 'dark'
            ? 'dark'
            : 'light';
    }

    function renderGiscus(target) {
        target.innerHTML = '';

        const script = document.createElement('script');
        script.src = 'https://giscus.app/client.js';
        script.async = true;
        script.crossOrigin = 'anonymous';
        script.setAttribute('data-repo', services.giscusRepo);
        script.setAttribute('data-repo-id', services.giscusRepoId);
        script.setAttribute('data-category', services.giscusCategory);
        script.setAttribute('data-category-id', services.giscusCategoryId);
        script.setAttribute('data-mapping', services.giscusMapping || 'pathname');
        script.setAttribute('data-strict', '0');
        script.setAttribute('data-reactions-enabled', '1');
        script.setAttribute('data-emit-metadata', '0');
        script.setAttribute('data-input-position', 'top');
        script.setAttribute('data-theme', currentTheme());
        script.setAttribute('data-lang', 'zh-CN');
        script.setAttribute('data-loading', 'lazy');

        script.addEventListener('error', () => {
            renderStatus(target, 'Giscus 脚本加载失败，请确认网络与 GitHub Discussions 配置。');
        });

        target.appendChild(script);
    }

    function run() {
        const target = document.querySelector(targetSelector);
        if (!target) return;

        if (target.dataset.datCommentsRuntimeRendered === 'true') return;
        target.dataset.datCommentsRuntimeRendered = 'true';

        if (!configuredForGiscus()) {
            renderStatus(target, 'Giscus 未完成配置：需要启用 GitHub Discussions，并设置 repo/category 的公开 ID。');
            return;
        }

        renderGiscus(target);
    }

    ready(run);
    document.addEventListener('pjax:complete', run);
})();
