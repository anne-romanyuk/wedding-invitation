import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceArgument = process.argv[2] || "data/versions/wjqgtmkxw.html";
const sourcePath = path.resolve(projectDirectory, sourceArgument);
const outputPath = path.join(projectDirectory, "default-template.html");
const audioPath = path.join(projectDirectory, "assets", "default-music.mp3");
const imageDirectory = path.join(projectDirectory, "assets", "default-media");

let documentHtml = await readFile(sourcePath, "utf8");
if (!documentHtml.includes('class="site"')) {
  throw new Error("В выбранном файле не найден шаблон приглашения");
}

const embeddedAudio = documentHtml.match(/src="data:audio\/([^;]+);base64,([^"]+)"/);
if (embeddedAudio) {
  await mkdir(path.dirname(audioPath), { recursive: true });
  await writeFile(audioPath, Buffer.from(embeddedAudio[2], "base64"));
  documentHtml = documentHtml.replace(embeddedAudio[0], 'src="/assets/default-music.mp3"');
}

const embeddedImages = [...documentHtml.matchAll(/src="data:image\/([^;]+);base64,([^"]+)"/g)];
if (embeddedImages.length) await mkdir(imageDirectory, { recursive: true });
for (const embeddedImage of embeddedImages) {
  const imageBytes = Buffer.from(embeddedImage[2], "base64");
  const extension = ({ jpeg: "jpg", "svg+xml": "svg" })[embeddedImage[1]] || embeddedImage[1];
  const fileName = `${createHash("sha256").update(imageBytes).digest("hex").slice(0, 16)}.${extension}`;
  await writeFile(path.join(imageDirectory, fileName), imageBytes);
  documentHtml = documentHtml.replaceAll(embeddedImage[0], `src="/assets/default-media/${fileName}"`);
}

documentHtml = documentHtml
  .replaceAll('src="assets/', 'src="/assets/')
  .replaceAll('href="assets/', 'href="/assets/');

await writeFile(outputPath, documentHtml, "utf8");

const templateSize = Buffer.byteLength(documentHtml);
console.log(`Default template: ${path.relative(projectDirectory, outputPath)} (${templateSize} bytes)`);
if (embeddedAudio) console.log(`Default music: ${path.relative(projectDirectory, audioPath)}`);
if (embeddedImages.length) console.log(`Default images extracted: ${embeddedImages.length}`);
