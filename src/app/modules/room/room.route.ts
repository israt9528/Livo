import { Router } from "express";
import { RoomController } from "./room.controller.js";
import { createRoomSchema, updateRoomSchema } from "./room.validation.js";
import { UserRole } from "../../lib/prisma.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { auth } from "../../middleware/auth.js";
import { uploadMultipleImages } from "../../middleware/upload.js";

const router = Router();

// Public discovery endpoints
router.get("/", RoomController.getAllRooms);
router.get("/:id", RoomController.getRoomById);

// Owner & Admin endpoints
router.post(
  "/",
  auth(UserRole.OWNER, UserRole.ADMIN),
  validateRequest(createRoomSchema),
  RoomController.createRoom,
);

router.patch(
  "/:id",
  auth(UserRole.OWNER, UserRole.ADMIN),
  validateRequest(updateRoomSchema),
  RoomController.updateRoom,
);

// Upload images via Postman multipart form-data
router.patch(
  "/:id/images",
  auth(UserRole.OWNER, UserRole.ADMIN),
  uploadMultipleImages,
  RoomController.uploadImages,
);

export const roomRoutes = router;
export default router;
