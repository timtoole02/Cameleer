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
read('src/types/backlog.ts');
read('src/components/backlog/BacklogList.tsx');
read('src/components/backlog/BacklogItemRow.tsx');
read('src/components/backlog/BacklogDetailDrawer.tsx');
read('src/components/backlog/CreateBacklogItemModal.tsx');
read('src/components/backlog/BacklogReadinessPanel.tsx');
read('src/components/backlog/ConvertToTaskPanel.tsx');
read('src/components/kanban/AcceptanceCriteriaEditor.tsx');
read('src/components/kanban/PrioritySelector.tsx');

assertMatch('src/pages/BacklogPage.tsx', /createBacklogItem/, 'Create backlog path must use the backlog API wrapper.');
assertMatch('src/pages/BacklogPage.tsx', /BacklogDetailDrawer/, 'Backlog page must render the detail drawer component.');
assertMatch('src/pages/BacklogPage.tsx', /CreateBacklogItemModal/, 'Backlog page must render the create backlog item control.');
assertMatch('src/pages/BacklogPage.tsx', /BacklogReadinessPanel/, 'Backlog page must render the readiness panel.');
assertMatch('src/pages/BacklogPage.tsx', /ConvertToTaskPanel/, 'Backlog page must render the convert-to-task panel.');
assertMatch('src/pages/BacklogPage.tsx', /convertBacklogItemToCard/, 'Backlog conversion path must use the backend conversion API.');
assertMatch('src/pages/BacklogPage.tsx', /owner_agent_id/, 'Backlog must support persisted assigned agent selection.');
assertMatch('src/pages/BacklogPage.tsx', /readinessMissing/, 'Backlog must calculate and show missing ready fields.');
assertMatch('src/pages/BacklogPage.tsx', /const currentReadinessScore = readinessScore\(form\)/, 'Backlog readiness score must update from unsaved form edits.');
assertMatch('src/pages/BacklogPage.tsx', /const canConvertToKanban = Boolean\(selected\) && !creating && selected\?\.status !== 'converted' && missing\.length === 0/, 'Backlog conversion must require a saved non-converted item.');
assertMatch('src/pages/BacklogPage.tsx', /setFocusedTaskId\(taskId\)/, 'Backlog converted task panel must open the Kanban task.');
assertMatch('src/pages/BacklogPage.tsx', /acceptance_criteria/, 'Backlog must expose acceptance criteria editing.');
assertMatch('src/pages/BacklogPage.tsx', /PrioritySelector/, 'Backlog must expose priority as an actionable segmented control.');
assertMatch('src/pages/BacklogPage.tsx', /disabled=\{busy \|\| missing\.length > 0/, 'Ready/convert actions must be disabled when ready fields are missing.');
assertMatch('src/components/backlog/BacklogReadinessPanel.tsx', /<progress max=\{100\} value=\{score\}/, 'Backlog readiness progress must use the live form score.');
assertMatch('src/components/backlog/ConvertToTaskPanel.tsx', /disabled=\{busy \|\| !canConvert\}/, 'Backlog Convert button must use the saved-item conversion guard.');
assertMatch('src/components/kanban/PrioritySelector.tsx', /aria-label="Priority"/, 'Priority selector must be accessible by label.');
assertMatch('src/components/kanban/PrioritySelector.tsx', /aria-label=\{`Set priority \$\{priority\}`\}/, 'Priority selector choices must have unique accessible names.');
assertMatch('src/components/kanban/PrioritySelector.tsx', /priorityOptions = \['low', 'medium', 'high', 'critical'\]/, 'Priority selector must expose all expected priority values.');

assertMatch('src/api/backlog.ts', /apiCall<BacklogItem>\("create_backlog_item"/, 'Create API wrapper must call create_backlog_item.');
assertMatch('src/api/backlog.ts', /apiCall<BacklogItem>\("update_backlog_item"/, 'Update API wrapper must call update_backlog_item.');
assertMatch('src/api/backlog.ts', /apiCall<KanbanCard>\("convert_backlog_item_to_card"/, 'Convert API wrapper must call convert_backlog_item_to_card.');

assertMatch('src/types/kanban.ts', /CreateBacklogItemInput/, 'Backlog create input type must exist.');
assertMatch('src/types/kanban.ts', /UpdateBacklogItemInput/, 'Backlog update input type must exist.');
assertMatch('src/types/kanban.ts', /converted_card_id/, 'Backlog converted task linkage must be typed.');
assertMatch('src/types/kanban.ts', /readiness_score/, 'Backlog readiness score must be typed.');

assertNoMatch('src/pages/BacklogPage.tsx', /invoke\s*\(/, 'Backlog React page must not call Tauri invoke directly.');
[
  'src/components/backlog/BacklogList.tsx',
  'src/components/backlog/BacklogItemRow.tsx',
  'src/components/backlog/BacklogDetailDrawer.tsx',
  'src/components/backlog/CreateBacklogItemModal.tsx',
  'src/components/backlog/BacklogReadinessPanel.tsx',
  'src/components/backlog/ConvertToTaskPanel.tsx',
].forEach((file) => assertNoMatch(file, /invoke\s*\(/, `${file} must not call Tauri invoke directly.`));
assertNoMatch('src/pages/BacklogPage.tsx', /fake|mock|TODO-only|TODO only/i, 'Backlog page must not advertise fake or TODO-only conversion.');
assertNoMatch('src/api/backlog.ts', /Promise\.resolve|setTimeout/, 'Backlog API wrapper must not fake successful backend calls.');

console.log('Backlog smoke test passed.');
