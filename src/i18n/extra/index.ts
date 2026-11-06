import * as incidents from "./incidents";
import * as offline from "./offline";
import * as operations from "./operations";
import * as trips from "./trips";
import * as workforce from "./workforce";

const parts = [incidents, trips, workforce, operations, offline];

/** Dictionnaires par domaine, séparés pour que plusieurs chantiers puissent les compléter sans conflit. */
export const EXTRA_EN: Record<string, string> = Object.assign({}, ...parts.map((p) => p.EN));
export const EXTRA_DE: Record<string, string> = Object.assign({}, ...parts.map((p) => p.DE));
export const EXTRA_ES: Record<string, string> = Object.assign({}, ...parts.map((p) => p.ES));
