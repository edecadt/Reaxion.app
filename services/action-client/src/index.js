import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const port = Number(process.env.PORT || 8081);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "..", "public");

app.use(express.static(publicDir));

app.get("*", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Client web listening on port ${port}`);
});
