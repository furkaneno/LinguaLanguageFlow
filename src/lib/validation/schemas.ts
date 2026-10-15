import { z } from "zod";
import { LIMITS } from "@/config/app";

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export const registerSchema = z
  .object({
    email: z.string().trim().email("Enter a valid email address."),
    password: z.string().min(8, "Use at least 8 characters."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match." });

export const resetSchema = z.object({ email: z.string().trim().email("Enter a valid email address.") });

export const classSchema = z.object({
  name: z.string().trim().min(1, "Give your class a name.").max(LIMITS.classNameMax, `Keep the name under ${LIMITS.classNameMax} characters.`),
  description: z.string().trim().max(LIMITS.descriptionMax, `Keep the description under ${LIMITS.descriptionMax} characters.`),
});

export const cardSchema = z.object({
  englishText: z.string().trim().min(1, "Enter the English text.").max(LIMITS.textMax, `Keep it under ${LIMITS.textMax} characters.`),
  turkishMeaning: z.string().trim().min(1, "Enter the Turkish meaning.").max(LIMITS.textMax, `Keep it under ${LIMITS.textMax} characters.`),
});

export type ClassInput = z.infer<typeof classSchema>;
export type CardInput = z.infer<typeof cardSchema>;

/** Returns first message per field, or null when valid. */
export function fieldErrors<T extends z.ZodTypeAny>(schema: T, data: unknown): Record<string, string> | null {
  const r = schema.safeParse(data);
  if (r.success) return null;
  const out: Record<string, string> = {};
  for (const i of r.error.issues) out[String(i.path[0] ?? "form")] ??= i.message;
  return out;
}
