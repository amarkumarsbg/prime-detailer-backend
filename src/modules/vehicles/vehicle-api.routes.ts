import { Router } from "express";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import {
  getVehicles,
  postVehicle,
  postVehiclesBulk,
  putVehicle,
  removeVehicle,
  postVehicleSnapshot,
} from "./vehicle-api.controller.js";

export const vehicleApiRouter = Router();

vehicleApiRouter.use(requireAuth);
vehicleApiRouter.use(requirePermission("VEHICLES"));

vehicleApiRouter.get("/", getVehicles);
vehicleApiRouter.post("/snapshot", postVehicleSnapshot);
vehicleApiRouter.post("/bulk", postVehiclesBulk);
vehicleApiRouter.post("/", postVehicle);
vehicleApiRouter.put("/:id", putVehicle);
vehicleApiRouter.delete("/:id", removeVehicle);
