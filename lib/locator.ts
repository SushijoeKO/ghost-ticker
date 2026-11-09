import gaz from "./gazetteer.json" with { type: "json" };
import { makeLocator, type GazEntry } from "./places.ts";
export const locate = makeLocator(gaz as GazEntry[]);
