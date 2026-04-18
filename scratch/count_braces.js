const fs = require('fs');
const content = fs.readFileSync('src/components/ProjectExecutionClient.tsx', 'utf8');

let openBraces = 0;
let closeBraces = 0;
let openParens = 0;
let closeParens = 0;
let inString = null;
let inComment = null;
let inJSX = 0;

for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i+1];

    if (inComment === 'line') {
        if (char === '\n') inComment = null;
        continue;
    }
    if (inComment === 'block') {
        if (char === '*' && nextChar === '/') {
            inComment = null;
            i++;
        }
        continue;
    }
    if (inString) {
        if (char === inString) {
            if (content[i-1] !== '\\') inString = null;
        }
        continue;
    }

    if (char === '/' && nextChar === '/') {
        inComment = 'line';
        i++;
        continue;
    }
    if (char === '/' && nextChar === '*') {
        inComment = 'block';
        i++;
        continue;
    }
    if (char === "'" || char === '"' || char === '`') {
        inString = char;
        continue;
    }

    if (char === '{') openBraces++;
    if (char === '}') closeBraces++;
    if (char === '(') openParens++;
    if (char === ')') closeParens++;
}

console.log(`Open braces: ${openBraces}, Close braces: ${closeBraces}`);
console.log(`Open parens: ${openParens}, Close parens: ${closeParens}`);
