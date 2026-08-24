import { Router } from "express";
import {
  postPublicContact,
  postPublicPricingQuote,
  postPublicSignup,
} from "../controllers/public.controller.js";

export const publicRouter = Router();

publicRouter.post("/signup", postPublicSignup);
publicRouter.post("/contact", postPublicContact);
publicRouter.post("/pricing/quote", postPublicPricingQuote);
publicRouter.post("/subscription/pricing", postPublicPricingQuote);
