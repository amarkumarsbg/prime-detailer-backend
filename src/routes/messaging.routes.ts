import { Router } from "express";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { requireWorkshopAccess } from "../middleware/workshop-access.js";
import {
  postSmsTest,
  postTransactionalEmail,
  postWhatsApp,
  postWhatsAppTest,
} from "../controllers/messaging.controller.js";

export const messagingRouter = Router();

messagingRouter.use(requireAuth);
messagingRouter.use(requireWorkshopAccess);

/** Test/diagnostic sends — settings admins only. Operational send stays auth-only (cross-feature). */
messagingRouter.post("/sms/test", requirePermission("SETTINGS"), postSmsTest);
messagingRouter.post("/whatsapp/test", requirePermission("SETTINGS"), postWhatsAppTest);
messagingRouter.post("/whatsapp", postWhatsApp);
messagingRouter.post("/email", postTransactionalEmail);
