import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import partykitConfig from "./partykit.json" with { type: "json"};

// Get the current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the template file
const templatePath = path.join(__dirname, "src/client/template.html");
const templateContent = fs.readFileSync(templatePath, "utf8");

// Generate HTML files
partykitConfig.serve.build.entry.forEach(variant => {
  const htmlContent = templateContent.replace("{{SCRIPT_SRC}}",
      variant.replace("src/client", "dist")
          .replace(".tsx", ".js"));
  const outputPath = variant.replace("src/client", "public")
      .replace(".tsx", ".html");

  // Check if the file exists
  let existingContent = "";
  if (fs.existsSync(outputPath)) {
    existingContent = fs.readFileSync(outputPath, "utf8");
  }

  // Only write if the content has actually changed
  if (existingContent !== htmlContent) {
    fs.writeFileSync(outputPath, htmlContent, "utf8");
    console.log(`Updated: ${outputPath}`);
  } else {
    console.log(`Skipped (no changes): ${outputPath}`);
  }
});

console.log("HTML files generated successfully!");