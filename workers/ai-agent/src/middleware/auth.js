/**
 * Auth middleware — verifikasi shared secret antara bot ↔ worker
 * Bot harus mengirim header: Authorization: Bearer <AUTH_SECRET>
 */

export function authMiddleware(c, next) {
  const authHeader = c.req.header('Authorization');
  const secret = c.env.AUTH_SECRET;

  // Kalau AUTH_SECRET belum di-set, skip auth (dev mode)
  if (!secret) return next();

  if (!authHeader || authHeader !== `Bearer ${secret}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  return next();
}
