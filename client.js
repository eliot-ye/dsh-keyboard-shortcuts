/**
 * Global UI keyboard shortcuts for DSH.
 *
 * Two cooperating mechanisms, because DSH dispatches the shortcut registry
 * differently per runtime:
 *
 *  - Web: the registry's DOM adapter dispatches (`installKeyboard` runs with
 *    `native = false`), so commands registered via `ctx.shortcuts` fire directly.
 *  - Desktop (macOS/Windows): that same adapter is created with `native = true`
 *    and returns *before* `shortcuts.dispatch` (`if (native) return;`), so a
 *    registered command only fires if the native preload bridge forwards the
 *    gesture. Bare Alt+digit is a dead key on macOS and its keydown never even
 *    reaches the page, so registry-only commands never fire there.
 *
 * Therefore the action is executed by a thin capture-phase DOM listener on
 * Desktop (the only reliable path there), and by the registry on Web. Commands
 * are still registered with `ctx.shortcuts` on both so they appear in DSH's
 * shortcut reference UI and get conflict detection; on Desktop their `resolve`
 * returns `pass` so the DOM listener is the single executor (no double-fire).
 *
 * Key choice: Desktop uses the primary modifier alone (Cmd on macOS / Ctrl on
 * Windows+Linux) — Cmd+digit's keydown dispatches normally, unlike Alt+digit.
 * Web uses primary+Alt, because a bare primary is reserved there.
 *
 * Commands
 *   keyboard.session-1 .. keyboard.session-9  open the Nth sidebar session
 *   keyboard.focus-composer                   focus the message composer
 *
 * Session order is read from the rendered rows (`[data-row-key^="session:"]`,
 * document order): exactly the current workspace's unarchived sessions as DSH
 * displays them after its grouping / recency / pin filter.
 *
 * Digit switching on Desktop is driven by the command `resolve` instead: the
 * native keyboard bridge intercepts a *bound* chord before it reaches the
 * renderer DOM, so Alt+digit never becomes a DOM keydown there — but the bridge
 * still dispatches it to the registered command, whose resolve does the switch.
 * Letters (N/I) do reach the DOM, so they are handled by the capture listener.
 *
 * The composer is a Lexical `contenteditable` exposed by `[data-composer-input]`
 * (NOT a textarea). While the shortcut modifier is held, a numbered hint badge
 * is drawn on each target and hidden on release.
 */

window.__ModuleLoader__.load({
  id: 'dsh-keyboard-shortcuts',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const ALT_ONLY = ['alt'];
    const PRIMARY_ALT = ['primary', 'alt'];

    const SESSION_ROW_SELECTOR = '[data-row-key^="session:"]';
    const COMPOSER_SELECTOR = '[data-composer-input]';
    const SESSION_PREFIX = 'session:';

    // Ask popup (DSH `ask_user_question`) anchors: the composer-seat card is
    // rooted at `[data-question-key]`, one question is shown at a time, and
    // each option renders as a `[data-option-row]` containing the clickable
    // option `button` (role radio/checkbox) plus a separate expand-description
    // `button`. The option button is located by its ARIA role — its `className`
    // is a CSS-Module hash (not a literal `option`), so we must not select by
    // class. See openspec specs shortcut-core / desktop-executor-hints
    // (ask-popup-digit-select delta).
    const ASK_POPUP_SELECTOR = '[data-question-key]';
    const ASK_OPTION_ROW_SELECTOR = '[data-option-row]';
    const ASK_OPTION_BUTTON_SELECTOR = 'button[role="radio"], button[role="checkbox"]';
    // The submit / next button lives in the popup card's semantic <footer>. The
    // footer and its buttons are CSS-Module hashed (`css.footer` -> `ggehTG_*`),
    // so we must not select by class; but the <footer> tag itself is literal, and
    // among its buttons the primary submit is the LAST one that has text content
    // (the pager prev/next are icon-only). Verified against
    // dsh-client-ui-user-questions built output (see design D2).
    const ASK_FOOTER_SELECTOR = '[data-question-key] footer';

    /** Set by the hint overlay on mount; called by the actions to hide the
     *  badges deterministically. For Alt+digit the native bridge swallows the
     *  keyup, so "hide on Alt release" never fires — hiding right after the
     *  switch action runs is the reliable signal that the chord completed. */
    let requestHide = null;

    /** Per-profile defaults for one physical key. Desktop uses plain Alt to match
     *  the DOM gesture that actually works (the on-page diagnostic showed Alt+digit
     *  reaches the renderer whenever macOS treats it as a live character rather
     *  than a dead key). Web keeps primary+Alt (bare Alt is reserved there), and
     *  `web:linux` is omitted: its allow-list admits only Slash/Comma/Period, so
     *  a primary+Alt default there would make `register` throw. */
    function defaultsFor(code) {
      return {
        'desktop:macos': { code, modifiers: ALT_ONLY },
        'desktop:windows': { code, modifiers: ALT_ONLY },
        'desktop:linux': { code, modifiers: ALT_ONLY },
        'web:macos': { code, modifiers: PRIMARY_ALT },
        'web:windows': { code, modifiers: PRIMARY_ALT }
      };
    }

    /** Defensive service lookup: never assume a property accessor exists. */
    function getService(ctx, name) {
      try {
        if (typeof ctx.get === 'function') return ctx.get(name);
      } catch (_) {
        /* fall through to property access */
      }
      return ctx[name];
    }

    /** True when running inside the Electron Desktop shell (vs a browser). */
    function isDesktop(ctx) {
      const shortcuts = getService(ctx, 'shortcuts');
      if (shortcuts && typeof shortcuts.runtime === 'string') {
        return shortcuts.runtime === 'desktop';
      }
      // Fallback mirroring the registry's own detectEnvironment().
      try {
        return document.documentElement.dataset.platform !== undefined;
      } catch (_) {
        return false;
      }
    }

    /** The DOM gesture the actions respond to. Desktop: Alt (with or without the
     *  primary modifier). Evidence from the on-page diagnostic: whether macOS
     *  delivers the digit keydown to the page depends on the current input
     *  source — Option+digit is sometimes a live character (key='¡', keydown
     *  arrives) and sometimes a dead key / menu-swallowed (no digit keydown).
     *  Accepting Alt alone lets the DOM listener fire whenever the digit does
     *  reach the page. Web: primary+Alt, because bare Alt is reserved there. */
    function gestureMatches(ctx, event) {
      if (!event || event.shiftKey || !event.altKey) return false;
      return isDesktop(ctx) ? true : Boolean(event.metaKey || event.ctrlKey);
    }

    // --- Actions (shared by the Desktop DOM path and the Web registry path) ---

    /** Ordered session ids exactly as the sidebar displays them. Rows are
     *  filtered to visible ones so the numbering matches the hint badges and the
     *  on-screen order, and so we never grab a hidden row from another /
     *  collapsed workspace (which wouldn't visibly switch). */
    function sessionRowIds() {
      return Array.from(document.querySelectorAll(SESSION_ROW_SELECTOR))
        .filter(isVisible)
        .map((el) => {
          const key = el.getAttribute('data-row-key') || '';
          return key.startsWith(SESSION_PREFIX) ? key.slice(SESSION_PREFIX.length) : '';
        })
        .filter(Boolean);
    }

    function isVisible(el) {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      const style = window.getComputedStyle(el);
      return style.visibility !== 'hidden' && style.display !== 'none';
    }

    /** True for the modifier keys themselves (Alt/Meta/Ctrl/Shift). */
    function isModifierKey(event) {
      return event.key === 'Alt' || event.key === 'Meta' || event.key === 'Control' || event.key === 'Shift';
    }

    /** Locate the open ask popup's selectable option buttons, or return null.
     *
     * Shared by all three digit execution points (web/desktop registry resolve
     * and the desktop capture listener) and by the hint overlay, so the
     * "is the popup open" decision is made once (design D1) and the numbering
     * always matches the click targets (D2). Returns null when the popup is
     * not open, is locked (submission in flight), or has no selectable option
     * — callers then fall back to session switching.
     *
     * Only visible option rows count (the popup shows one question at a time,
     * so visible rows belong to the current question) — the same trust-the-
     * visible-DOM philosophy as `sessionRowIds`. Selecting an option is a real
     * `.click()` on its button (located by ARIA role), reusing the popup's own
     * `choose` handling (single-select auto-advances, multi-select toggles, last
     * question does not auto-submit) — this plugin never touches selection state
     * directly. */
    function askPopupTargets() {
      if (!document.querySelector(ASK_POPUP_SELECTOR)) return null;
      const buttons = Array.from(document.querySelectorAll(ASK_OPTION_ROW_SELECTOR))
        .filter(isVisible)
        .map((row) => row.querySelector(ASK_OPTION_BUTTON_SELECTOR))
        .filter((button) => button && isVisible(button) && !button.disabled);
      if (buttons.length === 0) return null;
      return {
        buttons,
        /** Click the Nth (0-based) option button. Returns false when the
         *  position is out of range or the click cannot dispatch. */
        pick(index) {
          const button = buttons[index];
          if (!button) return false;
          try {
            button.click();
          } catch (_) {
            return false;
          }
          // The Alt+digit chord is complete and its keyup is swallowed by the
          // native bridge on desktop, so hide the badges here rather than
          // waiting for a keyup that never arrives (mirrors openSessionAt).
          if (typeof requestHide === 'function') requestHide();
          return true;
        }
      };
    }

    /** Locate the open ask popup's primary submit / next button, or null.
     *
     * Shared by the keyboard.ask-submit resolve, the desktop capture listener,
     * and the hint overlay so the "is the popup open" decision and the click
     * target are decided once. Returns null when the popup is not open or there
     * is no submit button at all (e.g. a review card). A DISABLED submit button
     * is still returned (so the S badge always marks the submit slot and callers
     * can decide) — the disabled check lives in clickSubmitPrimary, because the
     * submit button is disabled whenever nothing is answered yet, and filtering
     * on disabled here would drop it and fall through to the skip button.
     *
     * The primary button is the LAST TEXT button in the footer, identified by
     * having non-empty text content: the pager prev/next buttons are icon-only
     * (an icon child, no text — they carry an aria-label instead), while the
     * footer's text actions are [skip, submit] whose last is the primary button;
     * in a review card (no actions, pager only) the filter yields nothing, so
     * Alt+S correctly does nothing instead of paging. We key on intrinsic
     * textContent rather than class names (CSS-Module hashed) or aria-label
     * (added by an external Button primitive we can't inspect), so the
     * discriminator is DOM-self and robust. Clicking is a real `.click()`,
     * reusing the popup's own `continueFlow` handler (next question when not
     * last, submit when last) — this plugin never drives submission state
     * directly. */
    function submitPrimaryButton() {
      const footer = document.querySelector(ASK_FOOTER_SELECTOR);
      if (!footer) return null;
      const buttons = Array.from(footer.querySelectorAll('button'))
        .filter((button) => isVisible(button) && button.textContent.trim() !== '');
      const button = buttons[buttons.length - 1];
      return button || null;
    }

    /** Click the popup's primary submit/next button. Returns false when there
     *  is no enabled primary button to click (missing, or disabled — e.g. busy
     *  submitting or nothing answered yet). */
    function clickSubmitPrimary() {
      const button = submitPrimaryButton();
      if (!button || button.disabled) return false;
      try {
        button.click();
      } catch (_) {
        return false;
      }
      // The Alt+S chord is complete and its keyup is swallowed by the native
      // bridge on desktop, so hide the badges here rather than waiting for a
      // keyup that never arrives (mirrors openSessionAt / option pick).
      if (typeof requestHide === 'function') requestHide();
      return true;
    }

    function findComposer() {
      return Array.from(document.querySelectorAll(COMPOSER_SELECTOR)).find(isVisible) || null;
    }

    function focusComposerEl(el) {
      if (!el) return false;
      el.focus();
      try {
        const selection = window.getSelection();
        if (selection) {
          const range = document.createRange();
          range.selectNodeContents(el);
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      } catch (_) {
        /* caret placement is cosmetic; focus alone is the useful part */
      }
      return true;
    }

    /** Open the Nth displayed session by clicking its row, which reuses the
     *  sidebar's own `onClick → onOpen` path (including any workspace switch)
     *  rather than guessing at the preconditions of a direct service call.
     *  Returns false when there isn't a visible session at that position. */
    function openSessionAt(_ctx, index) {
      const rows = Array.from(document.querySelectorAll(SESSION_ROW_SELECTOR)).filter(isVisible);
      const row = rows[index];
      if (!row) return false;
      // The row is an interactive treeitem; a real click is the one code path
      // guaranteed to run the sidebar's own open logic (incl. workspace switch).
      try {
        row.click();
      } catch (_) {
        return false;
      }
      // The Alt+digit chord is complete and its keyup is swallowed by the native
      // bridge, so hide the badges here rather than waiting for a keyup that
      // never arrives.
      if (typeof requestHide === 'function') requestHide();
      return true;
    }

    const badgeStyle = {
      position: 'fixed',
      minWidth: '18px',
      height: '18px',
      padding: '0 5px',
      borderRadius: '5px',
      background: 'rgba(17, 20, 26, 0.55)',
      color: '#ffffff',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: '11px',
      lineHeight: '18px',
      fontWeight: '600',
      textAlign: 'center',
      pointerEvents: 'none',
      zIndex: 2147483646,
      boxShadow: '0 1px 4px rgba(0,0,0,0.35)'
    };

    function Badge(props) {
      const rect = props.rect;
      const left = Math.max(0, rect.left + 3);
      const top = Math.max(0, rect.top + 3);
      return h('div', { style: Object.assign({}, badgeStyle, { left: left + 'px', top: top + 'px' }) }, props.label);
    }

    function ShortcutHints(props) {
      // Only draw badges while the modifier is held (`active`). Without this gate
      // the badges would render forever once `targets` is populated.
      if (!props.active) return null;
      const targets = props.targets;
      const children = (targets || []).map((t, i) => h(Badge, { key: t.label + '-' + i, rect: t.rect, label: t.label }));
      return h('div', { style: { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: 2147483646 } }, children);
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        const disposers = [];
        /** Run a setup step; a failure there must never abort the others. */
        function safely(tag, step) {
          try {
            const result = step();
            if (typeof result === 'function') disposers.push(result);
            return result;
          } catch (error) {
            console.warn('keyboard-shortcuts: ' + tag + ' failed', error);
            return undefined;
          }
        }

        const desktop = safely('isDesktop', () => isDesktop(ctx)) === true;

        // --- Hint overlay: registered FIRST so its presence in `shell.overlay`
        //     is a reliable signal that this module loaded and apply() ran. ---
        safely('overlay', () =>
          ctx.slots.inject('shell.overlay', () =>
            ctx.slots.register(
              { name: 'shell.overlay', id: 'keyboard-shortcuts-hints', order: 9999, label: 'keyboard-shortcuts' },
              function HintOverlay() {
                const activeState = React.useState(false);
                const setActive = activeState[1];
                const targetsState = React.useState([]);
                const setTargets = targetsState[1];
                // Mirror `active` into a ref so the scroll/resize listeners (which
                // are registered once) can read the current visibility without
                // re-subscribing on every toggle.
                const activeRef = React.useRef(false);
                activeRef.current = activeState[0];

                // Expose a hide() to the module-level actions. Alt+digit swallows
                // its keyup, so the switch action calls this directly once it has
                // completed — the deterministic "chord is over" signal.
                React.useEffect(() => {
                  requestHide = () => {
                    activeRef.current = false;
                    setActive(false);
                  };
                  return () => { requestHide = null; };
                }, []);

                React.useEffect(() => {
                  function findTargets() {
                    const targets = [];
                    const push = (el, label) => {
                      if (!el || !isVisible(el)) return;
                      targets.push({ label, rect: el.getBoundingClientRect() });
                    };
                    // Ask popup open: badge the current question's option buttons
                    // with 1..N — the SAME askPopupTargets() the select action
                    // uses, so badge digit always matches Alt+digit. Also badge
                    // the primary submit/next button with S (same predicate as
                    // the Alt+S action).
                    const popup = askPopupTargets();
                    if (popup) {
                      popup.buttons.slice(0, 9).forEach((button, i) => push(button, String(i + 1)));
                      push(submitPrimaryButton(), 'S');
                      return targets;
                    }
                    push(findComposer(), 'I');
                    // Enumerate the SAME visible rows, in the SAME order, that
                    // the switch action uses, so badge digit always matches
                    // Alt+digit.
                    Array.from(document.querySelectorAll(SESSION_ROW_SELECTOR))
                      .filter(isVisible)
                      .slice(0, 9)
                      .forEach((row, i) => push(row, String(i + 1)));
                    return targets;
                  }
                  // Simplest possible model, as originally requested: show the
                  // numbered badges while Alt is held, hide it when Alt is
                  // released. `gestureMatches` gates which keydown counts, and
                  // the Alt keyup is what clears the overlay.
                  function show(event) {
                    if (!gestureMatches(ctx, event)) return;
                    setTargets(findTargets());
                    setActive(true);
                  }
                  function onKeyUp(event) {
                    // Hide when Alt is released. ALSO hide when a non-modifier
                    // key is released: for Alt+digit the switch runs through the
                    // native bridge and macOS skips the normal Alt keyup, so the
                    // Alt-release alone would leave the badge stuck. Releasing the
                    // digit means the chord is over either way.
                    if (!event || !isModifierKey(event) || !event.altKey) setActive(false);
                  }
                  function hide() {
                    setActive(false);
                  }
                  window.addEventListener('keydown', show, true);
                  window.addEventListener('keyup', onKeyUp, true);
                  window.addEventListener('blur', hide);
                  window.addEventListener('scroll', () => { if (activeRef.current) setTargets(findTargets()); }, true);
                  window.addEventListener('resize', () => { if (activeRef.current) setTargets(findTargets()); });
                  return () => {
                    window.removeEventListener('keydown', show, true);
                    window.removeEventListener('keyup', onKeyUp, true);
                    window.removeEventListener('scroll', () => { if (activeRef.current) setTargets(findTargets()); }, true);
                    window.removeEventListener('resize', () => { if (activeRef.current) setTargets(findTargets()); });
                  };
                }, []);

                return h(ShortcutHints, { active: activeState[0], targets: targetsState[0] });
              }
            )
          )
        );

        // --- Register commands with DSH's shortcut registry (reference UI +
        //     conflict detection). On Web `resolve` executes the action; on
        //     Desktop it returns `pass` because the registry's DOM dispatch is
        //     native-gated there and the DOM listener below is the executor. ---
        safely('register', () => {
          const shortcuts = getService(ctx, 'shortcuts');
          if (!shortcuts || typeof shortcuts.register !== 'function') return;

          function tryRegister(command, tag) {
            try {
              const off = shortcuts.register(command);
              if (typeof off === 'function') disposers.push(off);
            } catch (error) {
              // One conflicting/reserved command must not take down the rest.
              console.warn('keyboard-shortcuts: could not register', tag, error);
            }
          }

          for (let n = 1; n <= 9; n++) {
            const index = n - 1;
            tryRegister(
              {
                id: 'keyboard.session-' + n,
                label: () => '切换到第 ' + n + ' 个会话 / Switch to session ' + n,
                aliases: ['switch session ' + n, 'goto session ' + n, '切换会话'],
                defaults: defaultsFor('Digit' + n),
                regions: ['page', 'editable'],
                modals: ['sidebar'],
                resolve: () => {
                  // Ask popup open: digits 1..3 select that question's option
                  // instead of switching sessions (the popup is what the user
                  // is deciding on right now). Falls back to session switching
                  // when the popup is closed / has no selectable option.
                  if (index < 3) {
                    const popup = askPopupTargets();
                    if (popup) {
                      return popup.pick(index)
                        ? { status: 'handled', run: () => {} }
                        : { status: 'blocked', reason: '弹窗没有第 ' + n + ' 个选项 / no option ' + n };
                    }
                  }
                  // Desktop: EXECUTE here so the native keyboard bridge can drive
                  // the switch. On this macOS build the digit keydown never
                  // reaches the renderer DOM (dead-key/menu swallow), so the DOM
                  // listener never fires for digits — but the native bridge sees
                  // the chord at the NSEvent layer and calls this resolve. Doing
                  // the work here is what makes Cmd+Alt+digit actually switch.
                  return openSessionAt(ctx, index)
                    ? { status: 'handled', run: () => {} }
                    : { status: 'blocked', reason: '没有第 ' + n + ' 个会话 / no session ' + n };
                }
              },
              'keyboard.session-' + n
            );
          }

          tryRegister(
            {
              id: 'keyboard.ask-submit',
              label: () => '提交/下一题（ask 弹窗）/ Submit or next (ask popup)',
              aliases: ['submit ask', 'ask next', '提交弹窗'],
              defaults: defaultsFor('KeyS'),
              regions: ['page', 'editable'],
              modals: ['sidebar'],
              resolve: () => {
                // Ask popup open: click its primary submit/next button. When
                // the popup is closed or the button is disabled (busy / nothing
                // answered / submit not allowed), do nothing and leave the S
                // key to the browser — this shortcut owns S only inside an open
                // popup.
                return clickSubmitPrimary()
                  ? { status: 'handled', run: () => {} }
                  : { status: 'blocked', reason: '没有可提交的 ask 弹窗 / no ask popup to submit' };
              }
            },
            'keyboard.ask-submit'
          );

          tryRegister(
            {
              id: 'keyboard.focus-composer',
              label: () => '聚焦聊天输入框 / Focus message composer',
              aliases: ['focus composer', 'focus input', '聚焦输入框'],
              defaults: defaultsFor('KeyI'),
              regions: ['page', 'editable'],
              modals: ['sidebar'],
              resolve: (context) => {
                if (desktop) return { status: 'pass' };
                const composer = findComposer();
                if (!composer) return { status: 'blocked', reason: '没有可聚焦的输入框 / no composer' };
                if (context.target === composer || (context.region === 'editable' && composer.contains(context.target))) {
                  return { status: 'pass' };
                }
                return { status: 'handled', run: () => focusComposerEl(composer) };
              }
            },
            'keyboard.focus-composer'
          );
        });

        // --- Desktop executor: a capture-phase DOM listener. This is the only
        //     path that reliably receives plain Alt combos inside the Desktop
        //     shell (the registry's DOM dispatch is native-gated there). ---
        if (desktop) {
          safely('desktop-listener', () =>
            ctx.effect(() => {
              function onKeyDown(event) {
                if (!gestureMatches(ctx, event) || !event.code) return;
                // Skip during IME composition (mirrors the popup's own guard) —
                // the composing keystroke belongs to the text field, not a chord.
                if (event.isComposing || event.keyCode === 229) return;
                let handled = false;
                // KeyI (Alt+I) is a letter, so its keydown reaches the renderer
                // DOM and this listener executes it — the same reliable path.
                // Digits may NOT reach the DOM (native bridge intercepts a bound
                // chord); those are handled by the registered command's `resolve`
                // via the native bridge instead.
                if (event.code === 'KeyI') {
                  handled = focusComposerEl(findComposer());
                } else if (event.code === 'KeyS') {
                  // KeyS (Alt+S) is likewise a letter and reaches the renderer;
                  // inside an open ask popup it submits/advances via the same
                  // unified predicate as the registry resolve.
                  handled = clickSubmitPrimary();
                } else {
                  const digits = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9'];
                  const digit = digits.indexOf(event.code);
                  // Ask popup open: digits 1..3 select that question's option
                  // (same unified predicate as the registry resolve), otherwise
                  // fall back to session switching.
                  if (digit >= 0 && digit < 3) {
                    const popup = askPopupTargets();
                    if (popup) {
                      handled = popup.pick(digit);
                    } else {
                      handled = openSessionAt(ctx, digit);
                    }
                  } else if (digit >= 0) {
                    handled = openSessionAt(ctx, digit);
                  }
                }
                if (handled) {
                  event.preventDefault();
                  event.stopPropagation();
                }
              }
              window.addEventListener('keydown', onKeyDown, true);
              return () => window.removeEventListener('keydown', onKeyDown, true);
            }, 'keyboard-shortcuts: desktop actions')
          );
        }

        return function dispose() {
          disposers.forEach((d) => {
            try {
              if (typeof d === 'function') d();
            } catch (_) {
              /* best-effort teardown */
            }
          });
        };
      }
    };
  }
});
