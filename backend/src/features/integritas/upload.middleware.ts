import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import multer from "multer";

const uploadDir = path.join(os.tmpdir(), "integritas-pi-uploads");
fs.mkdirSync(uploadDir, { recursive: true });

export const upload = multer({ dest: uploadDir });
