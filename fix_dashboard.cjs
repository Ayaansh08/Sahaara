const fs = require('fs');
const content = fs.readFileSync('src/pages/CaregiverDashboard.tsx', 'utf8');
const lines = content.split('\n');

// Find the second ') : (' which is the real start of the original Tab 2 block
// The first one is at ~line 709, the second is the original one around line 961
let firstTernaryElse = -1;
let secondTernaryElse = -1;

for (let i = 700; i < 1000; i++) {
  if (lines[i] && lines[i].trim() === ') : (') {
    if (firstTernaryElse === -1) {
      firstTernaryElse = i;
    } else {
      secondTernaryElse = i;
      break;
    }
  }
}

console.log('First ) : ( at line:', firstTernaryElse + 1);
console.log('Second ) : ( at line:', secondTernaryElse + 1);

// Keep lines 0..firstTernaryElse (inclusive), then skip to secondTernaryElse+1 onwards
const kept = [
  ...lines.slice(0, firstTernaryElse + 1),
  ...lines.slice(secondTernaryElse + 1)
];

fs.writeFileSync('src/pages/CaregiverDashboard.tsx', kept.join('\n'), 'utf8');
console.log('Done. New line count:', kept.length);
