(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const calcEl = $('calc');
  const exprEl = $('expr');
  const resultEl = $('result');
  const toastEl = $('toast');
  const historyList = $('historyList');
  const historyEmpty = $('historyEmpty');

  const BINARY = ['+', '−', '×', '÷', '^'];
  const HISTORY_KEY = 'calc.history';
  const MAX_HISTORY = 50;

  const state = {
    expr: '',
    ans: 0,
    justEvaluated: false,
    deg: false,
    history: loadHistory(),
  };

  // ---------- storage ----------
  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch { return []; }
  }
  function saveHistory() {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history)); } catch { /* private mode */ }
  }

  // ---------- core actions ----------
  function insert(text) {
    const startsFresh = /^[0-9.(πe√]|^ans|^[a-z]+\(/.test(text);
    if (state.justEvaluated) {
      // after "=", a number starts over; an operator continues from the result
      state.expr = startsFresh ? '' : String(state.ans);
      state.justEvaluated = false;
    }
    const last = state.expr.slice(-1);
    if (BINARY.includes(text) && text !== '−' && BINARY.includes(last)) {
      state.expr = state.expr.slice(0, -1); // swap operator instead of stacking
    }
    if (text === '.') {
      const currentNumber = state.expr.match(/[0-9.]*$/)[0];
      if (currentNumber.includes('.')) return bump();
      if (!currentNumber) text = '0.';
    }
    state.expr += text;
    render();
  }

  function backspace() {
    if (state.justEvaluated) return clear();
    state.expr = state.expr.replace(/(sin\(|cos\(|tan\(|ln\(|log\(|√\(|ans|.)$/, '');
    render();
  }

  function clear() {
    state.expr = '';
    state.justEvaluated = false;
    render();
  }

  function equals() {
    if (!state.expr || state.justEvaluated) return;
    let value;
    try {
      value = Calc.calculate(state.expr, { ans: state.ans, deg: state.deg });
    } catch (err) {
      return showError(err.message === 'Incomplete' ? 'Incomplete' : 'Error');
    }
    if (Number.isNaN(value)) return showError('Not a number');

    // close any parentheses the user left open so history reads cleanly
    const open = (state.expr.match(/\(/g) || []).length - (state.expr.match(/\)/g) || []).length;
    if (open > 0) state.expr += ')'.repeat(open);

    state.history.unshift({ expr: state.expr, value });
    state.history.length = Math.min(state.history.length, MAX_HISTORY);
    saveHistory();
    renderHistory();

    const exprBefore = state.expr;
    state.ans = value;
    state.justEvaluated = true;
    exprEl.innerHTML = highlight(exprBefore) + ' <span class="tok-op">=</span>';
    setResult(Calc.format(value), 'pop');
    if (Number.isFinite(value)) celebrate();
  }

  function showError(msg) {
    setResult(msg, 'error');
    calcEl.classList.remove('shake');
    void calcEl.offsetWidth;
    calcEl.classList.add('shake');
    buzz(30);
  }

  // ---------- rendering ----------
  function escapeHtml(s) {
    return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  }

  function highlight(expr) {
    return escapeHtml(expr)
      .replace(/(sin|cos|tan|ln|log|√|ans)/g, '<span class="tok-fn">$1</span>')
      .replace(/([+−×÷^%!])/g, '<span class="tok-op">$1</span>');
  }

  function setResult(text, mode) {
    resultEl.className = 'result' + (mode ? ' ' + mode : '');
    resultEl.textContent = text;
    if (mode === 'pop') { void resultEl.offsetWidth; }
  }

  function render() {
    exprEl.innerHTML = highlight(state.expr) + '<span class="caret"></span>';
    exprEl.scrollLeft = exprEl.scrollWidth;
    $('clearBtn').textContent = state.expr ? 'C' : 'AC';

    // live preview while typing
    if (!state.expr) {
      setResult('0');
    } else {
      try {
        const v = Calc.calculate(state.expr, { ans: state.ans, deg: state.deg });
        const isPlainNumber = /^[0-9.]+$/.test(state.expr);
        setResult(Calc.format(v), isPlainNumber ? '' : 'preview');
      } catch {
        resultEl.classList.add('preview');
      }
    }

    // glow the operator that's waiting for its right-hand side
    const last = state.expr.slice(-1);
    document.querySelectorAll('.pad .op').forEach((b) => {
      b.classList.toggle('active', b.dataset.ins === last);
    });
  }

  function renderHistory() {
    historyList.innerHTML = '';
    historyEmpty.hidden = state.history.length > 0;
    state.history.forEach((item) => {
      const li = document.createElement('li');
      li.innerHTML =
        '<div class="h-expr">' + highlight(item.expr) + ' =</div>' +
        '<div class="h-res">' + escapeHtml(Calc.format(item.value)) + '</div>';
      li.addEventListener('click', () => {
        state.expr = item.expr;
        state.justEvaluated = false;
        toggleHistory(false);
        render();
      });
      historyList.appendChild(li);
    });
  }

  // ---------- flourishes ----------
  function buzz(ms = 8) {
    if (navigator.vibrate) try { navigator.vibrate(ms); } catch { /* unsupported */ }
  }

  function bump() {
    exprEl.animate([{ transform: 'translateX(4px)' }, { transform: 'none' }], { duration: 150 });
  }

  function ripple(button, x, y) {
    const r = button.getBoundingClientRect();
    const dot = document.createElement('span');
    dot.className = 'ripple';
    dot.style.left = (x ?? r.width / 2) + 'px';
    dot.style.top = (y ?? r.height / 2) + 'px';
    button.appendChild(dot);
    dot.addEventListener('animationend', () => dot.remove());
  }

  // A tiny burst of sparks from the result when you hit "="
  function celebrate() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = resultEl.getBoundingClientRect();
    const colors = ['#ff4fd8', '#8b5cff', '#2de2ff', '#ffb84d'];
    for (let i = 0; i < 14; i++) {
      const s = document.createElement('span');
      const angle = Math.random() * Math.PI * 2;
      const dist = 40 + Math.random() * 60;
      Object.assign(s.style, {
        position: 'fixed', left: r.right - 30 + 'px', top: r.top + r.height / 2 + 'px',
        width: '6px', height: '6px', borderRadius: '50%', pointerEvents: 'none', zIndex: 10,
        background: colors[i % colors.length], boxShadow: '0 0 10px ' + colors[i % colors.length],
      });
      document.body.appendChild(s);
      s.animate(
        [
          { transform: 'translate(0,0) scale(1)', opacity: 1 },
          { transform: `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist}px) scale(0)`, opacity: 0 },
        ],
        { duration: 600 + Math.random() * 300, easing: 'cubic-bezier(.2,.8,.2,1)' }
      ).onfinish = () => s.remove();
    }
  }

  function copyResult() {
    const text = resultEl.textContent.replace(/,/g, '').replace(/−/g, '-');
    if (!/^-?[0-9.e+]+$/.test(text)) return;
    navigator.clipboard?.writeText(text).then(() => {
      toastEl.classList.add('show');
      setTimeout(() => toastEl.classList.remove('show'), 1000);
    }).catch(() => {});
  }

  // ---------- toggles ----------
  function toggleSci(force) {
    const on = calcEl.classList.toggle('sci', force);
    $('sciToggle').setAttribute('aria-pressed', on);
  }
  function toggleHistory(force) {
    const on = calcEl.classList.toggle('show-history', force);
    $('historyToggle').setAttribute('aria-pressed', on);
  }

  $('sciToggle').addEventListener('click', () => toggleSci());
  $('historyToggle').addEventListener('click', () => toggleHistory());
  $('angleToggle').addEventListener('click', (e) => {
    state.deg = !state.deg;
    e.currentTarget.textContent = state.deg ? 'deg' : 'rad';
    render();
  });
  $('clearHistory').addEventListener('click', () => {
    state.history = [];
    saveHistory();
    renderHistory();
  });
  resultEl.addEventListener('click', copyResult);

  // ---------- keypad ----------
  function press(button) {
    if (button.dataset.act === 'equals') equals();
    else if (button.dataset.act === 'clear') clear();
    else if (button.dataset.fn) insert(button.dataset.fn);
    else if (button.dataset.ins) insert(button.dataset.ins);
    buzz();
  }

  document.querySelectorAll('.pad button, .sci-pad button').forEach((b) => {
    b.addEventListener('pointerdown', (e) => {
      const r = b.getBoundingClientRect();
      ripple(b, e.clientX - r.left, e.clientY - r.top);
    });
    b.addEventListener('click', () => press(b));
  });

  // ---------- keyboard ----------
  const KEYMAP = { '*': '×', x: '×', '/': '÷', '-': '−', '+': '+', '^': '^', '(': '(', ')': ')', '%': '%', '!': '!', '.': '.', ',': '.', p: 'π' };

  function flash(selector) {
    const b = document.querySelector(selector);
    if (!b) return;
    b.classList.add('pressed');
    ripple(b);
    setTimeout(() => b.classList.remove('pressed'), 120);
  }

  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'c') copyResult();
      return;
    }
    const k = e.key;
    if (/^[0-9]$/.test(k)) { insert(k); flash(`.pad [data-ins="${k}"]`); }
    else if (KEYMAP[k]) { insert(KEYMAP[k]); flash(`.pad [data-ins="${KEYMAP[k]}"]`); }
    else if (k === 'Enter' || k === '=') { e.preventDefault(); equals(); flash('.pad .eq'); }
    else if (k === 'Backspace') { backspace(); }
    else if (k === 'Escape' || k === 'Delete') { clear(); flash('#clearBtn'); }
    else if (k === 's') toggleSci();
    else if (k === 'h') toggleHistory();
    else return;
    e.preventDefault();
  });

  // ---------- 3D tilt ----------
  if (window.matchMedia('(hover: hover) and (prefers-reduced-motion: no-preference)').matches) {
    document.addEventListener('pointermove', (e) => {
      const x = e.clientX / window.innerWidth - 0.5;
      const y = e.clientY / window.innerHeight - 0.5;
      calcEl.style.setProperty('--tilt-y', x * 6 + 'deg');
      calcEl.style.setProperty('--tilt-x', -y * 6 + 'deg');
    });
  }

  renderHistory();
  render();
})();
