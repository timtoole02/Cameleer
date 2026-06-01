import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function assertExists(filePath) {
  const fullPath = path.join(rootDir, filePath);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ P0 FAIL: Required file missing: ${filePath}`);
    process.exit(1);
  }
}

function assertNoMatch(filePath, regex, errorMsg) {
  const fullPath = path.join(rootDir, filePath);
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf-8');
    if (regex.test(content)) {
      console.error(`❌ P0 FAIL in ${filePath}: ${errorMsg}`);
      process.exit(1);
    }
  }
}

function readFile(filePath) {
  const fullPath = path.join(rootDir, filePath);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ P0 FAIL: Required file missing: ${filePath}`);
    process.exit(1);
  }
  return fs.readFileSync(fullPath, 'utf-8');
}

function assertMatch(filePath, regex, errorMsg) {
  const content = readFile(filePath);
  if (!regex.test(content)) {
    console.error(`❌ P0 FAIL in ${filePath}: ${errorMsg}`);
    process.exit(1);
  }
}

console.log('Running P0 Visual/Architectural Smoke Test...');

// Structure checks
assertExists('package.json');
assertExists('tsconfig.json');
assertExists('src/App.tsx');
assertExists('src/styles/theme.css');
assertExists('src/api/client.ts');
assertExists('src/api/health.ts');

// State component checks
assertExists('src/components/common/PageShell.tsx');
assertExists('src/components/common/LoadingState.tsx');
assertExists('src/components/common/ErrorState.tsx');
assertExists('src/components/common/EmptyState.tsx');
assertExists('src/components/common/StatusBadge.tsx');

// Rules checks
assertNoMatch('src/App.tsx', /Backend:\s*unknown/, 'Hardcoded "Backend: unknown" found.');
[
  'src/App.tsx',
  'src/components/layout/TopNav.tsx',
  'src/pages/ChatPage.tsx',
  'src/pages/OtherPages.tsx'
].forEach(file => {
  assertNoMatch(file, /Backend:\s*CONNECTED/i, 'Single generic Backend: CONNECTED badge must not exist.');
});

// Health truth checks
assertMatch('src/components/layout/TopNav.tsx', /label="App"/, 'Status bar must render App status.');
assertMatch('src/components/layout/TopNav.tsx', /label="DB"/, 'Status bar must render DB status.');
assertMatch('src/components/layout/TopNav.tsx', /label="Camelid"/, 'Status bar must render Camelid status.');
assertMatch('src/components/layout/TopNav.tsx', /Model:/, 'Status bar must render Model status.');
assertMatch('src-tauri/src/system_services.rs', /app_status/, 'Backend health must return app_status.');
assertMatch('src-tauri/src/system_services.rs', /database_status/, 'Backend health must return database_status.');
assertMatch('src-tauri/src/system_services.rs', /camelid_status/, 'Backend health must return camelid_status.');

// Chat gating checks
assertMatch('src/pages/ChatPage.tsx', /database_status !== 'ready'/, 'Send must be blocked when DB is not ready.');
assertMatch('src/pages/ChatPage.tsx', /camelid_status !== 'connected'/, 'Send must be blocked when Camelid is offline.');
assertMatch('src/pages/ChatPage.tsx', /Camelid is offline at \$\{backendHealth\?\.camelid_endpoint \|\| 'http:\/\/127\.0\.0\.1:8181'\}\./, 'Offline banner must include exact Camelid endpoint reason.');
assertMatch('src/pages/ChatPage.tsx', /disabled=\{!canSend\}/, 'Chat input must be disabled when health gates fail.');
assertMatch('src/pages/ChatPage.tsx', /No model is loaded\./, 'Chat must be blocked when no model is loaded.');
assertMatch('src-tauri/src/chat_service.rs', /chat_send_block_reason/, 'Backend chat path must have a readiness guard.');
assertMatch('src-tauri/src/chat_service.rs', /Chat disabled: Camelid is offline at/, 'Backend chat guard must block Camelid offline sends.');

// Schema regression checks
assertMatch('src-tauri/migrations/0001_initial_schema.sql', /done_definition TEXT/, 'Base schema must include done_definition.');
assertMatch('src-tauri/migrations/0002_agent_contract_done_definition.sql', /ALTER TABLE mission_agent_contracts ADD COLUMN done_definition TEXT/, 'Upgrade migration must add done_definition.');
assertMatch('src-tauri/src/storage.rs', /migrations_are_idempotent/, 'Migration idempotency must be covered by Rust tests.');
assertMatch('src-tauri/src/system_services.rs', /health_reports_schema_error_when_column_missing/, 'Schema error health regression must be covered by Rust tests.');

// Kanban slice checks
[
  'src/components/kanban/KanbanBoard.tsx',
  'src/components/kanban/KanbanColumn.tsx',
  'src/components/kanban/TaskCard.tsx',
  'src/components/kanban/TaskDetailDrawer.tsx',
  'src/components/kanban/CreateTaskModal.tsx',
  'src/components/kanban/AcceptanceCriteriaEditor.tsx',
  'src/components/kanban/AgentAssignmentSelect.tsx',
  'src/components/kanban/WorkReceiptPanel.tsx',
  'src/api/tasks.ts',
  'src/api/taskRuns.ts',
  'src/types/workReceipt.ts'
].forEach(assertExists);
assertMatch('src/pages/KanbanPage.tsx', /startDisabledReason/, 'Kanban must render guarded Start Work disabled reasons.');
assertMatch('src/pages/KanbanPage.tsx', /completeDisabledReason/, 'Kanban must block completion without receipt.');
assertMatch('src/pages/KanbanPage.tsx', /CreateTaskModal/, 'Kanban must expose create task flow.');
assertMatch('src/pages/KanbanPage.tsx', /startAgentTaskRun/, 'Kanban must start persisted agent task runs.');
assertMatch('src/components/kanban/TaskCard.tsx', /task_key/, 'Task cards must render task keys.');
assertMatch('src/components/kanban/TaskCard.tsx', /criteria/, 'Task cards must render acceptance criteria count.');
assertMatch('src/components/kanban/WorkReceiptPanel.tsx', /Approve and Complete/, 'Receipt panel must expose explicit approval before Done.');
assertMatch('src-tauri/src/task_manager.rs', /Cannot complete task without a work receipt/, 'Backend must block completion without receipt.');
assertMatch('src-tauri/src/task_manager.rs', /start_agent_task_run/, 'Backend must expose start_agent_task_run.');
assertMatch('src-tauri/src/task_manager.rs', /task_progress_updates/, 'Agent work must persist progress updates.');
assertMatch('src-tauri/src/task_manager.rs', /task_work_receipts/, 'Work receipts must be persisted.');

// Backlog refinement checks
[
  'src/pages/BacklogPage.tsx',
  'src/api/backlog.ts',
  'src-tauri/migrations/0004_backlog_refinement_slice.sql'
].forEach(assertExists);
assertMatch('src/pages/BacklogPage.tsx', /function readinessMissing/, 'Backlog must calculate missing ready fields.');
assertMatch('src/pages/BacklogPage.tsx', /Missing: \{missing\.join\(', '\)\}/, 'Backlog must show missing ready fields.');
assertMatch('src/pages/BacklogPage.tsx', /disabled=\{busy \|\| missing\.length > 0\} onClick=\{\(\) => save\('ready'\)\}/, 'Backlog must block Mark ready until ready fields are present.');
assertMatch('src/pages/BacklogPage.tsx', /disabled=\{busy \|\| missing\.length > 0 \|\| selected\?\.status === 'converted'\} onClick=\{convert\}/, 'Backlog must block conversion until ready fields are present.');
assertMatch('src/pages/BacklogPage.tsx', /updateBacklogItem\(selected\.id, toUpdateInput\(form, 'ready'\)\)/, 'Backlog conversion must persist the latest ready-state edits before creating a card.');
assertMatch('src/pages/BacklogPage.tsx', /convertBacklogItemToCard\(selected\.id\)/, 'Backlog must call the conversion API.');
assertMatch('src/types/kanban.ts', /readiness_score: number/, 'Backlog item type must expose readiness score.');
assertMatch('src/types/kanban.ts', /converted_card_id\?: string \| null/, 'Backlog item type must expose converted card links.');
assertMatch('src-tauri/src/board_services.rs', /Cannot convert backlog item yet\. Missing:/, 'Backend must reject incomplete backlog conversion.');
assertMatch('src-tauri/src/board_services.rs', /SET status = 'converted', converted_card_id = \?1/, 'Backend must link converted backlog items to Kanban cards.');
assertMatch('src-tauri/migrations/0004_backlog_refinement_slice.sql', /CREATE TABLE IF NOT EXISTS backlog_activity/, 'Backlog migration must persist activity.');
assertMatch('src-tauri/migrations/0004_backlog_refinement_slice.sql', /CREATE TABLE IF NOT EXISTS backlog_acceptance_criteria/, 'Backlog migration must persist acceptance criteria.');

// Native-feeling sidebar checks
assertMatch('src/components/layout/Sidebar.tsx', /borderLeft: isActive \? '4px solid var\(--sidebar-active-border/, 'Active nav must use a subtle left border.');
assertMatch('src/components/layout/Sidebar.tsx', /background: isActive \? 'var\(--sidebar-active-bg, #1f2937\)'/, 'Active nav must use restrained dark surface.');
assertNoMatch('src/components/layout/Sidebar.tsx', /background:\s*isActive\s*\?\s*'var\(--accent|background:\s*isActive\s*\?\s*'#2563eb/i, 'Active nav must not be a saturated blue block.');

console.log('✅ P0 Smoke Test Passed.');
process.exit(0);
