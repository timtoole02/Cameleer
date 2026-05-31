const fs = require('fs');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;

const code = fs.readFileSync('src/App.tsx', 'utf8');

const ast = parser.parse(code, {
  sourceType: 'module',
  plugins: ['jsx', 'typescript']
});

let extractedTabs = {};

traverse(ast, {
  ConditionalExpression(path) {
    const test = path.node.test;
    // We are looking for expressions like `activeTab === "dashboard"`
    if (test.type === 'BinaryExpression' && test.left.name === 'activeTab' && test.right.type === 'StringLiteral') {
      const tabName = test.right.value;
      const consequent = path.node.consequent;
      
      // If the consequence is a JSXElement, we grab its code
      if (consequent.type === 'JSXElement' || consequent.type === 'JSXFragment' || consequent.type === 'LogicalExpression') {
         // To avoid grabbing the small header toggles, check if the JSX is large
         const { code: jsxCode } = generate(consequent);
         if (jsxCode.length > 500) {
            extractedTabs[tabName] = jsxCode;
         }
      }
    }
  }
});

for (const [tabName, jsxCode] of Object.entries(extractedTabs)) {
    console.log(`Extracted tab: ${tabName} (${jsxCode.length} chars)`);
    fs.writeFileSync(`src/components/tabs/${tabName}Tab.tsx`, `export function ${tabName}Tab(props: any) {\n  return (\n    <>\n${jsxCode}\n    </>\n  );\n}`);
}
