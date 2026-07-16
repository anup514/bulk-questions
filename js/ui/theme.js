/**
 * Dark/light theme toggle.
 *
 * The initial theme class is applied by a tiny inline script in each page's
 * <head> to avoid a flash of unstyled content; this module keeps the toggle
 * button and its icon in sync afterwards.
 */

export function toggleDarkMode() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    syncIcon(isDark);
}

function syncIcon(isDark) {
    const icon = document.getElementById('dark-mode-icon');
    if (icon) icon.textContent = isDark ? 'light_mode' : 'dark_mode';
}

/** Wires the theme toggle button and sets the icon to the current state. */
export function initTheme() {
    syncIcon(document.documentElement.classList.contains('dark'));
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) btn.addEventListener('click', toggleDarkMode);
}
