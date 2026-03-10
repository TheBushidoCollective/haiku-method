import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().default(3000),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  NEXTAUTH_SECRET: z.string().min(1),
  NEXTAUTH_URL: z.string().url().optional(),
});

// Lazily validate env so that `next build` can compile pages without
// requiring every runtime env var to be present at build time.
let _env: z.infer<typeof envSchema> | undefined;

export function getEnv(): z.infer<typeof envSchema> {
  if (!_env) {
    _env = envSchema.parse(process.env);
  }
  return _env;
}

/** @deprecated — prefer `getEnv()` for lazy validation. Kept for existing imports. */
export const env = new Proxy({} as z.infer<typeof envSchema>, {
  get(_target, prop: string) {
    return getEnv()[prop as keyof z.infer<typeof envSchema>];
  },
});
