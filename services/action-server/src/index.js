import express from "express";

const app = express();
const port = Number(process.env.PORT || 8080);

app.set("trust proxy", true);

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:8081");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  next();
});

const services = [
  {
    name: "facebook",
    actions: [
      {
        name: "new_post",
        description: "Triggered when a user publishes a new post.",
      },
      {
        name: "new_comment",
        description: "Triggered when a comment is added to a post.",
      },
    ],
    reactions: [
      {
        name: "send_email",
        description: "Send an email notification to subscribed users.",
      },
      {
        name: "save_to_archive",
        description: "Archive the event inside the dashboard.",
      },
    ],
  },
];

app.get("/about.json", (req, res) => {
  const forwardedFor = req.headers["x-forwarded-for"];
  const clientHost = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : typeof forwardedFor === "string"
    ? forwardedFor.split(",")[0].trim()
    : req.ip || req.socket.remoteAddress || "";

  res.json({
    client: {
      host: clientHost,
    },
    server: {
      current_time: Math.floor(Date.now() / 1000),
      services,
    },
  });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Server listening on port ${port}`);
});
