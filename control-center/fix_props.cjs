const fs = require('fs');

const tabsDir = 'src/components/tabs';
const files = fs.readdirSync(tabsDir).filter(f => f.endsWith('.tsx'));

for (const file of files) {
    const filePath = `${tabsDir}/${file}`;
    let code = fs.readFileSync(filePath, 'utf8');
    
    // Replace the props type
    code = code.replace(/export function (\w+)\(props: any\) \{/, `import { useAppStore } from '../../hooks/useAppStore';\n\nexport function $1(props: ReturnType<typeof useAppStore>) {`);
    
    fs.writeFileSync(filePath, code);
}
console.log('Props fixed.');
