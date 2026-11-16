import type { RequestHandler } from "express";
import { Router } from "express";
import {
  createRouteController,
  deleteRouteController,
  getAllRoutesController,
  getRouteByIdController,
  updateRouteController,
  findNearestRoutePointController,
} from "../controllers/route.controller.ts";
import { getAuthUser, verifyUser } from "../middleware/verifyUser.middleware.ts";

const router = Router();

/** Routes are shared infrastructure, so only users listed in ADMIN_USER_IDS may change them. */
const requireAdmin: RequestHandler = (req, res, next) => {
  const admins = (process.env.ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!admins.includes(getAuthUser(req).id)) {
    return res.status(403).json({ message: "Admin access required" });
  }
  return next();
};

router.use(verifyUser);

router.get("/", getAllRoutesController);
router.post("/find-nearest-route", findNearestRoutePointController);
router.get("/:id", getRouteByIdController);
router.post("/", requireAdmin, createRouteController);
router.put("/:id", requireAdmin, updateRouteController);
router.delete("/:id", requireAdmin, deleteRouteController);

export default router;
