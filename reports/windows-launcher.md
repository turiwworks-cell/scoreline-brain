# Scoreline — one-click Windows review launcher

Branch: `codex/part-20-moments`.
Functional commit: `378736e4cf1f43b4d47a37302d6f6f631b64c7bf`.
[Windows validation run 37191573866](https://github.com/turiwworks-cell/scoreline-brain/actions/runs/37191573866): **success**.

## Delivered behavior

Double-click `Open-Scoreline.cmd` beside `package.json` after extracting the project ZIP.
It runs `scripts/Start-Scoreline.ps1` with a process-scoped execution policy.
The script resolves its own project directory, checks Node/npm, installs locked dependencies
when necessary, and runs local Vite with the browser opening at `/?demo`.
A dependency stamp includes package.json, package-lock.json and Node version, so normal
subsequent launches reuse the install. Dependency or Node changes cause a new install.
The server binds to loopback. If the preferred port is occupied, Vite chooses another.

The server console stays visible. Closing it or pressing Ctrl+C ends the session.
Errors remain visible in the CMD window. No permanent execution-policy changes, deployment,
merge, Part 21 work or application/design changes are included.
The application still uses its separately loaded Rive/WASM/photos and existing routes.
[Persian quick-start instructions](../docs/QUICK-START.fa.md).

## Checks actually executed

GitHub Actions `windows-latest`, Node 22, Windows PowerShell and the real CMD wrapper:
- PowerShell syntax parsing.
- First launch from a project directory containing spaces and a different working directory;
  real npm installation and Vite server startup succeeded.
- HTTP 200 for the demo page, both production Rive files, local WASM and the transformed
  application entry.
- Second launch reused dependencies; the dependency stamp timestamp was unchanged.
- An owned TCP listener occupied port 5179; the launcher successfully served the app at 5180.
- Removing Node from the child process PATH produced actionable installation guidance
  and a nonzero exit rather than a hung launcher.
- The workflow stopped only the process trees it created; logs were retained in the
  `scoreline-windows-launcher` artifact.

The automated launch used `-NoBrowser`, so no interactive desktop browser opening is
claimed as observed. Normal double-click uses Vite's documented `--open /?demo` option.
The existing signed-export/browser checks remain as recorded in
[Part 20 acceptance](part20-live-acceptance.md); they were not needlessly rerun for a launcher.

The current local execution backend remained unavailable with
`managed networking requires the elevated Windows sandbox backend`.
These launcher results were executed on the Windows CI runner, not claimed as local tests.
