import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";
import { buildRobots } from "@/features/marketing/seo";

/** /robots.txt: el sitio público se indexa; /app, /admin, /api, /auth y el acceso, no. */
export default function robots(): MetadataRoute.Robots {
  return buildRobots(siteUrl());
}
