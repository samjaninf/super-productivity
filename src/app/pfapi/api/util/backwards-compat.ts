import { LocalMeta, RemoteMeta, VectorClock } from '../pfapi.model';
import { lamportToVectorClock, isVectorClockEmpty } from './vector-clock';
import { pfLog } from './log';

/**
 * Utility functions for backwards compatibility with old field names.
 * This allows gradual migration from localLamport/lastSyncedLamport to
 * localChangeCounter/lastSyncedChangeCounter and to vector clocks.
 */

/**
 * Get the local change counter value, checking both old and new field names
 */
export const getLocalChangeCounter = (meta: LocalMeta | RemoteMeta): number => {
  // Prefer new field name if available
  if (meta.localChangeCounter !== undefined) {
    return meta.localChangeCounter;
  }
  // Fall back to old field name
  return meta.localLamport || 0;
};

/**
 * Get the last synced change counter value, checking both old and new field names
 */
export const getLastSyncedChangeCounter = (
  meta: LocalMeta | RemoteMeta,
): number | null => {
  // Prefer new field name if available
  if (meta.lastSyncedChangeCounter !== undefined) {
    return meta.lastSyncedChangeCounter;
  }
  // Fall back to old field name, ensuring we return null if undefined
  return meta.lastSyncedLamport ?? null;
};

/**
 * Create a new metadata object with the local change counter value set,
 * updating both old and new field names for backwards compatibility
 */
export const withLocalChangeCounter = <T extends LocalMeta | RemoteMeta>(
  meta: T,
  value: number,
): T => {
  return {
    ...meta,
    localLamport: value,
    localChangeCounter: value,
  };
};

/**
 * Create a new metadata object with the last synced change counter value set,
 * updating both old and new field names for backwards compatibility
 */
export const withLastSyncedChangeCounter = <T extends LocalMeta | RemoteMeta>(
  meta: T,
  value: number | null,
): T => {
  return {
    ...meta,
    lastSyncedLamport: value,
    lastSyncedChangeCounter: value,
  };
};

/**
 * @deprecated Use withLocalChangeCounter instead - this mutates the object
 */
export const setLocalChangeCounter = (
  meta: LocalMeta | RemoteMeta,
  value: number,
): void => {
  const updated = withLocalChangeCounter(meta, value);
  Object.assign(meta, updated);
};

/**
 * @deprecated Use withLastSyncedChangeCounter instead - this mutates the object
 */
export const setLastSyncedChangeCounter = (
  meta: LocalMeta | RemoteMeta,
  value: number | null,
): void => {
  const updated = withLastSyncedChangeCounter(meta, value);
  Object.assign(meta, updated);
};

/**
 * Create a metadata object with both old and new field names populated
 */
export const createBackwardsCompatibleMeta = <T extends LocalMeta | RemoteMeta>(
  meta: T,
): T => {
  const result = { ...meta };

  // Ensure both field names are populated
  if (result.localChangeCounter !== undefined && result.localLamport === undefined) {
    result.localLamport = result.localChangeCounter;
  } else if (
    result.localLamport !== undefined &&
    result.localChangeCounter === undefined
  ) {
    result.localChangeCounter = result.localLamport;
  } else if (
    result.localChangeCounter !== undefined &&
    result.localLamport !== undefined &&
    result.localChangeCounter !== result.localLamport
  ) {
    // Warn about field mismatch but use the newer field
    pfLog(1, 'WARN: Mismatch between localChangeCounter and localLamport fields', {
      localChangeCounter: result.localChangeCounter,
      localLamport: result.localLamport,
      using: 'localChangeCounter',
    });
    result.localLamport = result.localChangeCounter;
  }

  if (
    result.lastSyncedChangeCounter !== undefined &&
    result.lastSyncedLamport === undefined
  ) {
    result.lastSyncedLamport = result.lastSyncedChangeCounter;
  } else if (
    result.lastSyncedLamport !== undefined &&
    result.lastSyncedChangeCounter === undefined
  ) {
    result.lastSyncedChangeCounter = result.lastSyncedLamport;
  } else if (
    result.lastSyncedChangeCounter !== undefined &&
    result.lastSyncedLamport !== undefined &&
    result.lastSyncedChangeCounter !== result.lastSyncedLamport
  ) {
    // Warn about field mismatch but use the newer field
    pfLog(
      1,
      'WARN: Mismatch between lastSyncedChangeCounter and lastSyncedLamport fields',
      {
        lastSyncedChangeCounter: result.lastSyncedChangeCounter,
        lastSyncedLamport: result.lastSyncedLamport,
        using: 'lastSyncedChangeCounter',
      },
    );
    result.lastSyncedLamport = result.lastSyncedChangeCounter;
  }

  return result;
};

/**
 * Get the vector clock, creating it from Lamport timestamp if needed
 * @param meta The metadata object
 * @param clientId The client ID to use for migration
 * @returns The vector clock
 */
export const getVectorClock = (
  meta: LocalMeta | RemoteMeta,
  clientId: string,
): VectorClock | undefined => {
  // Return existing vector clock if available
  if (meta.vectorClock && !isVectorClockEmpty(meta.vectorClock)) {
    return meta.vectorClock;
  }

  // Migrate from Lamport timestamp if available
  const changeCounter = getLocalChangeCounter(meta);
  if (changeCounter > 0) {
    return lamportToVectorClock(changeCounter, clientId);
  }

  return undefined;
};

/**
 * Get the last synced vector clock, creating it from Lamport timestamp if needed
 * @param meta The metadata object
 * @param clientId The client ID to use for migration
 * @returns The last synced vector clock
 */
export const getLastSyncedVectorClock = (
  meta: LocalMeta | RemoteMeta,
  clientId: string,
): VectorClock | null => {
  // Return existing vector clock if available
  if (meta.lastSyncedVectorClock && !isVectorClockEmpty(meta.lastSyncedVectorClock)) {
    return meta.lastSyncedVectorClock;
  }

  // Migrate from Lamport timestamp if available
  const lastSyncedCounter = getLastSyncedChangeCounter(meta);
  if (lastSyncedCounter != null && lastSyncedCounter > 0) {
    return lamportToVectorClock(lastSyncedCounter, clientId);
  }

  return null;
};

/**
 * Create a new metadata object with the vector clock set and Lamport timestamps updated
 * @param meta The metadata object
 * @param vectorClock The vector clock to set
 * @param clientId The client ID for this instance
 * @returns A new metadata object with updated vector clock
 */
export const withVectorClock = <T extends LocalMeta | RemoteMeta>(
  meta: T,
  vectorClock: VectorClock,
  clientId: string,
): T => {
  // Update Lamport timestamps for backwards compatibility
  // Use this client's component value
  const clientValue = vectorClock[clientId] || 0;

  return {
    ...meta,
    vectorClock,
    localLamport: clientValue,
    localChangeCounter: clientValue,
  };
};

/**
 * Create a new metadata object with the last synced vector clock set and Lamport timestamps updated
 * @param meta The metadata object
 * @param vectorClock The vector clock to set (can be null)
 * @param clientId The client ID for this instance
 * @returns A new metadata object with updated last synced vector clock
 */
export const withLastSyncedVectorClock = <T extends LocalMeta | RemoteMeta>(
  meta: T,
  vectorClock: VectorClock | null,
  clientId: string,
): T => {
  // Update Lamport timestamps for backwards compatibility
  const lastSyncedValue = vectorClock ? vectorClock[clientId] || 0 : null;

  return {
    ...meta,
    lastSyncedVectorClock: vectorClock,
    lastSyncedLamport: lastSyncedValue,
    lastSyncedChangeCounter: lastSyncedValue,
  };
};

/**
 * @deprecated Use withVectorClock instead - this mutates the object
 */
export const setVectorClock = (
  meta: LocalMeta | RemoteMeta,
  vectorClock: VectorClock,
  clientId: string,
): void => {
  const updated = withVectorClock(meta, vectorClock, clientId);
  Object.assign(meta, updated);
};

/**
 * @deprecated Use withLastSyncedVectorClock instead - this mutates the object
 */
export const setLastSyncedVectorClock = (
  meta: LocalMeta | RemoteMeta,
  vectorClock: VectorClock | null,
  clientId: string,
): void => {
  const updated = withLastSyncedVectorClock(meta, vectorClock, clientId);
  Object.assign(meta, updated);
};

/**
 * Check if both metadata objects have vector clocks
 * @param local Local metadata
 * @param remote Remote metadata
 * @returns True if both have non-empty vector clocks
 */
export const hasVectorClocks = (local: LocalMeta, remote: RemoteMeta): boolean => {
  return (
    !isVectorClockEmpty(local.vectorClock) && !isVectorClockEmpty(remote.vectorClock)
  );
};
