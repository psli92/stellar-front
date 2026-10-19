export function diagnosticProfile(profile) {
    const CX = 250, CY = 196, R = 126, LR = 150;
    const axes = Array.from(profile.querySelectorAll('[data-role="axis"]'));
    const radar = profile.querySelector('[data-role="radar"]');
    const toggleAll = profile.querySelector('[data-role="toggle-all"]');
    const max = Number(profile.dataset.scoreMax);
    let dragged = null;

    function angle(i) { return -Math.PI / 2 + i * 2 * Math.PI / axes.length; }
    function point(i, value, radius) { return [CX + radius * value / max * Math.cos(angle(i)), CY + radius * value / max * Math.sin(angle(i))]; }
    function polygon(values) { return values.map(function (value, i) { return point(i, value, R).join(','); }).join(' '); }
    function score(axis) { return Number(axis.querySelector('[type="number"]').value); }
    function level(value) { return value >= Number(profile.dataset.levelHigh) ? 'high' : (value >= Number(profile.dataset.levelMid) ? 'mid' : 'low'); }
    function escape(text) { return new Option(text).innerHTML; }

    function setScore(axis, value) {
        value = Math.max(0, Math.min(max, Math.round(Number(value)) || 0));
        axis.querySelectorAll('input').forEach(function (input) { input.value = value; });
    }

    function renderRadar() {
        const values = axes.map(score);
        let svg = [0.2, 0.4, 0.6, 0.8, 1].map(function (step) {
            return '<polygon class="pd-radar__grid" points="' + polygon(values.map(function () { return step * max; })) + '"/>';
        }).join('');

        svg += axes.map(function (axis, i) { return '<line class="pd-radar__grid" x1="' + CX + '" y1="' + CY + '" x2="' + point(i, max, R).join('" y2="') + '"/>'; }).join('');
        svg += '<polygon class="pd-radar__shape" points="' + polygon(values) + '"/>';

        axes.forEach(function (axis, i) {
            const [x, y] = point(i, max, LR);
            const words = axis.dataset.name.split(' ');
            const lines = axis.dataset.name.length > 15 && words.length > 1 ? [words[0], words.slice(1).join(' ')] : [axis.dataset.name];
            const anchor = Math.abs(Math.cos(angle(i))) < 0.25 ? 'middle' : (Math.cos(angle(i)) > 0 ? 'start' : 'end');
            const top = y - (Math.sin(angle(i)) < -0.6 ? (lines.length - 1) * 13 : 0);

            svg += '<text class="pd-radar__label" text-anchor="' + anchor + '" x="' + x + '" y="' + top + '">' + lines.map(function (line, k) {
                return '<tspan x="' + x + '" dy="' + (k ? 13 : 0) + '">' + escape(line) + '</tspan>';
            }).join('') + '</text>';
            svg += '<text class="pd-radar__value" text-anchor="' + anchor + '" x="' + x + '" y="' + (top + lines.length * 13) + '" data-level="' + level(values[i]) + '">' + values[i] + '</text>';
        });

        svg += values.map(function (value, i) { return '<circle class="pd-radar__vertex" r="5" data-index="' + i + '" cx="' + point(i, value, R).join('" cy="') + '"/>'; }).join('');
        radar.innerHTML = svg;
    }

    function sync() {
        axes.forEach(function (axis) {
            axis.dataset.level = level(score(axis));
            axis.style.setProperty('--score', score(axis) / max * 100 + '%');
            axis.querySelector('[data-role="score"]').textContent = score(axis);
        });

        profile.querySelector('[data-role="structuring"]').replaceChildren(...axes.slice().sort(function (a, b) { return score(b) - score(a); }).slice(0, 3).map(function (axis) {
            return Object.assign(document.createElement('span'), { className: 'sk-badge sk-badge--brand', textContent: axis.dataset.name + ' · ' + score(axis) });
        }));

        renderRadar();
    }

    profile.addEventListener('input', function (event) {
        const axis = event.target.closest('[data-role="axis"]');
        if (axis && (event.target.type === 'range' || event.target.type === 'number')) {
            setScore(axis, event.target.value);
            sync();
        }
    });

    radar.addEventListener('pointerdown', function (event) {
        if (!event.target.dataset.index) return;
        event.preventDefault();
        dragged = axes[event.target.dataset.index];
        radar.setPointerCapture(event.pointerId);
    });

    radar.addEventListener('pointermove', function (event) {
        if (!dragged) return;
        const box = radar.getBoundingClientRect();
        const i = axes.indexOf(dragged);
        const x = (event.clientX - box.left) / box.width * 500 - CX;
        const y = (event.clientY - box.top) / box.height * 400 - CY;
        setScore(dragged, (x * Math.cos(angle(i)) + y * Math.sin(angle(i))) / R * max);
        sync();
    });

    radar.addEventListener('pointerup', function () { dragged = null; });

    profile.querySelector('[data-role="reset"]').addEventListener('click', function () {
        axes.forEach(function (axis) { setScore(axis, axis.querySelector('[data-saved]').dataset.saved); });
        sync();
    });

    toggleAll.addEventListener('click', function () {
        const open = toggleAll.getAttribute('aria-expanded') !== 'true';
        toggleAll.setAttribute('aria-expanded', String(open));
        axes.forEach(function (axis) { axis.open = open; });
    });

    sync();
}
