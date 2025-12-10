
const marked = require('marked');

// Configure renderer exactly as in index.html
const renderer = new marked.Renderer();
const originalCode = renderer.code.bind(renderer);

renderer.code = function(code, language, isEscaped) {
    if (typeof code === 'object' && code !== null) {
        language = code.lang || "";
        code = code.text || "";
    }
    code = String(code || "");
    language = String(language || "");

    const isPrompt = (language === 'markdown') ||
                     (code.includes('**') && (code.includes('* ') || code.includes('- ')));

    if (isPrompt) {
        const safeCode = code.replace(/```/g, "'''");
        const htmlContent = marked.parse(safeCode);

        return `<div class="rich-prompt-box">
                    <span class="rich-prompt-label"><i class="fas fa-terminal mr-1"></i> AI Prompt / Detail</span>
                    <div class="prose dark:prose-invert max-w-none text-sm">${htmlContent}</div>
                </div>`;
    }

    const langClass = language ? 'language-' + language : '';
    const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<pre><code class="${langClass}">${escaped}</code></pre>`;
};

marked.setOptions({ renderer: renderer });

// Test Case 1: AI nesting code blocks
const test1 = `
Tentu, ini promptnya:

\`\`\`markdown
\`\`\`markdown
**Prompt untuk Desain**
* Item 1
* Item 2
\`\`\`
\`\`\`
`;

// Test Case 2: Just one code block with markdown language
const test2 = `
\`\`\`markdown
**Prompt untuk Desain**
* Item 1
* Item 2
\`\`\`
`;

// Test Case 3: Code block with inner fences (common issue)
const test3 = `
\`\`\`
\`\`\`markdown
**Prompt**
\`\`\`
\`\`\`
`;

console.log("--- TEST 1 ---");
console.log(marked.parse(test1));
console.log("\n--- TEST 2 ---");
console.log(marked.parse(test2));
console.log("\n--- TEST 3 ---");
console.log(marked.parse(test3));
