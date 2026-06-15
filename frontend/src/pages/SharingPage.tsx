import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useCollection, useRevokeShare, useShares } from "../api/hooks";
import { PageHeader, Spinner, Empty } from "../components/ui";
import type { Share } from "../types";

export default function SharingPage() {
  const { user } = useAuth();
  const shares = useShares();

  if (shares.isLoading) return <Spinner />;

  const mine = (shares.data ?? []).filter((s) => s.owner_id === user?.id);
  const toMe = (shares.data ?? []).filter((s) => s.shared_with_user_id === user?.id);

  return (
    <div>
      <PageHeader title="Sharing" subtitle="Share collections with approved users." />

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-gray-400">
          Shared by me
        </h2>
        {mine.length === 0 ? (
          <Empty>You haven't shared any collections. Open a collection to share it.</Empty>
        ) : (
          <div className="space-y-2">
            {mine.map((s) => (
              <ShareRow key={s.id} share={s} owned />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-gray-400">
          Shared with me
        </h2>
        {toMe.length === 0 ? (
          <Empty>Nothing has been shared directly with you.</Empty>
        ) : (
          <div className="space-y-2">
            {toMe.map((s) => (
              <ShareRow key={s.id} share={s} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ShareRow({ share, owned }: { share: Share; owned?: boolean }) {
  const collection = useCollection(share.collection_id);
  const revoke = useRevokeShare();
  const name = collection.data?.name ?? `Collection #${share.collection_id}`;

  return (
    <div className="card flex items-center justify-between">
      <div>
        <Link to={`/shared/${share.token}`} className="text-accent hover:underline">
          {name}
        </Link>
        <div className="text-xs text-gray-500">
          {share.shared_with_user_id ? "Direct grant" : "Link share"} · token {share.token.slice(0, 8)}…
        </div>
      </div>
      {owned && (
        <button className="btn-danger" onClick={() => revoke.mutate(share.id)}>
          Revoke
        </button>
      )}
    </div>
  );
}
