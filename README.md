# MCP Setup

A streamlined CLI tool to automate the setup of MCP (Multi-Component Platform) servers, including browser tools, extensions, and dependencies.

## Overview

`@first-to-fly/mcp-setup` simplifies the process of setting up an MCP development environment by automating the installation and configuration of required components. It handles repository management, dependency installation, browser setup, and configuration file generation.

## Features

- ✅ Dependency installation and build process automation
- ✅ Playwright Chromium browser installation
- ✅ Configuration file generation
- ✅ Cross-platform support (Windows, macOS, Linux)
- ✅ Intelligent error handling and recovery

## Installation & Usage

You can run this tool directly using `npx` without installing it locally:

```bash
npx @first-to-fly/mcp-setup
```

Or if you prefer to install it globally:

```bash
npm install -g @first-to-fly/mcp-setup
mcp-setup
```

## Prerequisites

The following tools need to be installed on your system:

- Node.js & npm
- Git
- Python
- uv (Python environment manager)
- Bun

The script will check for these dependencies and provide installation guidance if any are missing.

## What It Does

When you run this tool, it performs the following actions:

1. **Prerequisites Check** - Verifies all required tools are installed
2. **Directory Setup** - Creates necessary directories
3. **Dependency Installation** - Installs and builds all required dependencies
4. **Browser Setup** - Installs Playwright Chromium
5. **Configuration** - Generates the `.roo/mcp.json` configuration file

After setup is complete, the tool provides instructions for running the Browser Tools Server and installing the Chrome extension.

## Requirements

- **API Key**: You'll need a Google Gemini API key, which you can obtain from [Google AI Studio](https://aistudio.google.com/)

## Troubleshooting

### Browser Installation

If the Chromium browser path cannot be automatically detected, you may need to manually update the path in the generated `.roo/mcp.json` file.

### SSH Keys

For private repositories, ensure your SSH keys are properly set up for GitHub access. The tool uses SSH URLs for repository access.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add some amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request
