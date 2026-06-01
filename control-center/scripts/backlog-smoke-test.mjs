import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function read(filePath) {
  const fullPath = path.join(rootDir, filePath);
  if (!fs.existsSync(fullPath)) {
    console.error(`Backlog smoke failed: missing ${filePath}`);
    process.exit(1);
  }
  return fs.readFileSync(fullPath, 'utf8');
}

function assertMatch(filePath, regex, message) {
  const content = read(filePath);
  if (!regex.test(content)) {
    console.error(`Backlog smoke failed in ${filePath}: ${message}`);
    process.exit(1);
  }
}

function assertNoMatch(filePath, regex, message) {
  const content = read(filePath);
  if (regex.test(content)) {
    console.error(`Backlog smoke failed in ${filePath}: ${message}`);
    process.exit(1);
  }
}

console.log('Running Backlog smoke test...');

read('src/pages/BacklogPage.tsx');
read('src/api/backlog.ts');
read('src/types/kanban.ts');
read('src/components/kanban/AcceptanceCriteriaEditor.tsx');

assertMatch('src/pages/BacklogPage.tsx', /createBacklogItem/, 'Create backlog path must use the backlog API wrapper.');
assertMatch('src/pages/BacklogPage.tsx', /className="backlog-drawer"/, 'Backlog detail drawer surface must render.');
assertMatch('src/pages/BacklogPage.tsx', /className="readiness-panel"/, 'Backlog readiness panel must render.');
assertMatch('src/pages/BacklogPage.tsx', /convertBacklogItemToCard/, 'Backlog conversion path must use the backend conversion API.');
assertMatch('src/pages/BacklogPage.tsx', /readinessMissing/, 'Backlog must calculate and show missing ready fields.');
assertMatch('src/pages/BacklogPage.tsx', /acceptance_criteria/, 'Backlog must expose acceptance criteria editing.');
assertMatch('src/pages/BacklogPage.tsx', /disabled=\{busy \|\| missing\.length > 0/, 'Ready/convert actions must be disabled when ready fields are missing.');

assertMatch('src/api/backlog.ts', /apiCall<BacklogItem>\("create_backlog_item"/, 'Create API wrapper must call create_backlog_item.');
assertMatch('src/api/backlog.ts', /apiCall<BacklogItem>\("update_backlog_item"/, 'Update API wrapper must call update_backlog_item.');
assertMatch('src/api/backlog.ts', /apiCall<KanbanCard>\("convert_backlog_item_to_card"/, 'Convert API wrapper must call convert_backlog_item_to_card.');

assertMatch('src/types/kanban.ts', /CreateBacklogItemInput/, 'Backlog create input type must exist.');
assertMatch('src/types/kanban.ts', /UpdateBacklogItemInput/, 'Backlog update input type must exist.');
assertMatch('src/types/kanban.ts', /converted_card_id/, 'Backlog converted task linkage must be typed.');
assertMatch('src/types/kanban.ts', /readiness_score/, 'Backlog readiness score must be typed.');

assertNoMatch('src/pages/BacklogPage.tsx', /invoke\s*\(/, 'Backlog React page must not call Tauri invoke directly.');
assertNoMatch('src/pages/BacklogPage.tsx', /fake|mock|TODO-only|TODO only/i, 'Backlog page must not advertise fake or TODO-only conversion.');
assertNoMatch('src/api/backlog.ts', /Promise\.resolve|setTimeout/, 'Backlog API wrapper must not fake successful backend calls.');

console.log('Backlog smoke test passed.');
