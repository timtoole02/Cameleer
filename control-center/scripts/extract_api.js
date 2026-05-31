import { Project, SyntaxKind } from "ts-morph";
import * as fs from "fs";

const project = new Project();
project.addSourceFilesAtPaths("src/**/*.tsx");
project.addSourceFilesAtPaths("src/**/*.ts");

const appFile = project.getSourceFileOrThrow("src/App.tsx");
let apiFile = project.getSourceFile("src/services/api.ts");
if (!apiFile) {
    apiFile = project.createSourceFile("src/services/api.ts", `import { invoke } from "@tauri-apps/api/core";\n\nexport const api = {\n};\n`);
}

const apiObject = apiFile.getVariableDeclarationOrThrow("api").getInitializerIfKindOrThrow(SyntaxKind.ObjectLiteralExpression);

// Find all CallExpressions
const callExpressions = appFile.getDescendantsOfKind(SyntaxKind.CallExpression);
let extractedCommands = new Set();
let replacements = [];

for (const callExpr of callExpressions) {
    const expr = callExpr.getExpression();
    if (expr.getText() === "invoke") {
        const args = callExpr.getArguments();
        if (args.length > 0 && args[0].getKind() === SyntaxKind.StringLiteral) {
            const commandName = args[0].getLiteralText();
            const camelCommand = commandName.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
            
            let hasArgs = args.length > 1;
            
            if (!extractedCommands.has(camelCommand)) {
                extractedCommands.add(camelCommand);
                let funcBody = `return invoke("${commandName}"${hasArgs ? ", payload" : ""});`;
                let funcDecl = `${camelCommand}: async (${hasArgs ? "payload?: any" : ""}) => {\n    ${funcBody}\n},`;
                apiObject.addPropertyAssignment({
                    name: camelCommand,
                    initializer: `async (${hasArgs ? "payload?: any" : ""}) => { ${funcBody} }`
                });
            }
            
            // Record replacement
            replacements.push({
                node: callExpr,
                text: `api.${camelCommand}(${hasArgs ? args[1].getText() : ""})`
            });
        }
    }
}

// Add api import to App.tsx
appFile.addImportDeclaration({
    moduleSpecifier: "./services/api",
    namedImports: ["api"]
});

// Remove invoke import from App.tsx if it's unused (actually we just leave it or remove it)
const imports = appFile.getImportDeclarations();
for (const imp of imports) {
    if (imp.getModuleSpecifierValue() === "@tauri-apps/api/core") {
        const named = imp.getNamedImports().find(n => n.getName() === "invoke");
        if (named) {
            named.remove();
        }
    }
}

apiFile.saveSync();
console.log(`Extracted ${extractedCommands.size} api calls.`);

// Due to AST replacement complexities, we'll write a regex replacer for the actual text in App.tsx
let appContent = fs.readFileSync("src/App.tsx", "utf8");
let matches = [...appContent.matchAll(/invoke\(\s*"([^"]+)"\s*(?:,\s*(\{.*?\}|[a-zA-Z0-9_]+))?\s*\)/gs)];

let newAppContent = appContent;
let uniqueNames = new Set();

matches.forEach(match => {
    let fullMatch = match[0];
    let commandName = match[1];
    let camelCommand = commandName.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
    let payload = match[2];
    
    let replacement = payload ? `api.${camelCommand}(${payload})` : `api.${camelCommand}()`;
    newAppContent = newAppContent.replace(fullMatch, replacement);
});

fs.writeFileSync("src/App.tsx", newAppContent);
console.log("Replaced API calls in App.tsx");

