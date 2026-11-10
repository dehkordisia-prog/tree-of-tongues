# Tree of Tongues

A free, non-commercial, open-source atlas of the world's languages: a zoomable family tree, a time-aware world map and deep language profiles with real voices. Built with Claude Code. "Tree of Tongues" is a working title.

## Create the project (about 30 minutes, one time)
Claude Code needs a paid Claude plan: Pro, Max, Team or Enterprise. Contributors who clone this repo can skip steps 2 and 3.

### 1. Install the tools
macOS, in Terminal:
```bash
curl -fsSL https://claude.ai/install.sh | bash
xcode-select --install
curl -LsSf https://astral.sh/uv/install.sh | sh
```
Then install Node.js (LTS) from nodejs.org, the GitHub CLI from cli.github.com and Google Chrome. Open a new Terminal window and run:
```bash
uv python install 3.12
npm install -g pnpm
```

Windows, in PowerShell:
```powershell
irm https://claude.ai/install.ps1 | iex
winget install Git.Git
winget install OpenJS.NodeJS.LTS
winget install GitHub.cli
winget install Google.Chrome
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```
Close and reopen PowerShell, then run:
```powershell
uv python install 3.12
npm install -g pnpm
```

### 2. Unpack the starter folder
Unzip tree-of-tongues-starter.zip into your projects folder and open a terminal inside it, for example:
```bash
cd ~/Documents/Projects/tree-of-tongues
```

### 3. Publish it on GitHub, public from day one
First time with Git on this computer:
```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```
Commits in a public repo show this email; the private noreply address in your GitHub email settings works too. Then:
```bash
git init -b main
git add .
git commit -m "Starter kit"
gh auth login
gh repo create tree-of-tongues --public --source=. --remote=origin --push
```
Third-party reference images in reference/ stay on your computer: .gitignore keeps them out of the public repo.

### 4. First run of Claude Code
```bash
claude
```
1. Log in with your Claude account in the browser window that opens.
2. Trust the folder, then approve the three project MCP servers: Playwright, Chrome DevTools, Context7.
3. Type /agents (11 agents listed) and /mcp (3 servers connected).
4. Optional: /plugin install frontend-design@claude-plugins-official

Prefer a window to a terminal? The Code tab of the Claude desktop app runs local sessions too: start a new session, choose Local and pick this folder.

### 5. Kick off Phases 0 and 1
Send: `Read KICKOFF_PROMPT.md and follow it.`
Approve the plan Claude proposes. At each milestone, say `Commit and push` so GitHub stays current.

### 6. Every later phase
Start a fresh session for each phase and send `Start Phase 2 from docs/ROADMAP.md` (then 3, 4, 5). A phase ends only when its gate passes.

## License
Code: MIT (LICENSE). Original writing: CC BY-SA 4.0 (LICENSE-CONTENT.md). Third-party data, audio and images keep their own licenses (data/LICENSES.yaml). Non-commercial forever.

## Contributing
See CONTRIBUTING.md.

## What is here
```text
README.md                  these steps
KICKOFF_PROMPT.md          first message to Claude Code
CLAUDE.md                  project instructions, loaded every session
LICENSE                    MIT, for code
LICENSE-CONTENT.md         CC BY-SA 4.0, for original writing
CONTRIBUTING.md            how others can help
.gitignore                 keeps data dumps, secrets and reference images out
.mcp.json                  Playwright, Chrome DevTools, Context7
.claude/settings.json      permissions + content-lint hook
.claude/agents/*.md        11 specialist agents
scripts/lint-content.mjs   blocks em dashes and "Farsi" in UI copy
docs/                      SPEC, DATA_SOURCES, ARCHITECTURE, ROADMAP, CONTENT_STYLE, DECISIONS, PROTOTYPE_PROMPT
reference/                 local-only reference images
```

## Optional: higher Context7 limits
Get a free Context7 API key and `export CONTEXT7_API_KEY=...` in your shell before running `claude`.
