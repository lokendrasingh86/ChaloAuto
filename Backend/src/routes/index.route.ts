// All route files are combined here and mounted under /api in app.ts
import { Router } from "express";
import routeRoutes from "./route.routes.ts";
import ridesRoute from "./rides.route.ts";
import authRoute from "./auth.route.ts";
import userRoute from "./user.route.ts";
import simulationRoute from "./simulation.route.ts";

const router = Router();

router.use("/auth", authRoute); // public (login)
router.use("/simulation", simulationRoute); // public (read-only results)
router.use("/rides", ridesRoute); // protected
router.use("/routes", routeRoutes); // protected
router.use("/users", userRoute); // protected

export default router;
