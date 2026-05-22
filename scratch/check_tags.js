const fs = require('fs');
const content = fs.readFileSync('src/components/ProjectExecutionClient.tsx', 'utf8');

let stack = [];
const regex = /<(\/?)([a-zA-Z0-9-]+)|{/g;
let match;

let line = 1;
let lastIdx = 0;

while ((match = regex.exec(content)) !== null) {
    const textBefore = content.substring(lastIdx, match.index);
    line += (textBefore.match(/\n/g) || []).length;
    lastIdx = match.index;

    if (match[0] === '{') {
        // stack.push({ type: '{', line }); // Ignore braces for now
    } else if (match[1] === '/') {
        const tag = match[2];
        let found = false;
        for (let i = stack.length - 1; i >= 0; i--) {
            if (stack[i].type === 'tag' && stack[i].name === tag) {
                stack.splice(i, 1);
                found = true;
                break;
            }
        }
        if (!found) {
            console.log(`Unmatched closing tag </${tag}> at line ${line}`);
        }
    } else {
        const tag = match[2];
        const fullTagMatch = content.substring(match.index).match(/^<([a-zA-Z0-9-]+)[^>]*(\/?)>/);
        if (fullTagMatch && !fullTagMatch[2]) {
            stack.push({ type: 'tag', name: tag, line });
        }
    }
}

// Check for closing braces too
const braceRegex = /}/g;
// This is getting complex because of strings and comments.
// Let's just look at the stack of tags.

const tagStack = stack.filter(s => s.type === 'tag');
console.log('Unclosed tags:');
tagStack.forEach(s => console.log(`<${s.name}> at line ${s.line}`));
