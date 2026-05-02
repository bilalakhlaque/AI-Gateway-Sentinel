import { Router, type IRouter } from "express";
import healthRouter from "./health";
import modelHealthRouter from "./modelHealth";
import chatRouter from "./chat";
import statsRouter from "./stats";
import compareRouter from "./compare";

const router: IRouter = Router();

router.use(healthRouter);
router.use(modelHealthRouter);
router.use(chatRouter);
router.use(compareRouter);
router.use(statsRouter);

export default router;
