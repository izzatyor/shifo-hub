<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep password recovery on the public `/reset-password` route and require a recovery session before updating credentials; regular signed-in sessions must not bypass current-password checks.
- Staff provisioning uses an atomic database function for profile/role writes and compensating Auth deletion on failure; Auth and application writes cannot share a database transaction.
- Staff creation derives clinic scope from matching protected role and profile rows, never from caller input or profile alone, because profiles are user-editable.
- Staff-ID sign-in resolves the canonical Auth email server-side, uses a fresh nonpersistent Auth client, and atomically reserves a durable per-user attempt before password verification; public directories expose only names, IDs, and roles, excluding super-admins.
