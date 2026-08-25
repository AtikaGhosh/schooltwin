# Restricted restore gate

A restored database or object mirror must not receive application traffic immediately.

1. Restore into a new network-isolated project in Mumbai.
2. Keep Auth email, public app origins, and Edge Function access disabled.
3. Record current server time and the backup recovery point.
4. Set the `RESTORE_*` variables from `.env.example`, prepare a revocation JSON
   file with `userIds`, `deviceIds`, and `batchIds`, then run
   `pnpm backend:restore-gate`. The command refuses to run unless
   `RESTORE_NETWORK_ISOLATED=true`.
5. Delete expired Class Check answers, Student Private Check answers, private report content, pass failures, server events, evidence rows, primary objects, and mirrored objects.
6. Reapply every user, device, lease, pass batch, pass, and work-lease revocation recorded after the recovery point.
7. Delete unfinished capture intents older than 24 hours.
8. Run all role/table/view/function/Storage access tests and Supabase Security Advisor.
9. Confirm private reports have no participant link or exact application timestamp.
10. Confirm expired evidence cannot be played and signed links last only 60 seconds.
11. Save the command's HMAC-signed restoration report. It contains counts,
    checks, and timestamps—never protected content. Two authorized reviewers
    add their approval in the controlled release record.
12. Enable network traffic only after two authorized reviewers approve the report.

Test database and object restoration quarterly and before the first live pilot. Keep provider database backups for at most 14 days. Mirrored objects keep the primary object’s `delete_after` date and never gain a new retention period after restore.
