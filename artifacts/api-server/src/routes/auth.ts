import { Router, type IRouter } from "express";
import { z } from "zod";
import { createUser, authenticateUser } from "../lib/userStore";
import { signToken } from "../lib/jwtHelper";

const router: IRouter = Router();

const AuthBody = z.object({
  username: z.string().min(2).max(32).regex(/^[a-zA-Z0-9_-]+$/, "Only letters, numbers, _ and - allowed"),
  password: z.string().min(6).max(128),
});

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = AuthBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid input" });
    return;
  }

  const { username, password } = parsed.data;
  const user = createUser(username, password);
  if (!user) {
    res.status(409).json({ error: "Username already taken" });
    return;
  }

  const token = await signToken({ userId: user.userId, username: user.username });
  res.status(201).json({ token, userId: user.userId, username: user.username });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = AuthBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid input" });
    return;
  }

  const { username, password } = parsed.data;
  const user = authenticateUser(username, password);
  if (!user) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  const token = await signToken({ userId: user.userId, username: user.username });
  res.json({ token, userId: user.userId, username: user.username });
});

export default router;
