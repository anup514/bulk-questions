/**
 * Interactive pie charts for headings and levels on the distribution page.
 */

let headingsChart = null;
let levelsChart = null;

const LEVEL_COLORS = {
    easy: '#22c55e',
    medium: '#f97316',
    hard: '#ef4444'
};

/** Distinct palette that reads well in both light and dark themes. */
const PALETTE = [
    '#0f766e', '#f97316', '#3b82f6', '#ef4444', '#8b5cf6',
    '#14b8a6', '#eab308', '#ec4899', '#22c55e', '#6366f1',
    '#f43f5e', '#0ea5e9', '#a855f7', '#84cc16', '#f59e0b',
    '#06b6d4', '#d946ef', '#10b981', '#fb7185', '#64748b',
    '#7c3aed', '#dc2626', '#2563eb', '#65a30d', '#db2777'
];

function colorFor(i) {
    return PALETTE[i % PALETTE.length];
}

function themeColors() {
    const dark = document.documentElement.classList.contains('dark');
    return {
        text: dark ? '#94a3b8' : '#64748b',
        border: dark ? '#111827' : '#ffffff',
        primary: dark ? '#2dd4bf' : '#0f766e'
    };
}

function destroyCharts() {
    if (headingsChart) {
        headingsChart.destroy();
        headingsChart = null;
    }
    if (levelsChart) {
        levelsChart.destroy();
        levelsChart = null;
    }
}

export function renderSummary(stats) {
    const el = document.getElementById('dist-summary');
    if (!el) return;
    el.innerHTML = [
        { label: 'Questions', value: stats.total },
        { label: 'Headings', value: stats.headingCount }
    ].map((item) => `
        <div class="dist-stat">
            <div class="dist-stat__value">${item.value}</div>
            <div class="dist-stat__label">${item.label}</div>
        </div>
    `).join('');
}

/**
 * Shared pie chart setup with hover ↔ legend sync.
 * @param {'headings'|'levels'} kind
 */
function renderPieChart({ kind, canvasId, legendId, items, getLabel, getColor, getChartRef, setChartRef }) {
    const canvas = document.getElementById(canvasId);
    const legend = document.getElementById(legendId);
    const ChartLib = typeof window !== 'undefined' ? window.Chart : null;
    if (!canvas || !ChartLib) return;

    const colors = themeColors();
    const total = items.reduce((sum, item) => sum + item.count, 0) || 1;
    const bg = items.map((item, i) => getColor(item, i));

    const existing = getChartRef();
    if (existing) existing.destroy();

    const chart = new ChartLib(canvas, {
        type: 'pie',
        data: {
            labels: items.map(getLabel),
            datasets: [{
                data: items.map((item) => item.count),
                backgroundColor: bg,
                borderColor: colors.border,
                borderWidth: 2,
                hoverOffset: 14,
                hoverBorderColor: colors.border
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 300 },
            plugins: {
                legend: { display: false },
                tooltip: {
                    displayColors: true,
                    callbacks: {
                        label(ctx) {
                            const n = ctx.parsed || 0;
                            const pct = Math.round((n / total) * 100);
                            return ` ${n} question${n === 1 ? '' : 's'} (${pct}%)`;
                        }
                    }
                }
            },
            onHover(event, elements) {
                highlightLegend(legendId, elements.length ? elements[0].index : -1);
                event.native.target.style.cursor = elements.length ? 'pointer' : 'default';
            }
        }
    });

    setChartRef(chart);

    if (legend) {
        legend.innerHTML = items.map((item, i) => {
            const pct = Math.round((item.count / total) * 100);
            return `
                <li class="dist-legend__item" data-index="${i}">
                    <span class="dist-legend__swatch" style="background:${getColor(item, i)}"></span>
                    <span class="dist-legend__label">${escapeHtml(getLabel(item))}</span>
                    <span class="dist-legend__value">${item.count} · ${pct}%</span>
                </li>
            `;
        }).join('');

        legend.querySelectorAll('.dist-legend__item').forEach((row) => {
            const idx = Number(row.dataset.index);
            row.addEventListener('mouseenter', () => activateSlice(kind, idx, legendId));
            row.addEventListener('mouseleave', () => activateSlice(kind, -1, legendId));
        });
    }
}

export function renderHeadingsChart(headings) {
    renderPieChart({
        kind: 'headings',
        canvasId: 'dist-headings-chart',
        legendId: 'dist-headings-legend',
        items: headings,
        getLabel: (h) => h.name,
        getColor: (_h, i) => colorFor(i),
        getChartRef: () => headingsChart,
        setChartRef: (c) => { headingsChart = c; }
    });
}

export function renderLevelsChart(levels) {
    const colors = themeColors();
    renderPieChart({
        kind: 'levels',
        canvasId: 'dist-levels-chart',
        legendId: 'dist-levels-legend',
        items: levels,
        getLabel: (l) => l.label,
        getColor: (l) => LEVEL_COLORS[l.key] || colors.primary,
        getChartRef: () => levelsChart,
        setChartRef: (c) => { levelsChart = c; }
    });
}

function chartFor(kind) {
    return kind === 'levels' ? levelsChart : headingsChart;
}

/** Programmatically highlight a pie slice (used when hovering the legend). */
function activateSlice(kind, index, legendId) {
    const chart = chartFor(kind);
    if (!chart) return;
    if (index < 0) {
        chart.setActiveElements([]);
        chart.tooltip.setActiveElements([], { x: 0, y: 0 });
    } else {
        const active = [{ datasetIndex: 0, index }];
        chart.setActiveElements(active);
        const meta = chart.getDatasetMeta(0).data[index];
        if (meta) {
            chart.tooltip.setActiveElements(active, { x: meta.x, y: meta.y });
        }
    }
    chart.update();
    highlightLegend(legendId, index);
}

/** Visually emphasise the legend row matching the hovered slice. */
function highlightLegend(legendId, index) {
    const legend = document.getElementById(legendId);
    if (!legend) return;
    legend.querySelectorAll('.dist-legend__item').forEach((item) => {
        item.classList.toggle('is-active', Number(item.dataset.index) === index);
    });
}

export function renderAllCharts(stats) {
    destroyCharts();
    renderSummary(stats);
    renderLevelsChart(stats.levels);
    renderHeadingsChart(stats.headings);
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
