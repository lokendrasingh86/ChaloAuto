// here all routes file will be imported and exported to the main server file
import { Router } from "express";
import routeRoutes from "./route.routes.ts";
import ridesRoute from "./rides.route.ts";
import authRoute from "./auth.route.js";
const router = Router();

router.use("/rides", ridesRoute);
router.use("/auth", authRoute);
router.use("/routes", routeRoutes);

export default router;