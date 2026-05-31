const fs = require('fs');

let code = fs.readFileSync('src/App.tsx', 'utf8');

// Fix the components to use Capitalized names
code = code.replace(/<dashboardTab/g, '<DashboardTab');
code = code.replace(/<kanbanTab/g, '<KanbanTab');
code = code.replace(/<skillsTab/g, '<SkillsTab');
code = code.replace(/<channelsTab/g, '<ChannelsTab');
code = code.replace(/<filesTab/g, '<FilesTab');
code = code.replace(/<missionsTab/g, '<MissionsTab');
code = code.replace(/<agentsTab/g, '<AgentsTab');
code = code.replace(/<modelsTab/g, '<ModelsTab');

// The destructuring block ends at `} = useAppStore();`
// We want to add `const state = useAppStore();` before the destructuring block starts!
// Let's find `const { ` which starts the destructuring block right after `function App() {`
const appIdx = code.indexOf('function App() {');
const constIdx = code.indexOf('const {', appIdx);

code = code.slice(0, constIdx) + 'const state = useAppStore();\n  ' + code.slice(constIdx);
// But wait, the destructuring now needs to read from `state` instead of `useAppStore()`!
// Let's replace `} = useAppStore();` with `} = state;`
code = code.replace(/\} = useAppStore\(\);/, '} = state;');

fs.writeFileSync('src/App.tsx', code);
console.log('App.tsx fixed!');
