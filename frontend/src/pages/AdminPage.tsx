import { useUsers, useSetApproval } from "../api/hooks";
import { PageHeader, Spinner, ErrorText, Empty } from "../components/ui";
import { formatDate } from "../lib/format";

export default function AdminPage() {
  const { data: users, isLoading } = useUsers(false);
  const setApproval = useSetApproval();

  if (isLoading) return <Spinner />;

  return (
    <div>
      <PageHeader title="Admin" subtitle="Approve or reject accounts. Unapproved users cannot access content." />
      <ErrorText error={setApproval.error} />
      {!users || users.length === 0 ? (
        <Empty>No users.</Empty>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-edge text-left text-gray-400">
              <tr>
                <th className="p-3">User</th>
                <th className="p-3">Email</th>
                <th className="p-3">Role</th>
                <th className="p-3">Status</th>
                <th className="p-3">Joined</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-edge/50">
                  <td className="p-3 text-white">{u.username}</td>
                  <td className="p-3 text-gray-400">{u.email}</td>
                  <td className="p-3">
                    <span className="badge">{u.role}</span>
                  </td>
                  <td className="p-3">
                    <span
                      className={`badge ${
                        u.approval_status === "approved"
                          ? "border-emerald-500 text-emerald-300"
                          : u.approval_status === "rejected"
                            ? "border-red-500 text-red-300"
                            : "border-amber-500 text-amber-300"
                      }`}
                    >
                      {u.approval_status}
                    </span>
                  </td>
                  <td className="p-3 text-gray-500">{formatDate(u.created_at)}</td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-2">
                      {u.approval_status !== "approved" && (
                        <button
                          className="btn-primary"
                          onClick={() =>
                            setApproval.mutate({ userId: u.id, status: "approved" })
                          }
                        >
                          Approve
                        </button>
                      )}
                      {u.approval_status !== "rejected" && (
                        <button
                          className="btn-danger"
                          onClick={() =>
                            setApproval.mutate({ userId: u.id, status: "rejected" })
                          }
                        >
                          Reject
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
