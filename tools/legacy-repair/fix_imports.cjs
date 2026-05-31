const fs = require('fs');

let code = fs.readFileSync('src/App.tsx', 'utf8');

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

code = imports + '\n' + code;

fs.writeFileSync('src/App.tsx', code);
console.log('Imports added!');
