import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";


/**
 * Retrieves all .tsx files from a specified directory recursively.
 * @param dirPath - The base directory to search.
 * @returns An array of file paths.
 */
function getEntryFiles(dirPath) {
  const files = [];

  const items = fs.readdirSync(dirPath, { withFileTypes: true, recursive: false });

  for (const item of items) {
    const fullPath = path.join(dirPath, item.name);
    if (item.isFile() && item.name.endsWith(".tsx")) {
      files.push(fullPath);
    }
  }

  return files;
}


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define the path to the template file
const templatePath = path.join(__dirname, "src/client/template.html");

// Read the raw template content
const templateContent = fs.readFileSync(templatePath, "utf8");

// Generate an 8-character random hex string for the build version
const buildHash = crypto.randomBytes(4).toString("hex");

// Generate HTML files
getEntryFiles("src/client").forEach((variant) => {
  // Format the script source path for the current variant
  const scriptSrc = variant.replace("src/client", "dist").replace(".tsx", ".js");

  // Replace both the script source and all instances of the build hash placeholder
  const htmlContent = templateContent
    .replace("{{SCRIPT_SRC}}", scriptSrc)
    .replace(/\{\{BUILD_HASH\}\}/g, buildHash);

  // Format the final output path for the HTML file
  const outputPath = variant.replace("src/client", "public").replace(".tsx", ".html");

  // Check if the file exists and read its current content
  let existingContent = "";
  if (fs.existsSync(outputPath)) {
    existingContent = fs.readFileSync(outputPath, "utf8");
  }

  // Only write if the content has actually changed
  if (existingContent !== htmlContent) {
    fs.writeFileSync(outputPath, htmlContent, "utf8");
    console.log(`Updated: ${outputPath} (Hash: ${buildHash})`);
  } else {
    console.log(`Skipped (no changes): ${outputPath}`);
  }
});

console.log("HTML files generated successfully!");
