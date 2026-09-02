import { Router } from "express";
import {
  postPublicContact,
  postPublicPricingQuote,
  postPublicRegister,
  postPublicSignup,
} from "../controllers/public.controller.js";

export const publicRouter = Router();

publicRouter.post("/signup", postPublicSignup);
publicRouter.post("/register", postPublicRegister);
publicRouter.post("/contact", postPublicContact);
publicRouter.post("/pricing/quote", postPublicPricingQuote);
publicRouter.post("/subscription/pricing", postPublicPricingQuote);
