const fs = require('fs');

// Extract the exported variables string from useAppStore.tsx
const appStoreCode = fs.readFileSync('src/hooks/useAppStore.tsx', 'utf8');
const returnMatch = appStoreCode.match(/return \{([\s\S]+?)\};/);
if (!returnMatch) throw new Error("Could not find return statement in useAppStore.tsx");

const varsRaw = returnMatch[1];
// Extract just the identifiers
const vars = varsRaw.split(',').map(s => s.trim()).filter(s => s.length > 0);

const destructuringStmt = `  const { ${vars.join(', ')} } = props;\n`;

const tabsDir = 'src/components/tabs';
const files = fs.readdirSync(tabsDir).filter(f => f.endsWith('.tsx'));

for (const file of files) {
    const filePath = `${tabsDir}/${file}`;
    let code = fs.readFileSync(filePath, 'utf8');
    
    // Inject right after `export function XxxTab(props: any) {`
    code = code.replace(/export function (\w+Tab)\(props: any\) \{/, `export function $1(props: any) {\n${destructuringStmt}`);
    
    fs.writeFileSync(filePath, code);
    console.log(`Fixed ${file}`);
}
