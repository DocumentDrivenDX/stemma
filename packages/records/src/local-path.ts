// What looks like a path on someone's machine (CONTRACT-005 E). Every output
// that leaves out local paths uses these rules.

/** A value that is a path on someone's machine, in whatever field it was put. */
export const LOCAL_PATH = /^\s*(file:|~[\\/]|[A-Za-z]:[\\/]|\\\\|\/(Users|home|private|tmp|var|Volumes|mnt|media|nix|opt|root|etc|srv)\/)/i;
/** An absolute POSIX path of two or more segments, a drive or network path, a `~` path or a `file:` address. A URL is none of these. */
const WHOLE_PATH = /^\s*(file:|~[\w.-]*[\\/]|[A-Za-z]:[\\/]|\\\\|\/(?!\/)[^/\r\n]+\/+[^/\s])/i;
/** How Stemma writes an origin that is no web address into an upstream's note. */
const ORIGIN_NOTE = /^Obtained from: /;

/**
 * `location` is for a field where someone says where something is. There, any
 * value that is as a whole a path is one, whichever directory it begins in.
 */
export const isLocalPath = (value: string, location = false): boolean =>
  LOCAL_PATH.test(value) || (location && WHOLE_PATH.test(value.replace(ORIGIN_NOTE, "")));
