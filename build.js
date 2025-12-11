const fs = require('fs-extra');
const JavaScriptObfuscator = require('javascript-obfuscator');
const path = require('path');

async function build() {
    const srcDir = path.join(__dirname, 'src');
    const distDir = path.join(__dirname, 'dist');
    const rootDir = __dirname;

    console.log('Build started...');

    // 1. Clean dist
    await fs.emptyDir(distDir);
    console.log('Cleaned dist directory.');

    // 2. Copy index.html
    await fs.copy(path.join(srcDir, 'index.html'), path.join(distDir, 'index.html'));
    console.log('Copied index.html to dist.');

    // 3. Obfuscate JS
    const jsCode = await fs.readFile(path.join(srcDir, 'js/app.js'), 'utf8');
    const obfuscationResult = JavaScriptObfuscator.obfuscate(jsCode, {
        compact: true,
        controlFlowFlattening: true,
        controlFlowFlatteningThreshold: 0.75,
        deadCodeInjection: true,
        deadCodeInjectionThreshold: 0.4,
        debugProtection: false,
        debugProtectionInterval: 0,
        disableConsoleOutput: true,
        identifierNamesGenerator: 'hexadecimal',
        log: false,
        numbersToExpressions: true,
        renameGlobals: false,
        selfDefending: true,
        simplify: true,
        splitStrings: true,
        splitStringsChunkLength: 10,
        stringArray: true,
        stringArrayCallsTransform: true,
        stringArrayCallsTransformThreshold: 0.75,
        stringArrayEncoding: ['base64'],
        stringArrayIndexShift: true,
        stringArrayRotate: true,
        stringArrayShuffle: true,
        stringArrayWrappersCount: 2,
        stringArrayWrappersChainedCalls: true,
        stringArrayWrappersParametersMaxCount: 4,
        stringArrayWrappersType: 'function',
        stringArrayThreshold: 0.75,
        transformObjectKeys: true,
        unicodeEscapeSequence: false
    });

    await fs.ensureDir(path.join(distDir, 'js'));
    await fs.writeFile(path.join(distDir, 'js/app.js'), obfuscationResult.getObfuscatedCode());
    console.log('Obfuscated JS written to dist/js/app.js.');

    // 4. Copy Assets
    await fs.copy(path.join(srcDir, 'logo-bmc_pintar_ku.png'), path.join(distDir, 'logo-bmc_pintar_ku.png'));
    await fs.copy(path.join(srcDir, 'favicon-32x32.png'), path.join(distDir, 'favicon-32x32.png'));
    console.log('Copied assets to dist.');

    // 5. Restore Root Functionality (Optional but recommended for user)
    // Copy the *obfuscated* files back to root so the site works as expected by default
    await fs.copy(path.join(distDir, 'index.html'), path.join(rootDir, 'index.html'));
    await fs.copy(path.join(distDir, 'js'), path.join(rootDir, 'js'));
    // Note: Images are already in root (we moved them to src but they might not be there anymore if we moved them. Wait, I moved them.)
    // If I moved them, they are gone from root. I must copy them back.
    await fs.copy(path.join(distDir, 'logo-bmc_pintar_ku.png'), path.join(rootDir, 'logo-bmc_pintar_ku.png'));
    await fs.copy(path.join(distDir, 'favicon-32x32.png'), path.join(rootDir, 'favicon-32x32.png'));

    console.log('Copied obfuscated files back to root for immediate deployment.');

    console.log('Build complete! Source is in src/, Protected App is in dist/ and root.');
}

build().catch(err => console.error(err));
