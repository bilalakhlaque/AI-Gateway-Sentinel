import { Router, type IRouter } from "express";
import healthRouter from "./health";
import chatRouter from "./chat";
import statsRouter from "./stats";
import compareRouter from "./compare";

const router: IRouter = Router();

router.use(healthRouter);
router.use(chatRouter);
router.use(compareRouter);
router.use(statsRouter);

export default router;
