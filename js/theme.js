/**
 * theme.js
 * Handles Dark/Light mode toggling
 */

document.addEventListener('DOMContentLoaded', () => {
    const themeToggleBtn = document.getElementById('theme-toggle');
    const htmlElement = document.documentElement;

    // Check for saved theme preference or use system preference
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
        htmlElement.classList.add('dark');
    } else {
        htmlElement.classList.remove('dark');
    }

    if (themeToggleBtn) {
        // Update icon based on current theme
        updateThemeIcon(themeToggleBtn, htmlElement.classList.contains('dark'));

        themeToggleBtn.addEventListener('click', () => {
            htmlElement.classList.toggle('dark');
            const isDark = htmlElement.classList.contains('dark');

            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            updateThemeIcon(themeToggleBtn, isDark);
        });
    }
});

function updateThemeIcon(btn, isDark) {
    const iconSpan = btn.querySelector('.material-symbols-outlined');
    if (iconSpan) {
        iconSpan.textContent = isDark ? 'light_mode' : 'dark_mode';
    }
}
