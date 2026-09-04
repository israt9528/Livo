import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z
    .string({ error: "Name must be a string" })
    .trim()
    .min(2, { message: "Name must be at least 2 characters" })
    .max(100, { message: "Name cannot exceed 100 characters" })
    .optional(),
  phoneNumber: z
    .string({ error: "Phone number must be a string" })
    .trim()
    .regex(/^\+?[1-9]\d{7,14}$/, {
      message: "Invalid phone number format (E.164 recommended)",
    })
    .optional(),
  avatarUrl: z
    .string({ error: "Avatar URL must be a string" })
    .trim()
    .url({ message: "Avatar URL must be a valid URL" })
    .optional(),
  bio: z
    .string({ error: "Bio must be a string" })
    .trim()
    .max(500, { message: "Bio cannot exceed 500 characters" })
    .optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
