const { Project, SyntaxKind } = require('ts-morph');
const fs = require('fs');

const project = new Project();
project.addSourceFilesAtPaths("src/**/*.tsx");
const appFile = project.getSourceFileOrThrow("src/App.tsx");
const appFunc = appFile.getFunctionOrThrow("App");

// Find the giant return statement
const returnStmt = appFunc.getStatements().find(s => s.getKind() === SyntaxKind.ReturnStatement);

const returnText = returnStmt.getText();

// We are going to just split this manually based on the string tokens because parsing massive JSX ternaries in ts-morph is painful.
