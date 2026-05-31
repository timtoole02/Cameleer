import { Project, SyntaxKind } from "ts-morph";
import * as fs from "fs";

const project = new Project();
project.addSourceFilesAtPaths("src/**/*.tsx");
project.addSourceFilesAtPaths("src/**/*.ts");

const appFile = project.getSourceFileOrThrow("src/App.tsx");
const typesFile = project.getSourceFileOrThrow("src/types.ts");

const interfaces = appFile.getInterfaces();
console.log(`Found ${interfaces.length} interfaces in App.tsx`);

let extractedCount = 0;
for (const iface of interfaces) {
    const name = iface.getName();
    // Check if it already exists in types.ts
    if (!typesFile.getInterface(name)) {
        console.log(`Moving ${name} to types.ts...`);
        typesFile.addInterface({
            name: name,
            isExported: true,
            properties: iface.getProperties().map(p => ({
                name: p.getName(),
                type: p.getTypeNode()?.getText() || "any",
                hasQuestionToken: p.hasQuestionToken(),
            }))
        });
        extractedCount++;
    }
    iface.remove();
}

appFile.saveSync();
typesFile.saveSync();
console.log(`Successfully moved ${extractedCount} interfaces.`);
