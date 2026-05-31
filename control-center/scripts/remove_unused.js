import * as fs from "fs";

let content = fs.readFileSync("src/App.tsx", "utf8");

// Unused imports from types
const unusedImports = [
    "BacklogItem", "KanbanCard", "Project", "Team", "Workspace", "Decision", "Handoff",
    "TensorDetails", "DownloadDetails", "ActivationDetails", "InspectionDetails"
];

for (const imp of unusedImports) {
    // Remove `imp, ` or `, imp` or `imp`
    let regex = new RegExp(`\\b${imp}\\b\\s*,?`, "g");
    content = content.replace(regex, "");
}

// Clean up trailing commas in imports
content = content.replace(/,\s*}/g, " }");
content = content.replace(/{\s*,/g, "{ ");

// Unused state variables
const unusedState = [
    "activeContract", "activeReceipt", "completionError", "selectedClaimingAgentId",
    "setSelectedClaimingAgentId", "isCompletingTask", "isAddingBlocker", "modalDetailsTab",
    "setModalDetailsTab", "timelineEntries"
];

for (const v of unusedState) {
    // If it's a state setter, the line might be: const [foo, setFoo] = useState(...)
    // we can just comment out the line
    let regex = new RegExp(`^.*\\b${v}\\b.*useState.*$`, "gm");
    content = content.replace(regex, "");
}

// Unused functions
const unusedFuncs = [
    "handleTransitionStatus", "handleClaimCard", "handleCompleteCard",
    "handleAddComment", "handleAddBlocker", "handleToggleChecklistItem"
];

for (const f of unusedFuncs) {
    let regex = new RegExp(`const ${f} = async \\(.*?\\) => {.*?};`, "gs");
    // Since functions can be multi-line, regex might be tricky if they have nested {}.
    // But let's just leave them and prepend // to the `const handle...` line,
    // wait, that leaves syntax errors inside the function body.
}

fs.writeFileSync("src/App.tsx", content);
console.log("Removed unused variables");
