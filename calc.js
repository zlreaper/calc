// Expression engine: tokenizer + recursive-descent parser + evaluator.
// No eval(). Works in the browser (window.Calc) and in Node (module.exports).
(function (root) {
  'use strict';

  const FUNCS = {
    sin: (x, deg) => Math.sin(deg ? (x * Math.PI) / 180 : x),
    cos: (x, deg) => Math.cos(deg ? (x * Math.PI) / 180 : x),
    tan: (x, deg) => Math.tan(deg ? (x * Math.PI) / 180 : x),
    ln: (x) => Math.log(x),
    log: (x) => Math.log10(x),
    sqrt: (x) => Math.sqrt(x),
  };

  function tokenize(src) {
    const s = src
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/−/g, '-')
      .replace(/√/g, 'sqrt');
    const tokens = [];
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      if (/[0-9.]/.test(c)) {
        let j = i;
        while (j < s.length && /[0-9.]/.test(s[j])) j++;
        // scientific notation, e.g. 1e-7 (only when followed by a digit or sign+digit)
        if (s[j] === 'e' && /^e[+-]?\d/.test(s.slice(j))) {
          j++;
          if (s[j] === '+' || s[j] === '-') j++;
          while (j < s.length && /\d/.test(s[j])) j++;
        }
        const text = s.slice(i, j);
        if ((text.match(/\./g) || []).length > 1 || text === '.') throw new Error('Bad number');
        tokens.push({ t: 'num', v: parseFloat(text) });
        i = j;
        continue;
      }
      if (c === 'π') { tokens.push({ t: 'num', v: Math.PI }); i++; continue; }
      if (/[a-z]/i.test(c)) {
        let j = i;
        while (j < s.length && /[a-z]/i.test(s[j])) j++;
        tokens.push({ t: 'id', v: s.slice(i, j).toLowerCase() });
        i = j;
        continue;
      }
      if ('+-*/^()!%'.includes(c)) { tokens.push({ t: 'op', v: c }); i++; continue; }
      throw new Error('Unexpected "' + c + '"');
    }
    return tokens;
  }

  function parse(tokens) {
    let pos = 0;
    const peek = () => tokens[pos];
    const isOp = (v) => peek() && peek().t === 'op' && peek().v === v;
    const next = () => tokens[pos++];

    function expr() {
      let left = term();
      while (isOp('+') || isOp('-')) {
        const op = next().v;
        left = { t: 'bin', op, a: left, b: term() };
      }
      return left;
    }

    function startsOperand(tok) {
      return tok && (tok.t === 'num' || tok.t === 'id' || (tok.t === 'op' && tok.v === '('));
    }

    function term() {
      let left = unary();
      for (;;) {
        if (isOp('*') || isOp('/')) {
          const op = next().v;
          left = { t: 'bin', op, a: left, b: unary() };
        } else if (startsOperand(peek())) {
          // implicit multiplication: 2π, 3(4), (1)(2), 2sin(x)
          left = { t: 'bin', op: '*', a: left, b: unary() };
        } else break;
      }
      return left;
    }

    function unary() {
      if (isOp('-')) { next(); return { t: 'neg', a: unary() }; }
      if (isOp('+')) { next(); return unary(); }
      return power();
    }

    function power() {
      const base = postfix();
      if (isOp('^')) { next(); return { t: 'bin', op: '^', a: base, b: unary() }; }
      return base;
    }

    function postfix() {
      let node = primary();
      while (isOp('!') || isOp('%')) {
        node = { t: next().v === '!' ? 'fact' : 'pct', a: node };
      }
      return node;
    }

    function primary() {
      const tok = next();
      if (!tok) throw new Error('Incomplete');
      if (tok.t === 'num') return { t: 'num', v: tok.v };
      if (tok.t === 'op' && tok.v === '(') {
        const inner = expr();
        if (!isOp(')')) throw new Error('Missing )');
        next();
        return inner;
      }
      if (tok.t === 'id') {
        if (tok.v === 'e') return { t: 'num', v: Math.E };
        if (tok.v === 'pi') return { t: 'num', v: Math.PI };
        if (tok.v === 'ans') return { t: 'ans' };
        if (FUNCS[tok.v]) {
          if (isOp('(')) {
            next();
            const arg = expr();
            if (!isOp(')')) throw new Error('Missing )');
            next();
            return { t: 'call', f: tok.v, a: arg };
          }
          return { t: 'call', f: tok.v, a: power() }; // e.g. sqrt9, sin π
        }
        throw new Error('Unknown "' + tok.v + '"');
      }
      throw new Error('Unexpected "' + tok.v + '"');
    }

    const tree = expr();
    if (pos < tokens.length) throw new Error('Unexpected "' + tokens[pos].v + '"');
    return tree;
  }

  function factorial(n) {
    if (n < 0 || !Number.isInteger(n)) return gamma(n + 1);
    if (n > 170) return Infinity;
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
  }

  // Lanczos approximation for non-integer factorials
  function gamma(z) {
    if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
    const g = 7;
    const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
      -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
      1.5056327351493116e-7];
    z -= 1;
    let x = c[0];
    for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
    const t = z + g + 0.5;
    return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
  }

  function evaluate(node, ctx) {
    switch (node.t) {
      case 'num': return node.v;
      case 'ans': return ctx.ans || 0;
      case 'neg': return -evaluate(node.a, ctx);
      case 'pct': return evaluate(node.a, ctx) / 100;
      case 'fact': return factorial(evaluate(node.a, ctx));
      case 'call': return FUNCS[node.f](evaluate(node.a, ctx), ctx.deg);
      case 'bin': {
        const a = evaluate(node.a, ctx);
        // calculator-style percent: 200 + 10% = 220
        if ((node.op === '+' || node.op === '-') && node.b.t === 'pct') {
          const p = evaluate(node.b.a, ctx) / 100;
          return node.op === '+' ? a + a * p : a - a * p;
        }
        const b = evaluate(node.b, ctx);
        switch (node.op) {
          case '+': return a + b;
          case '-': return a - b;
          case '*': return a * b;
          case '/': return a / b;
          case '^': return Math.pow(a, b);
        }
      }
    }
    throw new Error('Bad node');
  }

  // Clean up floating-point noise: 0.1 + 0.2 -> 0.3
  function tidy(x) {
    if (!Number.isFinite(x)) return x;
    if (Math.abs(x) < 1e-12) return 0;
    return parseFloat(x.toPrecision(12));
  }

  function calculate(src, ctx = {}) {
    const tokens = tokenize(src);
    if (!tokens.length) throw new Error('Empty');
    // Auto-close unbalanced parentheses
    let depth = 0;
    for (const t of tokens) {
      if (t.t === 'op' && t.v === '(') depth++;
      if (t.t === 'op' && t.v === ')') depth--;
      if (depth < 0) throw new Error('Unbalanced )');
    }
    while (depth-- > 0) tokens.push({ t: 'op', v: ')' });
    return tidy(evaluate(parse(tokens), ctx));
  }

  function format(x) {
    if (Number.isNaN(x)) return 'Not a number';
    if (x === Infinity) return '∞';
    if (x === -Infinity) return '−∞';
    const abs = Math.abs(x);
    if (abs !== 0 && (abs >= 1e15 || abs < 1e-9)) {
      return x.toExponential(8).replace(/\.?0+e/, 'e').replace('-', '−');
    }
    const [int, frac] = String(x).split('.');
    const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',').replace('-', '−');
    return frac ? grouped + '.' + frac : grouped;
  }

  const api = { calculate, format, tokenize };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Calc = api;
})(typeof window !== 'undefined' ? window : globalThis);
