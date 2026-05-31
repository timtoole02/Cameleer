import { Project } from "ts-morph";

const project = new Project();
project.addSourceFilesAtPaths("src/**/*.tsx");
project.addSourceFilesAtPaths("src/**/*.ts");

const appFile = project.getSourceFileOrThrow("src/App.tsx");
const typesFile = project.getSourceFileOrThrow("src/types.ts");

const allTypes = typesFile.getInterfaces().map(i => i.getName());

// Check if we already have an import from "./types"
const imports = appFile.getImportDeclarations();
let typesImport = imports.find(i => i.getModuleSpecifierValue() === "./types" || i.getModuleSpecifierValue() === "../types");

if (!typesImport) {
    typesImport = appFile.addImportDeclaration({
        moduleSpecifier: "./types",
        namedImports: []
    });
}

const existingNamedImports = typesImport.getNamedImports().map(ni => ni.getName());

for (const t of allTypes) {
    if (!existingNamedImports.includes(t)) {
        typesImport.addNamedImport(t);
    }
}

appFile.saveSync();
console.log("Fixed imports in App.tsx");
