import type { Router } from "h3";
import { registerAdminBannerRoutes } from "~/server/api/admin/banner-routes";
import { registerAdminDirectoryRoutes } from "~/server/api/admin/directory-routes";
import { registerAdminCatalogRoutes } from "~/server/api/admin/catalog-routes";

export function registerAdminRoutes(router: Router): void {
  registerAdminBannerRoutes(router);
  registerAdminDirectoryRoutes(router);
  registerAdminCatalogRoutes(router);
}
