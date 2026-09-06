# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security reports. Email the maintainer
or open a private security advisory on GitHub. We aim to acknowledge reports
within 72 hours.

## Supported versions

WELD is pre-1.0. Only the latest commit on `main` receives security fixes.

## Security model (what we deliberately do)

WELD's core promise involves running **generated, untrusted game code**. That
drives hard rules, enforced from M0:

- **Generated code is untrusted.** It never executes inside the API process.
  Games run in a sandboxed iframe (`sandbox="allow-scripts"`) with no
  same-origin access to the parent app; later milestones add isolated
  browser/container execution with CPU/memory/time/network limits.
- **The test bridge is read-only.** `window.__WELD__` exposes structured game
  *state* only — no mutation, no arbitrary code execution.
- **Secrets are never committed.** `.env` is git-ignored; only `.env.example`
  (with placeholder values) is tracked. Provider keys, tokens, cookies, and
  browser profiles must never enter the repo.
- **Prompt-injection hygiene.** Game files, assets, screenshots, web content,
  tool output, and model output are treated as *data*, never as instructions to
  the agent or the API.
- **Least exposure.** The browser never talks to the internal API directly;
  server components proxy reads. Internal URLs are not shipped to the client.

## What to avoid when contributing

- Don't add endpoints that execute arbitrary code.
- Don't widen iframe sandbox permissions without a documented reason.
- Don't log secrets or include them in error messages.
- Don't add "phone-home" analytics to the OSS/local version.
