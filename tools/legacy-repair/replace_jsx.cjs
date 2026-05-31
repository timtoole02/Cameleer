const fs = require('fs');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');

const code = fs.readFileSync('src/App.tsx', 'utf8');

const ast = parser.parse(code, {
  sourceType: 'module',
  plugins: ['jsx', 'typescript']
});

traverse(ast, {
  ConditionalExpression(path) {
    const test = path.node.test;
    if (test.type === 'BinaryExpression' && test.left.name === 'activeTab' && test.right.type === 'StringLiteral') {
      const tabName = test.right.value;
      const consequent = path.node.consequent;
      
      if (consequent.type === 'JSXElement' || consequent.type === 'JSXFragment' || consequent.type === 'LogicalExpression') {
         const { code: jsxCode } = generate(consequent);
         if (jsxCode.length > 500) {
            // Replace the consequent with <TabNameTab {...state} />
            const prop = t.jsxSpreadAttribute(t.identifier('state'));
            const componentName = tabName + "Tab";
            const openingElem = t.jsxOpeningElement(t.jsxIdentifier(componentName), [prop], true);
            const jsxElem = t.jsxElement(openingElem, null, [], true);
            
            path.get('consequent').replaceWith(jsxElem);
         }
      }
    }
  }
});

let newCode = generate(ast).code;

const imports = `
import { dashboardTab as DashboardTab } from './components/tabs/dashboardTab';
import { kanbanTab as KanbanTab } from './components/tabs/kanbanTab';
import { skillsTab as SkillsTab } from './components/tabs/skillsTab';
import { channelsTab as ChannelsTab } from './components/tabs/channelsTab';
import { filesTab as FilesTab } from './components/tabs/filesTab';
import { missionsTab as MissionsTab } from './components/tabs/missionsTab';
import { agentsTab as AgentsTab } from './components/tabs/agentsTab';
import { modelsTab as ModelsTab } from './components/tabs/modelsTab';
`;

// Insert imports after useAppStore
newCode = newCode.replace(/import \{ useAppStore \} from '\.\/hooks\/useAppStore';/, `import { useAppStore } from './hooks/useAppStore';\n${imports}`);

// Rename the destructured state variable to state to pass it down cleanly:
// Oh, but we already destructured 314 variables! `const { ... } = useAppStore();`
// To pass `{...state}` down, we need a `const state = useAppStore();`
// I can just pass the variables implicitly, but `{...state}` needs `state`.
// I will just add `const state = useAppStore();` alongside the destructuring!
newCode = newCode.replace(/const \{.*?\} = useAppStore\(\);/, `const state = useAppStore();\n  const { activeTab, activeOrgNode, selectedAgentId, isStartingOrLoading, agents, selectedKanbanTask, setCompletionError, setIsCompletingTask, isTaskModalOpen, kanbanView, setIsTaskModalOpen, taskTitle, setTaskTitle, taskDesc, setTaskDesc, taskOwner, setTaskOwner, taskPriority, setTaskPriority, recommendAgentForTask, taskAcceptanceCriteria, setTaskAcceptanceCriteria, taskRequiredFiles, setTaskRequiredFiles, taskDependencies, setTaskDependencies, handleCreateTask, isSpawnModalOpen, handleSpawnAgent, setIsSpawnModalOpen, templates, spawnTemplateKey, setSpawnTemplateKey, setSpawnName, spawnName, spawnRole, setSpawnRole, spawnPersona, setSpawnPersona, spawnProvider, setSpawnProvider, spawnModelName, setSpawnModelName, spawnSpawnSubtasks, setSpawnSpawnSubtasks, spawnTalkGlobally, setSpawnTalkGlobally, spawnContinuous, setSpawnContinuous, spawnParentAgentId, setSpawnParentAgentId, spawnAllowedTools, setSpawnAllowedTools, spawnTemp, setSpawnTemp, spawnMaxTokens, setSpawnMaxTokens, handleOpenBackendLogs } = state;`);

fs.writeFileSync('src/App.tsx', newCode);
console.log('JSX logic replaced successfully.');
