// Pictures that ship with the app and can be a workflow's cover. Saved by name, not by path: a bundled image's path
// differs between development and release builds and changes with every update. The images themselves are in
// src/constants/built-in-cover-images.ts.

export const BUILT_IN_COVERS = ["guide-freeform", "guide-steps", "guide-scheduled", "guide-flowchart"] as const;

export type BuiltInCoverName = (typeof BUILT_IN_COVERS)[number];

export function isBuiltInCover(name: unknown): name is BuiltInCoverName {
  return typeof name === "string" && (BUILT_IN_COVERS as readonly string[]).includes(name);
}
