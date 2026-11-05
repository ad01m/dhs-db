import { Router } from "express";
import { listNotices, createNotice, deleteNotice } from "../controllers/noticeController.js";
import { protect, allowRoles } from "../middleware/authMiddleware.js";
const router = Router();
router.get("/", listNotices);
router.post("/", protect, allowRoles("admin"), createNotice);
router.delete("/:id", protect, allowRoles("admin"), deleteNotice);
export default router;
