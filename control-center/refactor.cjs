const { Project, SyntaxKind } = require('ts-morph');
const fs = require('fs');

const project = new Project();
project.addSourceFilesAtPaths("src/**/*.tsx");
project.addSourceFilesAtPaths("src/**/*.ts");

const appFile = project.getSourceFileOrThrow("src/App.tsx");
const appFunc = appFile.getFunctionOrThrow("App");

// Get all statements in App
const stmts = appFunc.getStatements();

console.log(`App has ${stmts.length} statements.`);

// We want to find all VariableStatements that are state declarations.
const stateVars = [];
for (const stmt of stmts) {
    if (stmt.getKind() === SyntaxKind.VariableStatement) {
        const text = stmt.getText();
        if (text.includes("useState")) {
            const decs = stmt.getDeclarations();
            for (const dec of decs) {
                if (dec.getInitializer() && dec.getInitializer().getText().includes("useState")) {
                    const elements = dec.getNameNode().getElements();
                    if (elements && elements.length === 2) {
                        stateVars.push(elements[0].getText());
                        stateVars.push(elements[1].getText());
                    }
                }
            }
        }
    }
}
console.log(`Found ${stateVars.length} state variables/setters.`);

// Print them out so I can see what they are:
fs.writeFileSync('states.json', JSON.stringify(stateVars, null, 2));

