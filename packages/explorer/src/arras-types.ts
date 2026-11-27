// The types of the two arras interfaces the pages pass to its browser, taken
// from the functions of its static profile.
import type { createStaticClient, staticSchemaApi } from "@documentdrivendx/arras-ui/static";

export type ArrasClient = ReturnType<typeof createStaticClient>;
export type SchemaApi = ReturnType<typeof staticSchemaApi>;
