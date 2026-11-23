#!/usr/bin/env node
/**
 * Shrinks the pictures of an event theme to the size they are shown at. Names and formats are kept,
 * so nothing else has to change: copy the result over the originals when you are happy with it.
 *
 *   npm i --no-save sharp          (once; --no-save keeps package.json untouched)
 *   node tools/optimize-theme-assets.mjs [themeDir] [outDir]
 *
 * Defaults: public/assets/themes/christmas -> public/assets/themes/christmas-optimized
 *
 * Why: the browser decodes a picture at its full size. 4862 x 2348 pixels are ~46 MB of memory for
 * one 300 px wide sleigh, and a 2 MB download can miss the 3 s the welcome flight waits for a picture.
 */
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readdir, stat } from 'node:fs/promises';
import { dirname, extname, join, relative } from 'node:path';

/** Widest useful size, in pixels, per folder (about 2x the size it is drawn at, for sharp screens). */
const MAX_WIDTH = {
	corners: 600, //  drawn 110-190 px wide
	lights: 640, //   one 16:9 tile of the string of lights, drawn ~150 px wide and repeated along the edge
	welcome: 1200, // drawn 300 px wide
};

const [themeDir = 'public/assets/themes/christmas-original', outDir = `${themeDir}-optimized`] =
	process.argv.slice(2);

let sharp;
try {
	({ default: sharp } = await import('sharp'));
} catch {
	console.error('This script needs sharp. Install it once with:  npm i --no-save sharp');
	process.exit(1);
}
if (!existsSync(themeDir)) {
	console.error(`Folder not found: ${themeDir}`);
	process.exit(1);
}

async function* files(dir) {
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) yield* files(path);
		else yield path;
	}
}

const kb = (bytes) => `${Math.round(bytes / 1024)} KB`;
let before = 0;
let after = 0;

for await (const file of files(themeDir)) {
	const target = join(outDir, relative(themeDir, file));
	await mkdir(dirname(target), { recursive: true });

	const folder = relative(themeDir, file).split(/[\\/]/)[0];
	const maxWidth = MAX_WIDTH[folder];
	const extension = extname(file).toLowerCase();
	const size = (await stat(file)).size;
	before += size;

	// small pictures (the snowflakes) and unknown formats are copied as they are
	if (!maxWidth || !['.png', '.webp'].includes(extension)) {
		await copyFile(file, target);
		after += size;
		console.log(`copied    ${relative(themeDir, file)}  ${kb(size)}`);
		continue;
	}

	const image = sharp(file);
	const { width, height } = await image.metadata();
	const resized = width > maxWidth ? image.resize({ width: maxWidth }) : image;
	const output =
		extension === '.png'
			? resized.png({ compressionLevel: 9, effort: 10 })
			: resized.webp({ quality: 88, effort: 6 });
	const info = await output.toFile(target);
	after += info.size;
	console.log(
		`optimized ${relative(themeDir, file)}  ${width}x${height} ${kb(size)}  ->  ${info.width}x${info.height} ${kb(info.size)}`,
	);
}

console.log(`\nTotal: ${kb(before)} -> ${kb(after)}  (written to ${outDir})`);
