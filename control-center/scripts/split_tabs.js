const fs = require('fs');

const content = fs.readFileSync("src/App.tsx", "utf8");
const returnStart = content.indexOf('  return (\n    <div className="app-layout">');

if (returnStart === -1) {
  console.log("Could not find return start");
  process.exit(1);
}

const header = content.substring(0, returnStart);
const jsx = content.substring(returnStart);

// We will split the JSX by searching for `activeTab === "`
const tabs = [
  "dashboard", "global", "dm", "kanban", "runs", "skills", 
  "channels", "files", "missions", "agents", "models", "system", "org_dashboard"
];

for (const tab of tabs) {
  const marker = `activeTab === "${tab}"`;
  const idx = jsx.indexOf(marker);
  if (idx !== -1) {
    console.log(`Found tab: ${tab} at index ${idx}`);
  } else {
    console.log(`Could not find tab: ${tab}`);
  }
}
