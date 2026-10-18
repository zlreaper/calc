# calc

A calculator with a glass card over an animated aurora background. It is a static site with no build step or dependencies; open `index.html` in a browser.

## Features

- **Live preview.** The answer shows while you type, and unclosed parentheses are closed for you.
- **Scientific mode** (`sin cos tan ln log √ x² xʸ π e n! ans`) with a rad/deg switch.
- **Calculator-style percent.** `200 + 10%` gives `220`.
- **Implicit multiplication.** `2π`, `3(4+1)` and `2sin(π/2)` all work.
- **History** is saved in the browser. Tap an entry to load it again.
- **Keyboard support.** Digits and operators work as typed. `Enter` evaluates, `Esc` clears, `⌫` deletes, `S` toggles scientific mode and `H` toggles history.
- **Extras.** Click the result to copy it. Buttons ripple, `=` throws sparks, the card tilts with the mouse and phones get haptic taps. Animations are turned off when the system asks for reduced motion.

## Files

| File | What it does |
| --- | --- |
| `calc.js` | Tokenizer, recursive-descent parser and evaluator (no `eval`). Also runs in Node. |
| `app.js` | UI state, keypad and keyboard input, history, effects |
| `style.css` | Visual design |

## Hosting

Turn on GitHub Pages (Settings → Pages → deploy from branch) and the calculator is live.
