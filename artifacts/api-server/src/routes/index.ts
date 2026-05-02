import { Router, type IRouter } from "express";
import healthRouter from "./health";
import modelHealthRouter from "./modelHealth";
import authRouter from "./auth";
import chatRouter from "./chat";
import statsRouter from "./stats";
import compareRouter from "./compare";
import { requireAuth } from "../middleware/requireAuth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(modelHealthRouter);
router.use(authRouter);

router.use(requireAuth);

router.use(chatRouter);
router.use(compareRouter);
router.use(statsRouter);

export default router;
