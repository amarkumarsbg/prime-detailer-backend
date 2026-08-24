import { Router } from "express";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import {
  getParties,
  getParty,
  getPartyLedgerHandler,
  postParty,
  putParty,
  removeParty,
} from "./party.controller.js";

export const partyRouter = Router();

partyRouter.use(requireAuth);
partyRouter.use(requirePermission("PARTIES"));

partyRouter.get("/", getParties);
partyRouter.post("/", postParty);
partyRouter.get("/:id/ledger", getPartyLedgerHandler);
partyRouter.get("/:id", getParty);
partyRouter.put("/:id", putParty);
partyRouter.delete("/:id", removeParty);
