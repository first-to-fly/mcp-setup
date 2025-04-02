#!/usr/bin/env bun

/**
 * MCP Project Setup Script
 *
 * This script automates the setup process for MCP by:
 * - Checking for required dependencies
 * - Setting up directories
 * - Adding or cloning repositories
 * - Installing dependencies and building components
 * - Installing browser dependencies
 * - Generating configuration files
 */

// Core Node.js imports
import fs from "fs-extra";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

// Third-party dependencies
import chalk from "chalk";
import { execa } from "execa";
import inquirer from "inquirer";

// Constants
const { log } = console;
const { green, red, yellow, cyan } = chalk;

/**
 * Repository configuration for required MCP components
 */
const REPOS = [
  {
    url: "git@github.com:AgentDeskAI/browser-tools-mcp.git",
    name: "browser-tools-mcp",
    path: "submodules/browser-tools-mcp",
  },
  {
    url: "git@github.com:inkr-global/browser-use-mcp.git",
    name: "browser-use-mcp",
    path: "submodules/browser-use-mcp",
  },
  {
    url: "git@github.com:inkr-global/codebase-mcp.git",
    name: "codebase-mcp",
    path: "submodules/codebase-mcp",
  },
];

/**
 * Checks if a command exists in the system PATH.
 *
 * @param command - The command to check.
 * @returns Promise resolving to true if the command exists, false otherwise.
 */
async function commandExists(command: string): Promise<boolean> {
  try {
    const checkCmd: string = os.platform() === "win32" ? "where" : "which";
    await execa(checkCmd, [command], { stdio: "ignore" });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Checks for required prerequisites. Exits if any are missing.
 *
 * @throws Will exit the process if any prerequisites are missing.
 */
async function checkPrerequisites(): Promise<void> {
  log(cyan("Checking prerequisites..."));
  const prerequisites: string[] = ["node", "npm", "git", "python", "uv", "bun"];
  const missing: string[] = [];

  for (const cmd of prerequisites) {
    if (!(await commandExists(cmd))) {
      missing.push(cmd);
    }
  }

  if (missing.length > 0) {
    log(red("Error: The following prerequisites are missing:"));
    missing.forEach((cmd: string) => log(red(`- ${cmd}`)));
    log(yellow("Please install the missing tools and try again."));

    // Provide installation guidance links
    log(yellow("Node.js (includes npm): https://nodejs.org/"));
    log(yellow("Git: https://git-scm.com/"));
    log(yellow("Python: https://www.python.org/"));
    log(yellow("uv (Python env): https://github.com/astral-sh/uv"));
    log(yellow("Bun: https://bun.sh/"));
    process.exit(1);
  }

  log(green("All prerequisites found."));
}

/**
 * Ensures required directories exist relative to the project directory.
 *
 * @param projectDir - The current project directory (cwd).
 * @returns The path to the submodules directory.
 */
async function setupDirectories(projectDir: string): Promise<string> {
  log(cyan("Setting up directories..."));
  const submodulesDir: string = path.join(projectDir, "submodules");
  const rooDir: string = path.join(projectDir, ".roo");

  try {
    // Only ensure .roo exists. Submodules dir handled by git clone/submodule add
    await fs.ensureDir(rooDir);
    log(green(`Ensured directory exists: ${rooDir}`));
  } catch (error) {
    log(red(`Error ensuring .roo directory exists:`));
    log(red(error));
    throw error;
  }
  return submodulesDir;
}

/**
 * Adds the required MCP repositories as Git submodules.
 * If adding as submodules fails, falls back to direct cloning.
 *
 * @param projectDir - The root directory of the project (cwd).
 * @returns Boolean indicating if all submodules were added successfully.
 */
async function addSubmodules(projectDir: string): Promise<boolean> {
  log(cyan("Adding MCP repositories as submodules..."));

  // First, validate if git submodules can be used in this repository
  try {
    // Check if repository is in a valid state for submodules
    await execa("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd: projectDir,
      stdio: "pipe",
    });

    // Touch .gitmodules file if it doesn't exist (prevents "not in working tree" error)
    const gitModulesPath = path.join(projectDir, ".gitmodules");
    if (!(await fs.pathExists(gitModulesPath))) {
      log(yellow("Creating empty .gitmodules file..."));
      await fs.writeFile(gitModulesPath, "");
    }
  } catch (error: any) {
    log(yellow("Git repository is not in a valid state for submodules."));
    log(yellow("Falling back to direct repository cloning..."));
    return false;
  }

  // Track if all submodules were added successfully
  let allSuccessful = true;

  for (const repo of REPOS) {
    const targetPath = path.join(projectDir, repo.path);
    const gitModulesPath = path.join(projectDir, ".gitmodules");
    let isSubmodule = false;

    if (await fs.pathExists(gitModulesPath)) {
      const gitModulesContent = await fs.readFile(gitModulesPath, "utf-8");
      if (gitModulesContent.includes(`path = ${repo.path}`)) {
        isSubmodule = true;
      }
    }

    if ((await fs.pathExists(targetPath)) && isSubmodule) {
      log(yellow(`Submodule ${repo.path} already exists. Skipping add.`));
      continue;
    } else if ((await fs.pathExists(targetPath)) && !isSubmodule) {
      log(
        yellow(
          `Directory ${repo.path} already exists but is not registered as a submodule. Skipping add.`
        )
      );
      continue;
    }

    log(`Adding submodule ${repo.url} at ${repo.path}...`);
    try {
      await execa("git", ["submodule", "add", repo.url, repo.path], {
        cwd: projectDir,
        stdio: "inherit",
      });
      log(green(`Successfully added submodule ${repo.path}.`));
    } catch (error: any) {
      log(red(`Error adding submodule ${repo.url}:`));
      log(red(error.stderr || error.message));

      // Mark as failed but continue with others
      allSuccessful = false;

      // Create parent directory if it doesn't exist
      await fs.ensureDir(path.dirname(targetPath));

      // Try direct clone as fallback for this repo
      log(yellow(`Falling back to direct clone for ${repo.name}...`));
      try {
        await execa("git", ["clone", repo.url, targetPath]);
        log(green(`Successfully cloned ${repo.name} into ${targetPath}.`));
      } catch (cloneError: any) {
        log(red(`Error cloning repository ${repo.url}:`));
        log(red(cloneError.stderr || cloneError.message));
        log(
          yellow(
            "Please ensure network connectivity and necessary permissions (e.g., SSH keys)."
          )
        );
      }
    }
  }

  return allSuccessful;
}

/**
 * Clones the required MCP repositories directly when not using submodules.
 *
 * @param submodulesDir - The target directory to clone into.
 * @throws Will throw an error if cloning fails.
 */
async function cloneRepositories(submodulesDir: string): Promise<void> {
  log(cyan("Cloning MCP repositories directly..."));
  await fs.ensureDir(submodulesDir);

  for (const repo of REPOS) {
    const targetPath: string = path.join(submodulesDir, repo.name);

    if (await fs.pathExists(targetPath)) {
      log(yellow(`Directory ${targetPath} already exists. Skipping clone.`));
      continue;
    }

    log(`Cloning ${repo.url} into ${targetPath}...`);
    try {
      await execa("git", ["clone", repo.url, targetPath]);
      log(green(`Successfully cloned ${repo.name} into ${targetPath}.`));
    } catch (error: any) {
      log(red(`Error cloning repository ${repo.url}:`));
      log(red(error.stderr || error.message));
      log(
        yellow(
          "Please ensure Git is installed, network connectivity, and necessary permissions."
        )
      );
      throw error;
    }
  }
}

/**
 * Appends entries to .gitignore if they don't exist.
 *
 * @param projectDir - The root directory of the project.
 */
async function updateGitignore(projectDir: string): Promise<void> {
  const gitignorePath = path.join(projectDir, ".gitignore");
  const entriesToAdd = [".browsers/", ".codebase/", ".roo/mcp.json"];
  let content = "";

  try {
    if (await fs.pathExists(gitignorePath)) {
      content = await fs.readFile(gitignorePath, "utf-8");
    }

    let needsUpdate = false;
    for (const entry of entriesToAdd) {
      const lines = content.split("\n").map((line) => line.trim());
      if (!lines.includes(entry)) {
        log(cyan(`Adding '${entry}' to .gitignore`));
        content +=
          (content.length > 0 && !content.endsWith("\n") ? "\n" : "") +
          entry +
          "\n";
        needsUpdate = true;
      } else {
        log(yellow(`Entry '${entry}' already exists in .gitignore. Skipping.`));
      }
    }

    if (needsUpdate) {
      await fs.writeFile(gitignorePath, content);
      log(green(".gitignore updated successfully."));
    } else {
      log(green(".gitignore already contains the necessary entries."));
    }
  } catch (error: any) {
    log(red(`Error updating .gitignore at ${gitignorePath}:`));
    log(red(error.message));
    // Non-critical error, don't throw
  }
}

/**
 * Runs install and build steps for required submodules/cloned repos.
 *
 * @param submodulesDir - The root directory containing the submodules/cloned repos.
 * @throws Will throw an error if critical build steps fail.
 */
async function setupSubmodules(submodulesDir: string): Promise<void> {
  log(cyan("Setting up submodules/cloned repos (install/build)..."));

  // Setup browser-tools-mcp
  const browserToolsMcpDir = path.join(
    submodulesDir,
    "browser-tools-mcp",
    "browser-tools-mcp"
  );
  if (!(await fs.pathExists(browserToolsMcpDir))) {
    log(
      yellow(
        `Directory not found: ${browserToolsMcpDir}. Skipping setup. (Did git clone/submodule update run correctly?)`
      )
    );
  } else {
    log(cyan(`Setting up browser-tools-mcp in ${browserToolsMcpDir}...`));
    try {
      log(cyan(`Running 'npm install' in ${browserToolsMcpDir}...`));
      await execa("npm", ["install"], {
        cwd: browserToolsMcpDir,
        stdio: "inherit",
      });
      log(green("npm install completed successfully."));

      log(cyan(`Running 'npm run build' in ${browserToolsMcpDir}...`));
      await execa("npm", ["run", "build"], {
        cwd: browserToolsMcpDir,
        stdio: "inherit",
      });
      log(green("npm run build completed successfully."));
    } catch (error: any) {
      log(red(`Error setting up browser-tools-mcp:`));
      log(red(error.stderr || error.message));
      throw error;
    }
  }

  // Setup browser-tools-server
  const browserToolsServerDir = path.join(
    submodulesDir,
    "browser-tools-mcp",
    "browser-tools-server"
  );
  if (!(await fs.pathExists(browserToolsServerDir))) {
    log(
      yellow(
        `Directory not found: ${browserToolsServerDir}. Skipping setup. (Did git clone/submodule update run correctly?)`
      )
    );
  } else {
    log(cyan(`Setting up browser-tools-server in ${browserToolsServerDir}...`));
    try {
      log(cyan(`Running 'npm install' in ${browserToolsServerDir}...`));
      await execa("npm", ["install"], {
        cwd: browserToolsServerDir,
        stdio: "inherit",
      });
      log(green("npm install completed successfully."));

      log(cyan(`Running 'npm run build' in ${browserToolsServerDir}...`));
      await execa("npm", ["run", "build"], {
        cwd: browserToolsServerDir,
        stdio: "inherit",
      });
      log(green("npm run build completed successfully."));
    } catch (error: any) {
      log(red(`Error setting up browser-tools-server:`));
      log(red(error.stderr || error.message));
      throw error;
    }
  }

  // Setup codebase-mcp
  const codebaseMcpDir = path.join(submodulesDir, "codebase-mcp");
  if (!(await fs.pathExists(codebaseMcpDir))) {
    log(
      yellow(
        `Directory not found: ${codebaseMcpDir}. Skipping setup. (Did git clone/submodule update run correctly?)`
      )
    );
  } else {
    log(cyan(`Setting up codebase-mcp in ${codebaseMcpDir}...`));
    try {
      log(cyan(`Running 'bun install' in ${codebaseMcpDir}...`));
      await execa("bun", ["install"], {
        cwd: codebaseMcpDir,
        stdio: "inherit",
      });
      log(green("bun install completed successfully."));
    } catch (error: any) {
      log(red(`Error setting up codebase-mcp:`));
      log(red(error.stderr || error.message));
      throw error;
    }
  }

  log(green("Submodule/clone setup completed."));
}

/**
 * Installs Playwright's Chromium browser locally and determines its path.
 *
 * @param projectDir - The root directory for the setup (cwd).
 * @returns The path to the installed Chromium executable.
 * @throws Will throw an error if installation fails.
 */
async function installPlaywrightChromium(projectDir: string): Promise<string> {
  log(cyan("Installing Playwright Chromium..."));
  const browsersPath: string = ".browsers";
  const playwrightCommand: string = "npx";
  const playwrightArgs: string[] = [
    "--yes",
    "playwright",
    "install",
    "--with-deps",
    "chromium",
  ];

  try {
    log(
      `Running: PLAYWRIGHT_BROWSERS_PATH="${path.resolve(
        browsersPath
      )}" ${playwrightCommand} ${playwrightArgs.join(" ")}`
    );
    await execa(playwrightCommand, playwrightArgs, {
      env: {
        ...process.env,
        PLAYWRIGHT_BROWSERS_PATH: browsersPath,
      },
      stdio: "inherit",
    });
    log(green("Playwright Chromium installed successfully."));

    // Determine the actual executable path
    const chromiumDir = (await fs.readdir(browsersPath)).find((dir: string) =>
      dir.startsWith("chromium")
    );
    if (!chromiumDir) {
      throw new Error("Could not find Chromium directory within .browsers");
    }
    const chromiumBasePath: string = path.join(browsersPath, chromiumDir);

    let executablePath: string | undefined;
    const platform: string = os.platform();

    if (platform === "darwin") {
      const possiblePaths: string[] = [
        path.join(
          chromiumBasePath,
          "chrome-mac",
          "Chromium.app",
          "Contents",
          "MacOS",
          "Chromium"
        ),
        path.join(chromiumBasePath, "chrome-mac", "chrome"),
      ];
      executablePath = possiblePaths.find((p: string) => fs.existsSync(p));
    } else if (platform === "linux") {
      executablePath = path.join(chromiumBasePath, "chrome-linux", "chrome");
    } else if (platform === "win32") {
      executablePath = path.join(chromiumBasePath, "chrome-win", "chrome.exe");
    } else {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    if (!executablePath || !(await fs.pathExists(executablePath))) {
      log(red(`Could not automatically determine Chromium executable path.`));
      log(yellow(`Looked in: ${path.resolve(chromiumBasePath)}`));
      log(
        yellow(
          `Please find the correct path manually and update .roo/mcp.json if needed.`
        )
      );
      return "__CHROME_PATH_DETECTION_FAILED__";
    }

    const absoluteExecutablePath = path.resolve(executablePath);
    log(green(`Chromium executable found at: ${absoluteExecutablePath}`));
    return absoluteExecutablePath;
  } catch (error: any) {
    log(red("Error installing Playwright Chromium:"));
    log(red(error.stderr || error.message));
    throw error;
  }
}

/**
 * Prompts the user for their Google Gemini API Key.
 *
 * @returns The entered API key.
 */
async function getGeminiApiKey(): Promise<string> {
  log(cyan("Requesting Google Gemini API Key..."));
  log(
    yellow("You can obtain a Gemini API Key from: https://aistudio.google.com/")
  );

  const { apiKey } = await inquirer.prompt([
    {
      type: "password",
      name: "apiKey",
      message: "Please enter your Google Gemini API Key:",
      mask: "*",
      validate: (input: string) => {
        if (!input) {
          return "API Key cannot be empty.";
        }
        if (input.length < 10) {
          return "API Key seems too short.";
        }
        return true;
      },
    },
  ]);
  return apiKey;
}

/**
 * Generates the mcp.json configuration file by replacing template placeholders.
 *
 * @param projectDir - The project directory (cwd).
 * @param chromePath - The detected absolute path to the Chromium executable.
 * @param geminiApiKey - The user's Gemini API key.
 * @throws Will throw an error if file operations or JSON validation fails.
 */
async function generateMcpJson(
  projectDir: string,
  chromePath: string,
  geminiApiKey: string
): Promise<void> {
  log(cyan("Generating .roo/mcp.json in current directory..."));
  const __filename = fileURLToPath(import.meta.url);
  const scriptDir = path.dirname(__filename);
  const templatePath: string = path.join(scriptDir, ".mcp.template.json");
  const targetDir: string = path.join(projectDir, ".roo");
  const targetPath: string = path.join(targetDir, "mcp.json");
  let templateContent: string;

  log(cyan(`Script directory: ${scriptDir}`));
  log(cyan(`Template path: ${templatePath}`));
  log(cyan(`Target directory: ${targetDir}`));
  log(cyan(`Target file path: ${targetPath}`));

  try {
    // Ensure target directory exists
    await fs.ensureDir(targetDir);
    log(green(`Ensured target directory exists: ${targetDir}`));

    // Read the template file
    try {
      templateContent = await fs.readFile(templatePath, "utf-8");
      log(green("Successfully read template file."));
    } catch (readError: any) {
      log(red(`Error reading template file at ${templatePath}:`));
      log(red(readError.message));
      throw new Error(`Failed to read template file: ${templatePath}`);
    }

    // Perform replacements
    log(cyan("Performing placeholder replacements..."));
    const escapedProjectDir: string = projectDir.replace(/\\/g, "\\\\");
    const absoluteChromePath = path.resolve(chromePath);
    const escapedChromePath: string = absoluteChromePath.replace(/\\/g, "\\\\");

    let finalContent: string = templateContent
      .replace(/__PWD__/g, escapedProjectDir)
      .replace(/__CHROME_PATH__/g, escapedChromePath)
      .replace(/__BROWSER_USE_GOOGLE_API_KEY__/g, geminiApiKey)
      .replace(/__CODEBASE_GOOGLE_API_KEY__/g, geminiApiKey);
    log(green("Replacements done."));

    // Validate JSON
    log(cyan("Validating generated JSON..."));
    try {
      JSON.parse(finalContent);
      log(green("Generated content is valid JSON."));
    } catch (jsonError: any) {
      log(
        red(
          "Error: The generated content is not valid JSON after replacements."
        )
      );
      log(red(jsonError.message));
      throw new Error("Failed to generate valid JSON for mcp.json");
    }

    // Write the final file
    log(cyan(`Writing final configuration to: ${targetPath}`));
    try {
      await fs.writeFile(targetPath, finalContent);
      log(green(`Successfully wrote configuration to ${targetPath}`));
    } catch (writeError: any) {
      log(red(`Error writing configuration file to ${targetPath}:`));
      log(red(writeError.message));
      if (writeError.code === "EACCES") {
        log(
          yellow(
            `Permission denied. Please check write permissions for the directory: ${targetDir}`
          )
        );
      }
      throw new Error(`Failed to write configuration file: ${targetPath}`);
    }
  } catch (error: any) {
    log(red(`Error during generateMcpJson execution: ${error.message}`));
    throw error;
  }
}

/**
 * Main function to run the setup process.
 */
async function main(): Promise<void> {
  log(cyan("Starting MCP setup..."));

  const projectDir: string = process.cwd();

  try {
    await checkPrerequisites();
    const submodulesDir: string = await setupDirectories(projectDir);

    // Check if the current directory is a Git repository
    const gitDir = path.join(projectDir, ".git");
    const isGitRepo = await fs.pathExists(gitDir);

    let useSubmodules = false;
    if (isGitRepo) {
      log(
        cyan("Git repository detected. Attempting setup using submodules...")
      );
      useSubmodules = await addSubmodules(projectDir);

      if (useSubmodules) {
        try {
          // Initialize and update submodules
          log(cyan("Initializing and updating submodules..."));
          await execa("git", ["submodule", "update", "--init", "--recursive"], {
            cwd: projectDir,
            stdio: "inherit",
          });
          log(green("Submodules initialized and updated."));

          // Update .gitignore
          log(cyan("Updating .gitignore..."));
          await updateGitignore(projectDir);
        } catch (submoduleError: any) {
          log(
            yellow(
              "Error initializing submodules, falling back to direct cloning..."
            )
          );
          useSubmodules = false;
        }
      }
    }

    // If submodules failed or not a git repo, use direct cloning
    if (!useSubmodules) {
      log(yellow("Setting up using git clone..."));
      await cloneRepositories(submodulesDir);
    }

    // Setup repositories regardless of how they were obtained
    await setupSubmodules(submodulesDir);

    const chromePath: string = await installPlaywrightChromium(projectDir);
    const geminiApiKey: string = await getGeminiApiKey();
    await generateMcpJson(projectDir, chromePath, geminiApiKey);

    log(green("\n🎉 MCP setup completed successfully! 🎉"));
    log(
      cyan(
        `Configuration file written to: ${path.join(
          projectDir,
          ".roo",
          "mcp.json"
        )}`
      )
    );

    // Display next steps
    const browserToolsServerDir = path.join(
      projectDir,
      "submodules",
      "browser-tools-mcp",
      "browser-tools-server"
    );
    const chromeExtensionDir = path.join(
      browserToolsServerDir,
      "chrome-extension"
    );
    const browserConnectorPath = path.join(
      browserToolsServerDir,
      "dist",
      "browser-connector.js"
    );

    log(yellow("\n--- Important Next Steps for Browser Tools ---"));
    log(yellow("1. Run the Browser Tools Server:"));
    log(yellow("   - Open a NEW terminal window."));
    log(
      yellow(
        "   - Start the server with this single command (keep this terminal open):"
      )
    );
    log(cyan(`     node "${browserConnectorPath}"`));
    log(yellow("2. Install the Chrome Extension:"));
    log(yellow("   - Open Chrome/Chromium and go to: chrome://extensions/"));
    log(
      yellow(
        '   - Enable "Developer mode" (usually a toggle in the top right).'
      )
    );
    log(yellow('   - Click "Load unpacked".'));
    log(yellow(`   - Select the following directory:`));
    log(cyan(`     ${chromeExtensionDir}`));
    log(yellow("----------------------------------------------\n"));
    log(
      yellow(
        "You may need to restart your IDE or relevant processes for other MCP server changes to take effect."
      )
    );
  } catch (error: any) {
    log(red("An unexpected error occurred during setup:"));
    log(red(error.message));
    if (error.stderr) {
      log(red("Stderr:"), error.stderr);
    }
    if (error.stdout) {
      log(red("Stdout:"), error.stdout);
    }
    process.exit(1);
  }
}

// Execute the main function
main();
