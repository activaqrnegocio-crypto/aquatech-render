import fs from 'fs';

const content = fs.readFileSync('src/app/admin/proyectos/[id]/ProjectDetailClient.tsx', 'utf8');

const openTags = (content.match(/<div/g) || []).length;
const closeTags = (content.match(/<\/div>/g) || []).length;

console.log(`Open <div>: ${openTags}`);
console.log(`Close <div>: ${closeTags}`);

const openFragments = (content.match(/<>/g) || []).length;
const closeFragments = (content.match(/<\/>/g) || []).length;

console.log(`Open <>: ${openFragments}`);
console.log(`Close </>: ${closeFragments}`);

const openBraces = (content.match(/{/g) || []).length;
const closeBraces = (content.match(/}/g) || []).length;

console.log(`Open {: ${openBraces}`);
console.log(`Close }: ${closeBraces}`);

const openParens = (content.match(/\(/g) || []).length;
const closeParens = (content.match(/\)/g) || []).length;

console.log(`Open (: ${openParens}`);
console.log(`Close ): ${closeParens}`);
