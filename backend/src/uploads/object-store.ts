/** `<uuid>.<ext>` — keys are generated server-side, never client-controlled. */
export const OBJECT_KEY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

/**
 * Binary object persistence for processed material photos. Implementations
 * must never expose objects publicly: bytes are only returned through
 * `get()`, and the authorized `GET /uploads/:key` route remains the single
 * read path for every driver. Credentials stay server-side.
 */
export abstract class ObjectStore {
  /** Persists `body` under `key`; throws on failure (never partial success). */
  abstract put(key: string, body: Buffer, contentType: string): Promise<void>;
  /** Returns the object's bytes, or undefined when the key does not exist. */
  abstract get(key: string): Promise<Buffer | undefined>;
}
