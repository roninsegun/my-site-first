import fetch from 'node-fetch';

async function run() {
  const url = 'https://framerusercontent.com/modules/ZTYxvWWzwxxfmK6WP2oy/mJaMxajssSkfURwz07Wa/Glass.js';
  try {
    const res = await fetch(url);
    const code = await res.text();
    console.log("Length of code:", code.length);
    console.log("Snippet (first 2000 chars):");
    console.log(code.substring(0, 2000));
    console.log("\nSnippet (middle/end indicators or search terms for easing):");
    const matches = code.match(/transition|ease|duration|blur|backdrop|opacity|scale/gi);
    console.log("Keywords count:", matches?.length || 0);
    // Find some transition configuration blocks
    const lines = code.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('transition') || lines[i].includes('ease') || lines[i].includes('cubic-bezier') || lines[i].includes('variants')) {
        console.log(`Line ${i}: ${lines[i].trim()}`);
      }
    }
  } catch (e: any) {
    console.error(e);
  }
}

run();
