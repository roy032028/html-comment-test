import { sqliteTable, text, real, integer, blob } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const files = sqliteTable("files", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  // gzip으로 압축된 HTML 바이트 (업로드 요청 크기 축소). 서빙 시 서버가 해제.
  content: blob("content", { mode: "buffer" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const pins = sqliteTable("pins", {
  id: text("id").primaryKey(),
  fileId: text("file_id")
    .notNull()
    .references(() => files.id, { onDelete: "cascade" }),
  xPercent: real("x_percent").notNull(),
  yPercent: real("y_percent").notNull(),
  selector: text("selector"),
  offsetX: real("offset_x"),
  offsetY: real("offset_y"),
  anchorText: text("anchor_text"),
  openerSelector: text("opener_selector"),
  authorName: text("author_name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const comments = sqliteTable("comments", {
  id: text("id").primaryKey(),
  pinId: text("pin_id")
    .notNull()
    .references(() => pins.id, { onDelete: "cascade" }),
  authorName: text("author_name").notNull(),
  body: text("body").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
