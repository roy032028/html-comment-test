import { eq } from "drizzle-orm";
import { db } from "./db";
import { projects } from "./db/schema";
import { DEFAULT_PROJECT_ID } from "./constants";

export { DEFAULT_PROJECT_ID };

export async function ensureDefaultProject() {
  const existing = await db
    .select()
    .from(projects)
    .where(eq(projects.id, DEFAULT_PROJECT_ID))
    .get();

  if (!existing) {
    await db
      .insert(projects)
      .values({ id: DEFAULT_PROJECT_ID, name: "HTML 리뷰" });
  }
}
