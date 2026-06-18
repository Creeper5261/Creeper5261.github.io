document.addEventListener('pjax:complete', tonav);
document.addEventListener('DOMContentLoaded', tonav);
let navScrollPosition = window.scrollY || document.documentElement.scrollTop || 0;

function getDesktopMenu() {
    return document.querySelector('#menus > .menus_items');
}

function isDesktopNav() {
    return window.matchMedia('(min-width: 769px)').matches && !document.getElementById("nav").classList.contains("hide-menu");
}

function setDesktopMenuVisible(visible) {
    const menus = getDesktopMenu();
    if (!menus) return;
    if (!isDesktopNav()) {
        menus.removeAttribute("style");
        document.getElementById("name-container").setAttribute("style", "display:none");
        return;
    }

    menus.setAttribute("style", visible ? "" : "display:none!important");
}

function navScrollHandler() {
    const scroll = window.scrollY || document.documentElement.scrollTop || 0;
    if (scroll > navScrollPosition && isDesktopNav()) {
        document.getElementById("name-container").setAttribute("style", "");
        setDesktopMenuVisible(false);
    } else {
        setDesktopMenuVisible(true);
        document.getElementById("name-container").setAttribute("style", "display:none");
    }
    navScrollPosition = scroll;
}

//响应pjax
function tonav() {
    document.getElementById("name-container").setAttribute("style", "display:none");
    setDesktopMenuVisible(true);
    navScrollPosition = window.scrollY || document.documentElement.scrollTop || 0;
    window.removeEventListener('scroll', navScrollHandler);
    window.addEventListener('scroll', navScrollHandler, { passive: true });
    //修复没有弄右键菜单的童鞋无法回顶部的问题
    document.getElementById("page-name").innerText = document.title.split(" | DAT")[0];
}

function scrollToTop() {
    setDesktopMenuVisible(true);
    document.getElementById("name-container").setAttribute("style", "display:none");
    btf.scrollToDest(0, 500);
}




