const fs = require('fs');

const code = fs.readFileSync('src/App.tsx', 'utf8');

// Find start and end of state declarations
const startIdx = code.indexOf('const [activeTab, setActiveTab]');
const endIdx = code.indexOf('return (', startIdx); // The main return statement

if (startIdx === -1 || endIdx === -1) {
  console.log("Could not find state block");
  process.exit(1);
}

const stateBlock = code.substring(startIdx, endIdx);

// We need to capture all declared variables to return them
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const ast = parser.parse(stateBlock, {
  sourceType: 'module',
  plugins: ['jsx', 'typescript']
});

let exportedVars = new Set();
traverse(ast, {
  VariableDeclarator(path) {
    if (path.node.id.type === 'Identifier') {
      exportedVars.add(path.node.id.name);
    } else if (path.node.id.type === 'ArrayPattern') {
      path.node.id.elements.forEach(el => {
        if (el && el.type === 'Identifier') exportedVars.add(el.name);
      });
    }
  },
  FunctionDeclaration(path) {
    if (path.node.id) exportedVars.add(path.node.id.name);
  }
});

// Create useAppStore hook
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
console.log(`Generated useAppStore.ts with ${exportedVars.size} exported variables.`);
