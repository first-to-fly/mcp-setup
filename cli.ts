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
async function setupDirectories(projectDir: string) {
  log(cyan("Setting up directories..."));
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
}

/**
 * Appends entries to .gitignore if they don't exist.
 *
 * @param projectDir - The root directory of the project.
 */
async function updateGitignore(projectDir: string): Promise<void> {
  const gitignorePath = path.join(projectDir, ".gitignore");
  const entriesToAdd = [
    ".browsers/",
    ".browser-use/",
    ".codebase/",
    ".roo/mcp.json",
  ];
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
    await setupDirectories(projectDir);


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
    const { stdout: chromeExtensionDir } = await execa("npx", [
      "--yes",
      "@inkr/browser-tools-mcp@latest",
      "chrome-extension-path",
    ]);

    log(yellow("\n--- Important Next Steps for Browser Tools ---"));
    log(yellow("1. Install the Chrome Extension:"));
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
