import { Project, SyntaxKind } from "ts-morph";
import * as fs from "fs";

const project = new Project();
project.addSourceFilesAtPaths("src/**/*.tsx");

const appFile = project.getSourceFileOrThrow("src/App.tsx");
const appFunction = appFile.getFunction("App") || appFile.getDefaultExportSymbol()?.getDeclarations()[0];

if (appFunction) {
    const varDecls = appFunction.getDescendantsOfKind(SyntaxKind.VariableDeclaration);
    let out = "";
    for (const v of varDecls) {
        if (v.getInitializer()?.getText().startsWith("useState")) {
            out += v.getText() + "\n";
        }
    }
    fs.writeFileSync("hooks.txt", out);
}
