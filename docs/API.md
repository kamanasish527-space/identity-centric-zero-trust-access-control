# API Reference

Base path: `/api/v1`

## Health

- `GET /health` - Liveness check

## Authentication

- `POST /auth/register` - Register user
- `POST /auth/login` - Login (may return step-up requirement)
- `POST /auth/step-up` - Complete OTP simulation for medium risk
- `POST /auth/refresh` - Refresh access/refresh tokens
- `GET /auth/me` - Current authenticated user
- `POST /auth/logout` - Logout and terminate current session

## Dashboard

- `GET /dashboard/overview` - KPI overview
- `GET /dashboard/profile` - Security profile and baseline metrics
- `GET /dashboard/logs?limit=100` - Activity logs
- `GET /dashboard/risk-analytics?hours=24` - Trend + pie + MITRE counts
- `GET /dashboard/threat-intel?limit=20` - Threat intel feed

## Risk

- `GET /risk/live` - Live risk payload for authenticated user (includes AI insight explanation + mitigation)
- Alias: `GET /api/risk/live` - Backward-compatible path outside `/api/v1`
- `POST /risk/simulate-attack` - Inject attack scenario and force high-risk telemetry
- `POST /risk/simulation/reset` - Reset simulation state/risk profile

## Sessions

- `GET /sessions/active` - Active sessions for user
- `GET /sessions/active?all_users=true` - Admin global sessions
- `POST /sessions/heartbeat` - Continuous monitoring check
- `POST /sessions/terminate/{session_id}` - Terminate a session

## Settings

- `GET /settings` - Read thresholds/toggles (`admin`, `analyst`)
- `PUT /settings` - Update thresholds/toggles (`admin`)

## Admin

- `GET /admin/users` - List users (`admin`, `analyst`)
- `POST /admin/users/{user_id}/lock` - Lock account (`admin`)
- `POST /admin/users/{user_id}/unlock` - Unlock account (`admin`)
- `GET /admin/logs/export?days=7` - Export logs CSV (`admin`, `analyst`)

## WebSocket

- `GET /ws/events` - Live audit event stream for dashboard updates

## Error Format

All API errors are structured as:

```json
{
  "error": {
    "code": "string_code",
    "message": "Readable message",
    "details": null
  }
}
```

## Security Headers / CSRF

State-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`) on protected routes require:

- Authorization Bearer access token
- `X-CSRF-Token` header matching:
  - `csrf_token` cookie
  - CSRF claim in access token

## MITRE ATT&CK Mapping Implemented

- `T1078` Valid Accounts
- `T1021` Remote Services
- `T1046` Network Service Discovery
- `T1071` Application Layer Protocol
- `T1110` Brute Force
- `T1566` Phishing
