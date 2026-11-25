# BANNR: How to deliver code changes (guide for future conversations)

Give this file to a new chat together with BANNR-DEV-NOTE.md. It describes exactly how updates were delivered in the first conversation, so they keep working the same way.

The user works on **Windows, in Git Bash**, inside the `bannr` folder. After every change they run `npm run check` and `npm run test:e2e`, then commit and push.

The project is on GitHub: **https://github.com/endlessmira/BANNR** (branch `master`, remote `origin`). Every tested change is pushed there.

---

## 1. Two delivery formats

| Size of change | Format |
|---|---|
| Larger change (new files, several edits, new tests) | **Bash update script inside an HTML artifact** with Download / Copy buttons |
| Small fix (a few lines) | **Node patch** pasted straight into Git Bash (section 5) |

## 2. The HTML artifact (larger changes)

Rules that must never be broken:

1. **The script lives in a textarea**: `<textarea id="script" readonly wrap="off">`. Do not use a script element with type text/plain; it breaks as soon as the payload contains a closing script tag.
2. **Escape two characters inside the textarea, and nothing else:** `&` becomes `&amp;` and `<` becomes `&lt;`. The browser turns them back, so the downloaded script is exact.
3. **Never put three backticks anywhere in the artifact.** They close the chat's code block early and the artifact comes out **blank**. Show code examples inside the payload as indented text instead.
4. **Never put a literal HTML doctype line in the payload,** and never a literal closing textarea tag. The chat splits messages at a doctype line. Escaping rule 2 already handles both.
5. **Inside TypeScript or JS strings in the payload,** write closing script tags as `<\/script>`. JS reads it as the same string, and it can't end anything early.
6. **Keep each artifact under about 1,000 lines.** Bigger ones timed out or came out blank. Split the work into parts, for example 4a-1 and 4a-2, each installable and testable on its own.
7. **The page checks itself:** it shows "✔ Complete" only if the script ends with the line `exit $STATUS`. Always end the script with that line.
8. **Download is the safest way to save it:** the file is saved with LF line endings. Copy-pasted scripts on Windows can end up with CRLF and fail with `$'\r': command not found`.

### Template

Replace NAME, and put the escaped script where shown.

    <!DOCTYPE html>
    <html lang="en">
    <head>
    <meta charset="utf-8">
    <title>BANNR · setup-NAME.sh</title>
    <style>
    body{margin:0;font-family:system-ui,sans-serif;background:#111113;color:#ececf1}
    header{position:sticky;top:0;display:flex;gap:10px;align-items:center;padding:12px 16px;background:#1b1b1f}
    h1{font-size:15px;margin:0 auto 0 0}
    button{padding:8px 14px;border:0;border-radius:6px;background:#f2a902;color:#111;font-weight:700;cursor:pointer}
    button.secondary{background:transparent;color:#ececf1;border:1px solid #2c2c32}
    #check,#status{font-size:12px;font-weight:700}
    textarea{display:block;width:100%;height:calc(100vh - 62px);box-sizing:border-box;border:0;padding:16px;background:#111113;color:#cfcfd6;font:12px/1.5 monospace;white-space:pre;resize:none}
    </style>
    </head>
    <body>
    <header>
    <h1>setup-NAME.sh</h1>
    <span id="check"></span><span id="status"></span>
    <button class="secondary" id="copy">Copy</button>
    <button id="download">Download setup-NAME.sh</button>
    </header>
    <textarea id="script" spellcheck="false" readonly wrap="off">#!/usr/bin/env bash
    ... THE SCRIPT, with & written as &amp; and < written as &lt; ...
    exit $STATUS
    </textarea>
    <script>
    var ta = document.getElementById('script'), st = document.getElementById('status'), ck = document.getElementById('check');
    var text = ta.value.replace(/\r\n/g, '\n');
    var ok = /exit \$STATUS\s*$/.test(text);
    ck.textContent = ok ? '✔ Complete' : '⚠ INCOMPLETE: do not use';
    ck.style.color = ok ? '#7ee787' : '#ff8a8d';
    document.getElementById('copy').onclick = function () {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { st.textContent = 'Copied ✔'; });
      else { ta.focus(); ta.select(); st.textContent = 'Press Ctrl/Cmd+C'; }
    };
    document.getElementById('download').onclick = function () {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type: 'text/x-sh' }));
      a.download = 'setup-NAME.sh';
      document.body.appendChild(a); a.click(); a.remove();
    };
    </script>
    </body>
    </html>

## 3. The bash update script

Skeleton (shown here unescaped; escape it when it goes into the artifact):

    #!/usr/bin/env bash
    # BANNR: what this update does
    # Run INSIDE your bannr folder:  bash setup-NAME.sh
    set -euo pipefail

    # 1) Right folder?
    if [ ! -f package.json ] || ! grep -q '"name": "bannr"' package.json || [ ! -d src/renderer ]; then
      echo "✖ Run this inside your bannr project folder." >&2; exit 1
    fi
    # 2) Previous step installed? (check a file the previous step created)
    if [ ! -f src/path/created/by/previous/step.ts ]; then
      echo "✖ Install the previous update first." >&2; exit 1
    fi
    # 3) Uncommitted changes? Warn and ask.
    if command -v git >/dev/null 2>&1 && [ -d .git ]; then
      if [ -n "$(git status --porcelain -- . ':(exclude)setup-*.sh')" ]; then
        echo "⚠ You have uncommitted changes. Commit first: git add -A, then git commit -m \"...\""
        ans=""
        read -r -p "Continue anyway? [y/N] " ans || true
        [ "$ans" = "y" ] || [ "$ans" = "Y" ] || exit 1
      fi
    fi

    echo "▶ Updating BANNR in $(pwd)"
    write() { mkdir -p "$(dirname "$1")"; cat > "$1"; echo "  + $1"; }

    # 4) New files, or files replaced completely
    write src/path/file.ts <<'__BANNR_EOF__'
    ...file content...
    __BANNR_EOF__

    # 5) Edits to existing files: Node patch (section 4)
    cat > .bannr-patch.cjs <<'__BANNR_EOF__'
    ...patch() function and calls...
    __BANNR_EOF__
    node .bannr-patch.cjs
    rm -f .bannr-patch.cjs

    # 6) Tests that come with the change
    write src/path/feature.test.ts <<'__BANNR_EOF__'
    ...
    __BANNR_EOF__
    write tests/e2e/feature.spec.ts <<'__BANNR_EOF__'
    ...
    __BANNR_EOF__

    # 7) Finish
    echo ""
    echo "✔ Files written."
    [ -d node_modules ] || { echo "▶ node_modules missing, installing…"; npm install; }
    STATUS=0
    echo "▶ Type check + unit tests…"
    if npm run check; then echo "✔ Type check and tests passed"; else echo "✖ Checks FAILED"; STATUS=1; fi
    if [ "$STATUS" -eq 0 ]; then
      echo "🎉 Installed. Start the app with:  npm run dev"
      echo "   Browser tests:  npm run test:e2e"
    else
      echo "⚠ Some checks failed. Copy the output above and share it so it can be fixed."
    fi
    exit $STATUS

Notes:
- **Always quote the heredoc delimiter** (`'__BANNR_EOF__'`), so bash leaves `$`, backticks and backslashes in the content alone.
- **Use `write` only for new files, or for files whose current content you know exactly.** For everything else, patch.
- **Name scripts `setup-NAME.sh`.** `setup-*.sh` is in .gitignore, so the scripts never end up in commits.
- **New npm dependencies:** install them in the script with `node -e "require.resolve('pkg')" || npm install pkg@^x`.

## 4. The patch function (find and replace)

    const fs = require('fs');
    // Each pair: [exact current text, new text]. Skipped if already applied, so re-running is safe.
    function patch(f, pairs) {
      let s = fs.readFileSync(f, 'utf8');
      for (const [a, b] of pairs) {
        if (s.includes(b)) continue;
        if (!s.includes(a)) { console.error('✖ ' + f + ': expected text not found:\n    ' + a); process.exit(1); }
        s = s.split(a).join(b);
      }
      fs.writeFileSync(f, s);
      console.log('  ~ ' + f);
    }
    patch('src/some/file.ts', [
      ["exact old text", "exact new text"],
    ]);

Rules:
- **The old text must match the current file exactly,** including spaces and line breaks. If you don't have the file, ask the user to run `cat path/to/file` and paste the output first, or read it from the GitHub repository if you can open it. Never guess.
- **Make each patch safe to run twice:** the new text should be unique, so a second run sees it and skips. When appending a block to the end of a file, check for a marker first (for example with `grep -q` in bash, or `s.includes('marker')` in Node).
- **Fail loudly.** Never skip a patch silently when the expected text isn't found.
- **Strings inside the patch:** use template literals or String.raw for long snippets. Watch for quotes that clash with the outer string.

## 5. Small fixes (no artifact)

Pasted straight into Git Bash, in a normal code block in the chat:

    cat > .bannr-fix.cjs <<'EOF'
    const fs = require('fs');
    function patch(f, pairs) { ...same as section 4... }
    patch('src/file.ts', [["old", "new"]]);
    EOF
    node .bannr-fix.cjs && rm -f .bannr-fix.cjs

- **One-liners** (`node -e "..."`) are fine for a single replacement.
- **Use this only when the fix is short** and contains no doctype line and no three backticks. Otherwise use an artifact.

## 6. Tests to include with every change

- **Unit tests** (Vitest, `src/**/*.test.ts`) cover the logic.
  - **Component runtimes:** run the vanilla JS string against a minimal fake window, document and bannr, with `new Function('window', 'document', 'bannr', code)`, and fake timers and requestAnimationFrame.
- **Browser tests** (Playwright, `tests/e2e/*.spec.ts`) use the helpers in `tests/e2e/helpers.ts`: `newProject(page)`, `addAt(page, 'Add text', x, y)`, `field(page, 'X')`.
- **Count elements by their own `data-*` attributes,** never by class names that can match more than one element (for example `bcc-dot` vs `bcc-dots`).
- **Use made-up names such as `not-a-component`** for "unknown" cases, because real names may become real components later.
- **Work out expected pixels from the settings and the zoom.** Fit zoom makes the canvas smaller than 100%, and % settings depend on the banner size.
- **When a change renames or moves something,** update the existing tests in the same script.
- **Tell the user the expected total number of browser tests** after the change.

## 7. What to tell the user after each delivery

1. **Saving the file:** download `setup-NAME.sh` into the `bannr` folder, after checking that the header says "✔ Complete".
2. **Commands,** each in its own code block, because the user types them one at a time:
   - `bash setup-NAME.sh`
   - `npm run dev`
   - `npm run test:e2e`
   - then, **only if all tests pass**, commit and push:
     - `git add -A`
     - `git commit -m "..."` (suggest a short message)
     - `git push`
3. **What to try** in the app.
4. **Things to know:** limitations and choices made on the user's behalf.
5. **Never put `bash` in front of git commands.** Always end the delivery with the `git push` step, so the GitHub repository (https://github.com/endlessmira/BANNR) stays up to date. If a test fails, tell the user not to commit or push until it is fixed.
6. **Say that the script hasn't been run by you,** and that it runs the type check and tests when it finishes.

The same applies to small fixes (section 5): after the fix, `npm run check` and `npm run test:e2e`, then `git add -A`, `git commit -m "..."` and `git push`.

When the user pastes an error: identify whether the app or the test is wrong, explain why in plain words, and give the smallest fix (usually a small patch per section 5).

## 8. Prompt to paste into a new chat

> I'm continuing the BANNR project. Repository: https://github.com/endlessmira/BANNR. Attached: BANNR-DEV-NOTE.md (current state, decisions, backlog), BANNR-PATCH-GUIDE.md (how to deliver changes), the original brief, and (if needed) bannr-core.txt / bannr-components.txt with the current code. The dev note wins where it disagrees with the brief. Deliver every change exactly as BANNR-PATCH-GUIDE.md describes, and end every delivery with the git add / commit / push steps after the tests pass. Ask me to `cat` any file you need to patch and don't have. Next task: [describe it].
