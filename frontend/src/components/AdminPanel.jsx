import { isAdminRole, isAnalystRole, normalizeRole, roleLabel } from "../utils/roles";

export default function AdminPanel({ users, onLock, onUnlock, onExport, role }) {
  const effectiveRole = normalizeRole(role);
  const isAdmin = isAdminRole(effectiveRole);
  const isAnalyst = isAnalystRole(effectiveRole);

  if (!(isAdmin || isAnalyst)) {
    return null;
  }

  return (
    <section id="admin" className="panel">
      <div className="panel-header">
        <h3>{isAdmin ? "Admin Panel" : "Security Analyst Panel"}</h3>
        <button className="ghost-btn" onClick={onExport}>Export Logs CSV</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Role</th>
              <th>Locked</th>
              <th>Failed Attempts</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.username}</td>
                <td>{user.email}</td>
                <td>{roleLabel(user.role)}</td>
                <td>{user.is_locked ? "Yes" : "No"}</td>
                <td>{user.failed_login_attempts}</td>
                <td>
                  {isAdmin ? (
                    user.is_locked ? (
                      <button className="inline-btn" onClick={() => onUnlock(user.id)}>
                        Unlock
                      </button>
                    ) : (
                      <button className="inline-btn" onClick={() => onLock(user.id)}>
                        Lock
                      </button>
                    )
                  ) : (
                    "Read-only"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
