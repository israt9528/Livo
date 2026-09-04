import { Router } from "express";
import { MediaController } from "./media.controller.js";
import { auth } from "../../middleware/auth.js";
import { uploadSingleImage } from "../../middleware/upload.js";

const router = Router();

// Protected upload endpoint for any authenticated user
router.post("/upload", auth(), uploadSingleImage, MediaController.uploadSingle);

export const mediaRoutes = router;
export default router;
