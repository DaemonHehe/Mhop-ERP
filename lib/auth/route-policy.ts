const exactPublicRoutes = new Set(["/", "/login"]);

const publicRoutePrefixes = [
  "/shop",
  "/warranty",
  "/api/media",
  "/api/telegram/webhook",
  "/api/n8n/webhook",
  "/api/internal",
  "/api/member-card",
];

export function isPublicRoute(pathname: string) {
  if (exactPublicRoutes.has(pathname)) return true;
  return publicRoutePrefixes.some(
    (prefix) =>
      pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

