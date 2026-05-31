const { Project, SyntaxKind } = require('ts-morph');
const fs = require('fs');

const project = new Project();
const appFile = project.addSourceFileAtPath('src/App.tsx');
const appFunc = appFile.getFunctionOrThrow('App');

let exportedVars = new Set();
for (const stmt of appFunc.getStatements()) {
    if (stmt.getKind() === SyntaxKind.VariableStatement) {
        for (const dec of stmt.getDeclarations()) {
            if (dec.getNameNode().getKind() === SyntaxKind.ArrayBindingPattern) {
                dec.getNameNode().getElements().forEach(el => {
                    if (el.getKind() === SyntaxKind.BindingElement) {
                        exportedVars.add(el.getName());
                    }
                });
            } else {
                exportedVars.add(dec.getName());
            }
        }
    } else if (stmt.getKind() === SyntaxKind.FunctionDeclaration) {
        if (stmt.getName()) exportedVars.add(stmt.getName());
    }
}

// Find the start and end of the App body
const body = appFunc.getBody();
const start = body.getStatements()[0].getStart();
const returnStmt = body.getStatements().find(s => s.getKind() === SyntaxKind.ReturnStatement);
const end = returnStmt.getStart();

const stateBlock = appFile.getFullText().substring(start, end);

const hookCode = `
import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { api } from "../services/api";
import { AgentOrgNode, BacklogItem, KanbanCard, Project, Team, Agent, Message, Task, ProviderConfig, Workspace, Decision, Handoff, CoordinationDetails, WorkSuggestion, TemplateInfo, SubtaskProposal, MissionProgress, ModelCatalogEntry, HuggingFaceModelEntry, PreflightResponse, TensorDetails, DownloadDetails, ActivationDetails, InspectionDetails, ModelDetailsResponse, StorageUsageResponse, SmokeTestResult, BackendStatus, BackendRuntimeConfig } from "../types";

export function useAppStore() {
${stateBlock}

  return {
    ${Array.from(exportedVars).join(',\n    ')}
  };
}
`;

fs.writeFileSync('src/hooks/useAppStore.ts', hookCode);
console.log(`Extracted useAppStore.ts with ${exportedVars.size} vars.`);
