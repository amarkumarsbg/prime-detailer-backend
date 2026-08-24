import { Router } from "express";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { getBranches, postBranch, putBranch, getBranchDeletionCheck, deleteBranch } from "./branch-api.controller.js";

export const branchApiRouter = Router();

branchApiRouter.use(requireAuth);
branchApiRouter.use(requirePermission("BRANCHES"));

branchApiRouter.get("/", getBranches);
branchApiRouter.get("/:id/deletion-check", getBranchDeletionCheck);
branchApiRouter.post("/", postBranch);
branchApiRouter.put("/:id", putBranch);
branchApiRouter.delete("/:id", deleteBranch);
