import { copy, ensureDir } from "fs-extra";
import { execa } from "execa";
import path from "path";

async function build() {
  const distDir = path.resolve("./dist");

  try {
    // Ensure dist directory exists
    await ensureDir(distDir);
    console.log("Ensured dist directory exists.");

    // Run Bun build
    await execa(
      "bun",
      ["build", "./cli.ts", "--outdir", "./dist", "--target", "bun"],
      { stdio: "inherit" }
    );
    console.log("Build completed.");

    // Copy essential files to dist
    const filesToCopy = [
      { src: ".mcp.template.json", dest: "dist/.mcp.template.json" },
      { src: "package.json", dest: "dist/package.json" },
      { src: "README.md", dest: "dist/README.md" },
    ];

    for (const { src, dest } of filesToCopy) {
      const srcPath = path.resolve(src);
      const destPath = path.resolve(dest);
      await copy(srcPath, destPath);
      console.log(`Copied ${src} to ${dest}.`);
    }

    console.log("Build and copy process completed successfully.");
  } catch (error) {
    console.error("Build failed:", error);
    process.exit(1);
  }
}

build();
