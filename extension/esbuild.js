// @ts-check
// Bundles src/extension.ts and its runtime dependencies (axios, zod, mammoth,
// pdf-parse) into dist/extension.js so the packaged VSIX does not need node_modules.
//
//   node esbuild.js                 development build (sourcemap, not minified)
//   node esbuild.js --production    production build (minified, no sourcemap)
//   node esbuild.js --watch         development build, rebuilt on change
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');
const outdir = path.join(__dirname, 'dist');

/**
 * pdf-parse 1.1.1 loads pdf.js with a template-literal require
 * (`./pdf.js/${options.version}/build/pdf.js`). esbuild treats that as a glob and
 * would bundle all four pdf.js builds shipped in the package. The extension always
 * calls pdf-parse with its default options, so pin the require to the default
 * build (v1.10.100) and bundle only that one. Fails the build if pdf-parse changes.
 * @type {import('esbuild').Plugin}
 */
const pdfParseStaticRequire = {
    name: 'pdf-parse-static-require',
    setup(build) {
        build.onLoad({ filter: /[\\/]pdf-parse[\\/]lib[\\/]pdf-parse\.js$/ }, async (args) => {
            const source = await fs.promises.readFile(args.path, 'utf8');
            const dynamicRequire = 'require(`./pdf.js/${options.version}/build/pdf.js`)';
            if (!source.includes(dynamicRequire)) {
                throw new Error(`Expected pdf.js loader not found in ${args.path}. Check the pdf-parse version.`);
            }
            return {
                contents: source.replace(dynamicRequire, "require('./pdf.js/v1.10.100/build/pdf.js')"),
                loader: 'js',
            };
        });
    },
};

/**
 * Prints build start/end markers and errors in the format the background
 * problem matcher in .vscode/tasks.json expects.
 * @type {import('esbuild').Plugin}
 */
const watchLogger = {
    name: 'watch-logger',
    setup(build) {
        build.onStart(() => {
            console.log('[watch] build started');
        });
        build.onEnd((result) => {
            for (const { text, location } of result.errors) {
                console.error(`✘ [ERROR] ${text}`);
                if (location) {
                    console.error(`    ${location.file}:${location.line}:${location.column}:`);
                }
            }
            console.log('[watch] build finished');
        });
    },
};

async function main() {
    /** @type {import('esbuild').BuildOptions} */
    const options = {
        absWorkingDir: __dirname,
        entryPoints: ['src/extension.ts'],
        bundle: true,
        outfile: 'dist/extension.js',
        platform: 'node',
        format: 'cjs',
        // VS Code 1.85 (engines.vscode) runs extensions on Electron 25 / Node 18.
        target: 'node18',
        external: ['vscode'],
        sourcemap: !production,
        sourcesContent: false,
        minify: production,
        logLevel: watch ? 'silent' : 'info',
        plugins: watch ? [pdfParseStaticRequire, watchLogger] : [pdfParseStaticRequire],
    };

    if (watch) {
        const ctx = await esbuild.context(options);
        await ctx.watch();
        return;
    }

    // Start clean so a stale sourcemap from a dev build never ends up in a production package.
    fs.rmSync(outdir, { recursive: true, force: true });
    await esbuild.build(options);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
