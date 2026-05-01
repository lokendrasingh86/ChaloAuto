import { Router } from "express";
import {
  createRouteController,
  deleteRouteController,
    getAllRoutesController,
    getRouteByIdController,
    updateRouteController,
} from "../controllers/route.controller.ts";

const router = Router();

router.get("/:id", getRouteByIdController);
router.post("/", createRouteController);
router.put("/:id", updateRouteController);
router.delete("/:id", deleteRouteController);
router.get("/", getAllRoutesController);

export default router;