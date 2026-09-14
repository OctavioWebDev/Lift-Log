import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Served directly by the express.static("public") mount in server/index.ts,
// so an uploaded file is reachable at /avatars/<filename> with no extra route.
export const AVATAR_DIR = path.join(__dirname, "../public/avatars");
fs.mkdirSync(AVATAR_DIR, { recursive: true });

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

export const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, AVATAR_DIR),
    filename: (req, file, cb) => {
      // Named from the session's userId and a timestamp — never from
      // user-controlled input — so there's no path-traversal or
      // extension-spoofing surface from the original filename.
      const ext = EXTENSION_BY_MIME[file.mimetype] || "";
      cb(null, `${req.session!.userId}-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (EXTENSION_BY_MIME[file.mimetype]) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, WEBP, or GIF images are allowed"));
    }
  },
});

// Best-effort cleanup of a previously uploaded avatar file when it's
// replaced or removed — avatarUrl is always "/avatars/<filename>" (set
// right below by our own upload handler), never arbitrary user input.
export function deleteAvatarFile(avatarUrl: string | null | undefined) {
  if (!avatarUrl || !avatarUrl.startsWith("/avatars/")) return;
  const filePath = path.join(AVATAR_DIR, path.basename(avatarUrl));
  fs.unlink(filePath, () => {});
}
