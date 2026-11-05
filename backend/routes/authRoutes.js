import { Router } from "express";
import { login, getMe, updateMe, changePassword, createUser } from "../controllers/authController.js";
import { protect, allowRoles } from "../middleware/authMiddleware.js";
import { rateLimit } from "../middleware/rateLimit.js";

const router = Router();
router.post("/login", rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: "Too many sign-in attempts. Please try again in 15 minutes." }), login);
router.get("/me", protect, getMe);
router.patch("/me", protect, allowRoles("admin"), updateMe);
router.patch("/password", protect, allowRoles("admin"), rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: "Too many password change attempts. Please try again in 15 minutes." }), changePassword);
router.post("/users", protect, allowRoles("admin"), createUser);
export default router;
