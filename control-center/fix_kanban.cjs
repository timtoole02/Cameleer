const fs = require('fs');

let code = fs.readFileSync('src/components/tabs/kanbanTab.tsx', 'utf8');

const imports = `
import BacklogManager from '../backlog/BacklogManager';
import KanbanBoard from '../board/KanbanBoard';
`;

code = imports + code;

// Fix the 'card' implicit any
code = code.replace(/onCardClick=\{\(card\) => \{/, 'onCardClick={(card: any) => {');

fs.writeFileSync('src/components/tabs/kanbanTab.tsx', code);
console.log('Fixed kanbanTab.tsx');
