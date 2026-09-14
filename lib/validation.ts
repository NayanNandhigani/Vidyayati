import { z } from "zod";

// The only place Zod is used in this codebase — everywhere else validates
// FormData by hand (typeof/trim checks). Kept contained to this one shared
// schema rather than a springboard to rewrite other actions' validation.
export const newPasswordSchema = z
  .object({
    newPassword: z.string().min(8, "Password must be at least 8 characters."),
    username: z.string(),
  })
  .refine((data) => data.newPassword.toLowerCase() !== data.username.toLowerCase(), {
    message: "Password can't be the same as your username.",
    path: ["newPassword"],
  });
