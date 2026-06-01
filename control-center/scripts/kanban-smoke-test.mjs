import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function read(filePath) {
  const fullPath = path.join(rootDir, filePath);
  if (!fs.existsSync(fullPath)) {
    console.error(`Kanban smoke failed: missing ${filePath}`);
    process.exit(1);
  }
  return fs.readFileSync(fullPath, 'utf8');
}

function assertMatch(filePath, regex, message) {
  const content = read(filePath);
  if (!regex.test(content)) {
    console.error(`Kanban smoke failed in ${filePath}: ${message}`);
    process.exit(1);
  }
}

function assertNoMatch(filePath, regex, message) {
  const content = read(filePath);
  if (regex.test(content)) {
    console.error(`Kanban smoke failed in ${filePath}: ${message}`);
    process.exit(1);
  }
}

console.log('Running Kanban smoke test...');

[
  'src/pages/KanbanPage.tsx',
  'src/components/kanban/KanbanBoard.tsx',
  'src/components/kanban/KanbanColumn.tsx',
  'src/components/kanban/TaskCard.tsx',
  'src/components/kanban/TaskDetailDrawer.tsx',
  'src/components/kanban/CreateTaskModal.tsx',
  'src/components/kanban/AcceptanceCriteriaEditor.tsx',
  'src/components/kanban/AgentAssignmentSelect.tsx',
  'src/components/kanban/TaskActivityTimeline.tsx',
  'src/components/kanban/WorkReceiptPanel.tsx',
  'src/components/kanban/AgentRunPanel.tsx',
  'src/api/kanban.ts',
  'src/api/tasks.ts',
  'src/api/taskRuns.ts',
  'src/types/task.ts',
  'src/types/taskRun.ts',
  'src/types/workReceipt.ts',
].forEach(read);

assertMatch('src/pages/KanbanPage.tsx', /focusedTaskId/, 'Kanban must focus tasks opened from Backlog.');
assertMatch('src/pages/KanbanPage.tsx', /completeDisabledReason/, 'Kanban must calculate receipt-based completion disabled reason.');
assertMatch('src/pages/KanbanPage.tsx', /approveWorkReceipt/, 'Kanban must approve a receipt before completion.');
assertMatch('src/pages/KanbanPage.tsx', /startAgentTaskRun/, 'Kanban must start persisted agent task runs.');
assertMatch('src/pages/KanbanPage.tsx', /TaskDetailDrawer/, 'Kanban page must render the task detail drawer.');
assertMatch('src/pages/KanbanPage.tsx', /WorkReceipt/, 'Kanban page must load work receipt state.');

assertMatch('src/components/kanban/TaskCard.tsx', /task_key/, 'Task cards must show task keys.');
assertMatch('src/components/kanban/TaskCard.tsx', /criteria/, 'Task cards must show acceptance criteria counts.');
assertMatch('src/components/kanban/TaskCard.tsx', /work_receipt_id/, 'Task cards must expose receipt state.');
assertMatch('src/components/kanban/AgentAssignmentSelect.tsx', /model_name \|\| 'No model'/, 'Agent assignment must show no-model agents honestly.');
assertMatch('src/components/kanban/TaskDetailDrawer.tsx', /completeDisabledReason/, 'Task drawer must receive completion guard text.');
assertMatch('src/components/kanban/TaskDetailDrawer.tsx', /Start disabled:/, 'Task drawer must show exact Start Work disabled reason.');
assertMatch('src/components/kanban/TaskDetailDrawer.tsx', /Complete disabled:/, 'Task drawer must show exact completion disabled reason.');
assertMatch('src/components/kanban/TaskDetailDrawer.tsx', /Approve and Complete/, 'Task drawer must expose explicit approval before Done.');
assertMatch('src/components/kanban/TaskDetailDrawer.tsx', /Generate Receipt/, 'Task drawer must expose receipt generation.');
assertMatch('src/components/kanban/WorkReceiptPanel.tsx', /A task cannot be moved to Done until a receipt exists and is approved/, 'Receipt panel must state completion requirement.');
assertMatch('src/components/kanban/WorkReceiptPanel.tsx', /Approve and Complete/, 'Receipt panel must expose explicit approval action.');
assertMatch('src/components/kanban/AgentRunPanel.tsx', /runs/, 'Agent run panel must render persisted runs.');
assertMatch('src/components/kanban/TaskActivityTimeline.tsx', /activity/, 'Task activity timeline must render persisted activity.');

assertMatch('src/api/tasks.ts', /apiCall<Task>\("complete_task"/, 'Task API wrapper must expose backend complete_task.');
assertMatch('src/api/taskRuns.ts', /apiCall<TaskRun>\("start_agent_task_run"/, 'Task run API must expose start_agent_task_run.');
assertMatch('src/api/taskRuns.ts', /apiCall<WorkReceipt>\("generate_task_work_receipt"/, 'Task run API must generate work receipts.');
assertMatch('src/api/taskRuns.ts', /apiCall<void>\("approve_work_receipt"/, 'Task run API must approve work receipts.');

assertMatch('src-tauri/src/task_manager.rs', /Cannot complete task without a work receipt/, 'Backend must reject completion without a receipt.');
assertMatch('src-tauri/src/task_manager.rs', /start_agent_task_run/, 'Backend must expose persisted agent task runs.');
assertMatch('src-tauri/src/task_manager.rs', /draft receipt generated/, 'Start Work must create a draft receipt on success.');
assertMatch('src-tauri/src/task_manager.rs', /task_work_receipts/, 'Backend must persist work receipts.');

[
  'src/pages/KanbanPage.tsx',
  'src/components/kanban/KanbanBoard.tsx',
  'src/components/kanban/KanbanColumn.tsx',
  'src/components/kanban/TaskCard.tsx',
  'src/components/kanban/TaskDetailDrawer.tsx',
  'src/components/kanban/WorkReceiptPanel.tsx',
  'src/components/kanban/AgentRunPanel.tsx',
].forEach((file) => assertNoMatch(file, /invoke\s*\(/, `${file} must not call Tauri invoke directly.`));

assertNoMatch('src/pages/KanbanPage.tsx', /fake|mock.*complete|completion success/i, 'Kanban must not fake completion success.');
assertNoMatch('src/components/kanban/TaskDetailDrawer.tsx', /onMove\('done'\)|onMove\("done"\)/, 'Task drawer must not move directly to Done without receipt approval.');

console.log('Kanban smoke test passed.');
