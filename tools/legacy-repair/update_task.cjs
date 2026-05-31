const fs = require('fs');

const path = '/Users/timtoole/.gemini/antigravity/brain/8cbee403-b081-408f-9913-f6604ac52203/task.md';
let task = fs.readFileSync(path, 'utf8');

task = task.replace(/- `\[\/\]` Sprint 9B: Remove Frontend Prototype Debt/g, '- `[x]` Sprint 9B: Remove Frontend Prototype Debt');
task = task.replace(/- `\[\/\]` Dismantle App.tsx monolith/g, '- `[x]` Dismantle App.tsx monolith');
task = task.replace(/- `\[\/\]` Remove \/\/ @ts-nocheck/g, '- `[x]` Remove // @ts-nocheck');
task = task.replace(/- `\[\/\]` Establish strict type safety/g, '- `[x]` Establish strict type safety');
task = task.replace(/- `\[\/\]` Build custom hooks/g, '- `[x]` Build custom hooks');

fs.writeFileSync(path, task);
console.log('Task updated');
