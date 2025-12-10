
const marked = require('marked');

// FIX LOGIC
const renderer = new marked.Renderer();

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
        // --- FIX START ---
        // 1. Strip external wrapping inside the code block content if it exists.
        // Often AI puts another ```markdown wrapper inside.

        let cleanCode = code.trim();

        // Remove leading ```markdown or ``` or '''markdown or '''
        // Regex to match start of string, optional newlines, 3 backticks/quotes, optional language, optional newlines
        const startRegex = /^(\s*)(`{3,}|'{3,})(markdown|md)?(\s*\n)?/i;
        const endRegex = /(\n\s*)?(`{3,}|'{3,})(\s*)$/i;

        if (startRegex.test(cleanCode)) {
            cleanCode = cleanCode.replace(startRegex, '$1'); // Preserve initial indentation if needed, but usually we just want to strip
            // Actually, we usually want to remove the wrapper completely.
            cleanCode = cleanCode.replace(/^(\s*)(`{3,}|'{3,})(markdown|md)?\s*/i, '');
        }

        if (endRegex.test(cleanCode)) {
            cleanCode = cleanCode.replace(/(\s*)(`{3,}|'{3,})\s*$/i, '');
        }

        // 2. Safety Replace: If there are STILL backticks (nested deeply), replace them to prevent recursion
        const safeCode = cleanCode.replace(/```/g, "'''");

        // --- FIX END ---

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

const test1 = `
\`\`\`markdown
\`\`\`markdown
**Prompt untuk Desain**
* Item 1
* Item 2
\`\`\`
\`\`\`
`;

console.log("--- TEST 1 (Double Wrapped) ---");
console.log(marked.parse(test1));

const test2 = `
\`\`\`markdown
**Prompt untuk Desain**
* Item 1
\`\`\`
`;
console.log("\n--- TEST 2 (Single Wrapped) ---");
console.log(marked.parse(test2));

const test3 = `
\`\`\`markdown
\`\`\`
**Prompt**
\`\`\`
\`\`\`
`;
console.log("\n--- TEST 3 (Inner empty wrapper) ---");
console.log(marked.parse(test3));
