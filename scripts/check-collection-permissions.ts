/**
 * Fails if COLLECTION_PERMISSION_MAP is missing a registered collection
 * or contains orphan keys. Run: npm run test:collection-permissions
 */
import {
  collectionPermissionMapIsComplete,
  COLLECTION_PERMISSION_MAP,
  allRegisteredCollections,
} from "../src/constants/collection-permissions.js";

const registered = allRegisteredCollections();
const mapped = Object.keys(COLLECTION_PERMISSION_MAP);

const missing = registered.filter((name) => !COLLECTION_PERMISSION_MAP[name]);
const orphans = mapped.filter((name) => !registered.includes(name));

if (!collectionPermissionMapIsComplete() || missing.length || orphans.length) {
  console.error("COLLECTION_PERMISSION_MAP is incomplete or has orphan keys.");
  if (missing.length) console.error("Missing mappings:", missing.join(", "));
  if (orphans.length) console.error("Orphan map keys:", orphans.join(", "));
  process.exit(1);
}

console.log(
  `OK: ${mapped.length} collections mapped (arrays + singletons). Default-deny map is complete.`
);
