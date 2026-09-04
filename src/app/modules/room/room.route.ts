import { Router } from "express";
import { RoomController } from "./room.controller.js";
import { createRoomSchema, updateRoomSchema } from "./room.validation.js";
import { UserRole } from "../../lib/prisma.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { auth } from "../../middleware/auth.js";

const router = Router();

// Public detail endpoint
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

export const roomRoutes = router;
export default router;
