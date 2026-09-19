import { useState, useEffect } from 'react';
import { onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { getAccountCollection, db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { trackSnapshotPendingWrites, unregisterPendingSource } from '@/hooks/useSyncStatus';
import type { ActivityLog } from '@/types/domain';

export interface UseActivityLogResult {
  logs: ActivityLog[];
  isLoading: boolean;
  error: Error | null;
}

export function useActivityLog(maxItems: number = 15): UseActivityLogResult {
  const { currentAccount } = useAuth();
  const accountId = currentAccount?.id;

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const sourceId = 'activity-feed-listener';
    setIsLoading(true);

    const activityCol = getAccountCollection<ActivityLog>(db, 'activity_logs', accountId);
    const q = query(
      activityCol,
      orderBy('timestamp', 'desc'),
      limit(maxItems)
    );

    const unsubscribe = onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snapshot) => {
        trackSnapshotPendingWrites(sourceId, snapshot);
        const docs: ActivityLog[] = snapshot.docs.map(doc => ({
          ...(doc.data() as ActivityLog),
          id: doc.id
        }));
        setLogs(docs);
        setIsLoading(false);
        setError(null);
      },
      (err) => {
        console.error('[useActivityLog] Snapshot error:', err);
        setError(err);
        setIsLoading(false);
      }
    );

    return () => {
      unsubscribe();
      unregisterPendingSource(sourceId);
    };
  }, [maxItems, accountId]);

  return { logs, isLoading, error };
}
