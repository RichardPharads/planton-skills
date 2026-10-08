// The technologies a card can name (`tech` in a plan file): what the project workspace's palette offers, the name the
// phone shows under a card's title, and the symbol a database gets on a Flowchart. Plain data, shared by the app, the
// workspace and the skills' validator. Logos aren't here: the workspace draws them (workspace/src/logos.ts) from `icon`,
// a Simple Icons slug, or a letter tile when it's null.
import type { FlowNodeType } from "./workflows.ts";

export type TechKind =
  "frontend" | "backend" | "database" | "cache" | "auth" | "payments" | "storage" | "hosting" | "ai" | "messaging";

/** In the palette's order. */
export const TECH_KINDS: { id: TechKind; label: string }[] = [
  { id: "frontend", label: "Frontend" },
  { id: "backend", label: "Backend" },
  { id: "database", label: "Database" },
  { id: "cache", label: "Cache and queues" },
  { id: "auth", label: "Auth" },
  { id: "payments", label: "Payments" },
  { id: "storage", label: "Storage" },
  { id: "hosting", label: "Hosting" },
  { id: "ai", label: "AI" },
  { id: "messaging", label: "Messaging" },
];

export type Tech = { id: string; name: string; kind: TechKind; icon: string | null };

/** A technology id in a plan file. Any well-formed one is accepted, so a plan written with a newer list still opens. */
export const TECH_ID_PATTERN = /^[a-z0-9-]{1,40}$/;

export const TECH_CATALOG: Tech[] = [
  { id: "nextjs", name: "Next.js", kind: "frontend", icon: "nextdotjs" },
  { id: "react", name: "React", kind: "frontend", icon: "react" },
  { id: "vue", name: "Vue", kind: "frontend", icon: "vuedotjs" },
  { id: "svelte", name: "Svelte", kind: "frontend", icon: "svelte" },
  { id: "angular", name: "Angular", kind: "frontend", icon: "angular" },
  { id: "expo", name: "Expo", kind: "frontend", icon: "expo" },
  { id: "flutter", name: "Flutter", kind: "frontend", icon: "flutter" },
  { id: "nodejs", name: "Node.js", kind: "backend", icon: "nodedotjs" },
  { id: "express", name: "Express", kind: "backend", icon: "express" },
  { id: "nestjs", name: "NestJS", kind: "backend", icon: "nestjs" },
  { id: "django", name: "Django", kind: "backend", icon: "django" },
  { id: "fastapi", name: "FastAPI", kind: "backend", icon: "fastapi" },
  { id: "laravel", name: "Laravel", kind: "backend", icon: "laravel" },
  { id: "rails", name: "Ruby on Rails", kind: "backend", icon: "rubyonrails" },
  { id: "spring", name: "Spring", kind: "backend", icon: "spring" },
  { id: "go", name: "Go", kind: "backend", icon: "go" },
  { id: "dotnet", name: ".NET", kind: "backend", icon: "dotnet" },
  { id: "prisma", name: "Prisma", kind: "backend", icon: "prisma" },
  { id: "postgresql", name: "PostgreSQL", kind: "database", icon: "postgresql" },
  { id: "mysql", name: "MySQL", kind: "database", icon: "mysql" },
  { id: "sqlite", name: "SQLite", kind: "database", icon: "sqlite" },
  { id: "mongodb", name: "MongoDB", kind: "database", icon: "mongodb" },
  { id: "supabase", name: "Supabase", kind: "database", icon: "supabase" },
  { id: "firebase", name: "Firebase", kind: "database", icon: "firebase" },
  { id: "redis", name: "Redis", kind: "cache", icon: "redis" },
  { id: "rabbitmq", name: "RabbitMQ", kind: "cache", icon: "rabbitmq" },
  { id: "kafka", name: "Kafka", kind: "cache", icon: "apachekafka" },
  { id: "auth0", name: "Auth0", kind: "auth", icon: "auth0" },
  { id: "clerk", name: "Clerk", kind: "auth", icon: "clerk" },
  { id: "stripe", name: "Stripe", kind: "payments", icon: "stripe" },
  { id: "paypal", name: "PayPal", kind: "payments", icon: "paypal" },
  { id: "polar", name: "Polar", kind: "payments", icon: null },
  { id: "s3", name: "Amazon S3", kind: "storage", icon: null },
  { id: "r2", name: "Cloudflare R2", kind: "storage", icon: "cloudflare" },
  { id: "vercel", name: "Vercel", kind: "hosting", icon: "vercel" },
  { id: "netlify", name: "Netlify", kind: "hosting", icon: "netlify" },
  { id: "aws", name: "AWS", kind: "hosting", icon: null },
  { id: "gcp", name: "Google Cloud", kind: "hosting", icon: "googlecloud" },
  { id: "docker", name: "Docker", kind: "hosting", icon: "docker" },
  { id: "cloudflare", name: "Cloudflare", kind: "hosting", icon: "cloudflare" },
  { id: "claude", name: "Claude", kind: "ai", icon: "claude" },
  { id: "openai", name: "OpenAI", kind: "ai", icon: null },
  { id: "twilio", name: "Twilio", kind: "messaging", icon: null },
  { id: "resend", name: "Resend", kind: "messaging", icon: "resend" },
];

const BY_ID = new Map(TECH_CATALOG.map((tech) => [tech.id, tech]));

export function findTech(id: string): Tech | null {
  return BY_ID.get(id) ?? null;
}

/** The name to show for a card's technology: the catalog's, or the id itself for one it doesn't have. */
export function techName(id: string): string {
  return BY_ID.get(id)?.name ?? id;
}

/** The Flowchart symbol a card gets from its technology when the file names none: databases and caches are cylinders. */
export function techShape(id: string): FlowNodeType | null {
  const kind = BY_ID.get(id)?.kind;
  return kind === "database" || kind === "cache" ? "database" : null;
}

/** Ids the catalog doesn't have, each once, for the validator's warning. */
export function unknownTechIds(nodes: { tech: string | null }[]): string[] {
  const ids = nodes.map((node) => node.tech).filter((id): id is string => id !== null && !BY_ID.has(id));
  return [...new Set(ids)];
}

/** The palette's search: by name or id, any case. An empty search lists everything. */
export function searchTech(query: string): Tech[] {
  const wanted = query.trim().toLowerCase();
  if (!wanted) return TECH_CATALOG;
  return TECH_CATALOG.filter((tech) => tech.name.toLowerCase().includes(wanted) || tech.id.includes(wanted));
}
