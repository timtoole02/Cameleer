const { Project, SyntaxKind } = require('ts-morph');
const fs = require('fs');

const project = new Project();
const appFile = project.addSourceFileAtPath('src/App.tsx');
const appFunc = appFile.getFunctionOrThrow('App');

// Find all extracted variables from useAppStore
let exportedVars = [];
for (const stmt of appFunc.getStatements()) {
    if (stmt.getKind() === SyntaxKind.VariableStatement) {
        for (const dec of stmt.getDeclarations()) {
            if (dec.getNameNode().getKind() === SyntaxKind.ArrayBindingPattern) {
                dec.getNameNode().getElements().forEach(el => {
                    if (el.getKind() === SyntaxKind.BindingElement) {
                        exportedVars.push(el.getName());
                    }
                });
            } else {
                exportedVars.push(dec.getName());
            }
        }
    } else if (stmt.getKind() === SyntaxKind.FunctionDeclaration) {
        if (stmt.getName()) exportedVars.push(stmt.getName());
    }
}

// Remove all statements before the return
const body = appFunc.getBody();
const statements = body.getStatements();
const returnStmtIndex = statements.findIndex(s => s.getKind() === SyntaxKind.ReturnStatement);

for (let i = returnStmtIndex - 1; i >= 0; i--) {
    statements[i].remove();
}

// Insert the destructuring statement
appFunc.insertStatements(0, `const { ${exportedVars.join(', ')} } = useAppStore();`);

// Add the import
appFile.addImportDeclaration({
    namedImports: ['useAppStore'],
    moduleSpecifier: './hooks/useAppStore'
});

appFile.saveSync();
console.log('App.tsx updated!');
