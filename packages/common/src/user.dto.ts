import { z } from "zod";

export const UserSchema = z.object({
  id: z.string(),
  email: z.email(),
  createdAt: z.date(),
});

export type UserDto = z.infer<typeof UserSchema>;
