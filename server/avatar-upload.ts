import multer from "multer";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Served directly by the express.static("public") mount in server/index.ts,
// so a saved file is reachable at /avatars/<filename> with no extra route.
export const AVATAR_DIR = path.join(__dirname, "../public/avatars");
fs.mkdirSync(AVATAR_DIR, { recursive: true });

const ACCEPTED_MIMETYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export const avatarUpload = multer({
  // Buffered in memory rather than written straight to disk — the file is
  // always re-encoded by resizeAndSaveAvatar below before it's saved, so
  // there's no point persisting the raw upload first.
  storage: multer.memoryStorage(),
  // Generous ceiling for the RAW file straight off a phone camera (a
  // single modern smartphone photo commonly runs 8-15MB). This is not the
  // size anything ends up stored at — resizeAndSaveAvatar always shrinks
  // the image down before it touches disk.
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ACCEPTED_MIMETYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, WEBP, or GIF images are allowed"));
    }
  },
});

// Resizes/compresses an uploaded avatar down to a small square JPEG —
// regardless of how large or what (accepted) format the original was —
// and writes it to disk under a userId+timestamp filename that's never
// derived from user input.
export async function resizeAndSaveAvatar(userId: string, buffer: Buffer): Promise<string> {
  const resized = await sharp(buffer)
    .rotate() // respect EXIF orientation (phone cameras rely on this)
    .resize(512, 512, { fit: "cover" })
    .jpeg({ quality: 85 })
    .toBuffer();

  const filename = `${userId}-${Date.now()}.jpg`;
  await fs.promises.writeFile(path.join(AVATAR_DIR, filename), resized);
  return `/avatars/${filename}`;
}

// Best-effort cleanup of a previously saved avatar file when it's replaced
// or removed — avatarUrl is always "/avatars/<filename>" (set by
// resizeAndSaveAvatar above), never arbitrary user input.
export function deleteAvatarFile(avatarUrl: string | null | undefined) {
  if (!avatarUrl || !avatarUrl.startsWith("/avatars/")) return;
  const filePath = path.join(AVATAR_DIR, path.basename(avatarUrl));
  fs.unlink(filePath, () => {});
}
