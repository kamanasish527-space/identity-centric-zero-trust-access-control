# CyberWatch Analytics

## AI-Based Identity-Centric Zero Trust Access Control Platform

**Continuous identity verification • Behavioral risk analysis • Adaptive access control • SOC visibility**

A full-stack cybersecurity proof-of-concept demonstrating how identity, context, behavior, risk, and policy can be combined into a continuous Zero Trust access-control workflow.

---

## 📌 Project Overview

**CyberWatch Analytics** is an AI-oriented, identity-centric Zero Trust security platform developed as an 8th-semester Computer Science and Engineering project.

The platform moves beyond traditional one-time authentication by evaluating contextual security signals during authentication and throughout an active session. A composite risk score is used by an adaptive policy engine to determine whether access should be:

- **Allow**
- **Step-Up Authentication**
- **Deny**
- **Lock**

The platform also provides SOC-style dashboards for security monitoring, behavioral analysis, risk analytics, network/threat visualization, system health, audit investigation, and controlled attack simulation.

> **Core principle:**  
> **Never trust permanently. Continuously evaluate.**

---

## 🎯 Problem Statement

Traditional access-control systems often treat successful authentication as sufficient proof of trust.

That model becomes weak when an attacker obtains valid credentials or hijacks an authenticated session. A legitimate username and password alone cannot establish that the current request is safe.

CyberWatch Analytics addresses this problem by evaluating additional context such as:

- User identity
- Device fingerprint
- Source IP
- Geographic location
- Login timing
- Authentication history
- Access frequency
- Failed authentication attempts
- Phishing simulation signals
- Behavioral deviation

The resulting risk assessment is fed into an adaptive policy engine and continuously re-evaluated during active sessions.

---

# 🏗️ System Architecture

CyberWatch Analytics follows a **three-tier application architecture** with security and analytics services inside the backend.

## High-Level Architecture

```text
                         ┌──────────────────────────────┐
                         │            USER              │
                         │  Admin / Analyst / User      │
                         └──────────────┬───────────────┘
                                        │
                                        │ HTTPS
                                        ▼
                 ┌─────────────────────────────────────────┐
                 │           REACT + VITE FRONTEND         │
                 │                                         │
                 │  • Login / Zero Trust Checkpoint        │
                 │  • SOC Dashboard                        │
                 │  • Risk Analytics                       │
                 │  • Behavioral Analysis                  │
                 │  • Network & Relations                  │
                 │  • Actionable Intelligence              │
                 │  • Simulation Lab                       │
                 └────────────────┬────────────────────────┘
                                  │
                         REST API │ WebSocket
                                  ▼
        ┌─────────────────────────────────────────────────────────┐
        │                    FASTAPI BACKEND                      │
        │                                                         │
        │  ┌───────────────── SECURITY ────────────────────────┐  │
        │  │ Authentication → JWT → RBAC → CSRF → Rate Limit   │  │
        │  │ Argon2id password hashing                         │  │
        │  └──────────────────────────────────────────────────┘   │
        │                         │                               │
        │                         ▼                               │
        │  ┌──────────────────── ANALYTICS ────────────────────┐  │
        │  │ Behavioral Baseline                               │  │
        │  │       ↓                                           │  │
        │  │ Risk Engine                                       │  │
        │  │       ↓                                           │  │
        │  │ Anomaly Engine                                    │  │
        │  │       ↓                                           │  │
        │  │ Policy Engine                                     │  │
        │  └──────────────────────────────────────────────────┘   │
        │                         │                               │
        │              ┌──────────┼───────────┐                   │
        │              ▼          ▼           ▼                   │
        │         MITRE ATT&CK  Session    Simulation             │
        │           Mapping     Monitor       Engine              │
        │              │          │           │                   │
        │              └──────────┼───────────┘                   │
        │                         ▼                               │
        │                  Audit / Event Logs                     │
        └────────────────────────┬────────────────────────────────┘
                                 │
                              SQLAlchemy
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │       SQLite 3.x         │
                    │                          │
                    │ • User                   │
                    │ • AccessSession          │
                    │ • AuditLog               │
                    │ • BehaviorBaseline       │
                    │ • BehaviorAnomalyEvent   │
                    └──────────────────────────┘
```

### Architecture Layers

| Layer | Responsibility | Main Technologies |
|---|---|---|
| Presentation | SOC dashboard, authentication UI, charts and interaction | React 18, Vite, Tailwind CSS |
| Communication | API requests and live event delivery | Axios, REST, WebSocket |
| Application | Authentication, risk calculation, anomaly detection, policy decisions | Python, FastAPI |
| Security | Identity, session protection, authorization and abuse prevention | JWT, Argon2id, CSRF, RBAC, SlowAPI |
| Analytics | Baseline learning, risk scoring and anomaly evaluation | Python service layer |
| Threat Intelligence | Security-event classification | MITRE ATT&CK mapping |
| Simulation | Controlled multi-stage attack injection | In-memory simulation engine |
| Persistence | Identity, sessions, behavioral data and audit records | SQLAlchemy, SQLite |

---

# 🔄 Zero Trust Data Flow

Every authentication request follows a deterministic security pipeline.

```text
┌──────────────────┐
│ 1. User Login    │
│ Credentials +    │
│ Context Signals  │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────┐
│ 2. Authentication        │
│ Argon2id credential      │
│ verification             │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│ 3. Context Collection    │
│ IP • Location • Device   │
│ Time • Login history     │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│ 4. Behavioral Baseline   │
│ Compare current request  │
│ with learned profile     │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│ 5. Risk + Anomaly Engine │
│ Composite risk score     │
│ + anomaly evaluation     │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│ 6. Adaptive Policy       │
│ Allow / Step-Up /        │
│ Deny / Lock              │
└────────┬─────────────────┘
         │
         ├───────────────► Audit Log
         │
         ├───────────────► MITRE ATT&CK Mapping
         │
         ▼
┌──────────────────────────┐
│ 7. Session Created       │
│ or Access Restricted     │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│ 8. Continuous Monitoring │
│ Session heartbeat        │
│ → re-evaluate risk       │
└────────┬─────────────────┘
         │
         └──────────────┐
                        │
                        ▼
                 Re-enter Risk
                 Evaluation
```

The important Zero Trust property is the final loop: **an authenticated session is not treated as permanently trusted**.

---

# 🔐 Security Decision Model

CyberWatch Analytics uses a four-tier adaptive policy model.

```text
                     ┌───────────────────┐
                     │   Access Request  │
                     └─────────┬─────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │ Context + Behavior   │
                    │ Risk Evaluation      │
                    └──────────┬───────────┘
                               │
                               ▼
                       Composite Risk
                               │
              ┌────────────────┼─────────────────┐
              │                │                 │
              ▼                ▼                 ▼
          LOW/NORMAL         MEDIUM            HIGH
              │                │                 │
              ▼                ▼                 ▼
           ALLOW          STEP-UP             DENY
              │                │                 │
              └────────┬───────┴─────────────────┘
                       │
                       ▼
                Continuous Monitor
                       │
                       ▼
                 Critical Risk?
                       │
                    YES│
                       ▼
                    LOCK
```

The implementation also supports intermediate risk classifications such as:

**Low → Normal → Medium → Suspicious → High → Critical**

The final access decision is determined by the policy engine using the calculated risk state and security context.

---

# 🧠 Behavioral Baseline

The platform maintains a per-user behavioral profile and compares new activity against previously observed behavior.

The baseline includes:

- Average login hour
- Known geographic locations
- Known device fingerprints
- Historical source IP addresses
- Average daily access frequency

Continuous numerical attributes are updated using **Exponential Moving Average (EMA)** logic, while discrete attributes such as known locations and device fingerprints are maintained as bounded historical sets.

```text
                    User Activity
                         │
                         ▼
              ┌──────────────────────┐
              │ Extract Context      │
              │ Time / IP / Location │
              │ Device / Frequency   │
              └──────────┬───────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │ User Baseline        │
              │ Known / Expected     │
              └──────────┬───────────┘
                         │
                         ▼
                 Compare Deviation
                         │
              ┌──────────┴───────────┐
              ▼                      ▼
         Normal Context        Anomalous Context
              │                      │
              ▼                      ▼
        Lower Risk             Higher Risk
```

---

# 📊 Risk & Anomaly Engine

The platform combines contextual risk factors and behavioral anomaly signals into a composite security assessment.

### Primary contextual signals

- Failed authentication attempts
- New device fingerprint
- New geographic location
- New source IP
- Login-time deviation
- Access-frequency deviation
- Phishing signal
- Privilege-related behavior
- Other contextual policy signals

### Anomaly evaluation

The anomaly layer evaluates behavioral deviations and can promote the resulting security classification when anomalous behavior is sufficiently severe.

### Example

```text
Known User
   │
   ├── Known Device
   ├── Known IP
   ├── Normal Login Time
   └── Normal Frequency
             │
             ▼
        Low Risk
             │
             ▼
           ALLOW


Unknown Device
   │
   ├── New Location
   └── Unusual Login Time
             │
             ▼
       Elevated Risk
             │
             ▼
        STEP-UP


Unknown Device
   │
   ├── New IP
   ├── New Location
   ├── Failed Logins
   └── Phishing Signal
             │
             ▼
       Critical Risk
             │
             ▼
        DENY / LOCK
```

> **Implementation note:** The final academic report describes the anomaly/risk logic as a weighted, rule-based proof-of-concept rather than a trained machine-learning model. The UI contains AI-oriented analytics terminology, but the documented implementation should not be interpreted as a production-trained ML detector.

---

# 🛡️ Security Architecture

Security controls are applied at multiple layers.

```text
┌──────────────────────────────────────────────────────────┐
│                    APPLICATION SECURITY                  │
├──────────────────────────────────────────────────────────┤
│  HTTPS / TLS                                              │
│        ↓                                                  │
│  HSTS + Content Security Policy                           │
│        ↓                                                  │
│  Rate Limiting                                            │
│        ↓                                                  │
│  JWT Authentication                                       │
│        ↓                                                  │
│  Argon2id Password Hashing                                │
│        ↓                                                  │
│  CSRF Protection                                          │
│        ↓                                                  │
│  RBAC Enforcement                                         │
│        ↓                                                  │
│  Risk-Based Authorization                                 │
│        ↓                                                  │
│  Continuous Session Evaluation                            │
│        ↓                                                  │
│  Immutable Audit Logging                                  │
└──────────────────────────────────────────────────────────┘
```

### Authentication

- JWT-based authentication
- Short-lived access tokens
- Refresh-token workflow
- Argon2id password hashing
- Failed-login lockout
- Token expiry validation

### Session Protection

- HttpOnly refresh-token cookies
- Secure / SameSite cookie attributes
- CSRF validation on state-changing operations
- Continuous session risk evaluation
- Session termination for high-risk activity

### Authorization

Three documented roles are supported:

| Role | Purpose |
|---|---|
| **Admin** | Platform administration and privileged security operations |
| **Analyst** | SOC monitoring, investigation and response |
| **User** | Standard authenticated access |

RBAC is enforced at the FastAPI API boundary.

---

# 🧩 Core Backend Services

The backend uses a layered service-oriented design.

```text
backend/app/
│
├── main.py
│
├── api/
│   ├── deps.py
│   └── v1/
│       └── endpoints/
│
├── core/
│   └── security.py
│
├── models/
│   ├── user.py
│   ├── session.py
│   ├── audit_log.py
│   ├── baseline.py
│   └── behavior_anomaly.py
│
├── schemas/
│
└── services/
    ├── risk_engine.py
    ├── anomaly_engine.py
    ├── policy_engine.py
    ├── baseline_service.py
    ├── mitre_service.py
    ├── simulation_engine.py
    └── audit_service.py
```

### Service responsibilities

| Service | Responsibility |
|---|---|
| `risk_engine.py` | Composite contextual risk calculation |
| `anomaly_engine.py` | Behavioral anomaly scoring |
| `policy_engine.py` | Maps risk/security state to access decision |
| `baseline_service.py` | Learns and updates user behavioral profiles |
| `mitre_service.py` | Associates security indicators with ATT&CK techniques |
| `simulation_engine.py` | Generates controlled multi-stage attack scenarios |
| `audit_service.py` | Creates structured security-event records |

---

# 🗄️ Database Architecture

SQLite is used as the relational persistence layer through SQLAlchemy ORM.

```text
                    ┌──────────────┐
                    │     USER     │
                    │ Identity     │
                    │ RBAC         │
                    │ Credentials  │
                    └──────┬───────┘
                           │
                           │ 1:N
                           ▼
                  ┌──────────────────┐
                  │  ACCESS SESSION  │
                  │ Device           │
                  │ IP               │
                  │ Location         │
                  │ Risk State       │
                  └────────┬─────────┘
                           │
                           │ 1:N
                           ▼
              ┌─────────────────────────┐
              │ BEHAVIOR ANOMALY EVENT  │
              │ Anomaly Score           │
              │ Risk Score              │
              │ Factors / Metrics       │
              └─────────────────────────┘

USER ────────────────► BEHAVIOR BASELINE
  │
  │                  Known Locations
  │                  Known Devices
  │                  IP History
  │                  Login-Time EMA
  │                  Access-Frequency EMA
  │
  └──────────────────► AUDIT LOG
                       Immutable Security Events
                       Risk + Decision
                       MITRE Technique
```

### Core entities

| Entity | Purpose |
|---|---|
| `User` | Identity, credentials, role and account state |
| `AccessSession` | Active-session context and current risk state |
| `AuditLog` | Immutable security-event history |
| `BehaviorBaseline` | Learned per-user behavioral profile |
| `BehaviorAnomalyEvent` | Detailed anomaly/risk evaluation history |

Audit records are designed as append-only forensic records.

---

# 🧭 MITRE ATT&CK Integration

Security indicators are mapped to MITRE ATT&CK techniques so that SOC analysts can interpret events using a standardized adversary-behavior vocabulary.

| Security Indicator | ATT&CK Technique |
|---|---|
| Phishing signal | **T1566 — Phishing** |
| Brute-force authentication | **T1110 — Brute Force** |
| New location / credential access | **T1078 — Valid Accounts** |
| New device / alternate authentication material | **T1550 — Use Alternate Authentication Material** |
| Privilege escalation behavior | **T1068 — Exploitation for Privilege Escalation** |

These mappings are surfaced in the threat-intelligence and security-event views.

---

# 🧪 Forensic Simulation Laboratory

The Simulation Lab is one of the distinctive parts of the platform.

It provides a controlled environment for injecting synthetic multi-stage attacks and observing how the authentication, risk, anomaly, policy and audit pipeline responds.

```text
              ┌───────────────────────┐
              │   START SIMULATION    │
              └───────────┬───────────┘
                          │
                          ▼
             ┌────────────────────────┐
             │ Stage 1                 │
             │ Suspicious Login       │
             │ T1566 / T1078          │
             └───────────┬────────────┘
                         │
                         ▼
             ┌────────────────────────┐
             │ Stage 2                 │
             │ Brute Force             │
             │ T1110                   │
             └───────────┬────────────┘
                         │
                         ▼
             ┌────────────────────────┐
             │ Stage 3                 │
             │ Privilege Escalation    │
             │ T1068                   │
             └───────────┬────────────┘
                         │
                         ▼
              ┌───────────────────────┐
              │ Risk + Policy Engine  │
              └───────────┬───────────┘
                          │
                ┌─────────┴─────────┐
                ▼                   ▼
           Mitigate / Block       Escalate
                │                   │
                └─────────┬─────────┘
                          ▼
                  Audit + Dashboard
```

### Simulated stages

**Stage 1 — Suspicious Login**

- Anomalous external IP
- New device fingerprint
- Off-hours login
- Increased contextual risk

**Stage 2 — Brute Force**

- Rapid authentication failures
- Failed-attempt accumulation
- Risk escalation
- Adaptive policy enforcement

**Stage 3 — Privilege Escalation**

- High-frequency privileged activity
- Behavioral deviation
- Further risk escalation
- Critical policy response

The simulation uses synthetic telemetry and is intended for controlled security testing, demonstration and SOC training.

---

# 📺 SOC Dashboard Modules

The frontend provides six primary analysis modules plus the Simulation Lab.

## 1. Executive Overview

Provides a consolidated security posture view:

- Risk Score
- Trust Score
- System Health
- Active Sessions
- High-Risk Attempts
- Blocked Threats
- Events Today
- Recent Alerts

## 2. Data Details

Forensic activity-log investigation interface with:

- Search
- Risk filtering
- Time-range filtering
- Pagination
- MITRE technique information
- CSV export

## 3. Predictive & Risk Analytics

Provides:

- Current risk score
- Minimum / average / maximum risk
- Decision distribution
- Risk-factor breakdown
- Seven-day risk trend
- Security insights

## 4. Behavioral Analysis

Provides session-level visibility:

- Active sessions
- High-risk sessions
- Session UUID
- Geographic origin
- Device fingerprint
- Source IP
- Session duration
- Current risk level
- Session termination

## 5. Network & Relations

Provides:

- Global infrastructure visualization
- Geographic relationship view
- Risk-oriented network nodes
- MITRE ATT&CK view
- Threat-intelligence feed

## 6. Actionable Intelligence

Provides platform health and operational monitoring:

- API latency
- CPU utilization
- Memory utilization
- System uptime
- Service health
- Alert configuration
- Metric thresholds
- Retention settings
- Performance controls
- Maintenance controls

## 7. Simulation Lab

Provides:

- Attack simulation controls
- Simulation progress
- Live timeline
- Injected attacks
- Risk assessment
- Detection metrics
- Mitigation results
- Exportable results

---

# 🖥️ Interface

The platform includes a dedicated Zero Trust login checkpoint where contextual information can be supplied before authentication.

The dashboard is designed around a dark SOC-style interface with:

- Risk gauges
- Trend charts
- Alert cards
- Security-status indicators
- Session cards
- Threat feeds
- Network visualization
- Simulation controls

### Suggested repository screenshot structure

If screenshots are added to the repository, use:

```text
docs/
└── screenshots/
    ├── login.png
    ├── executive-overview.png
    ├── data-details.png
    ├── predictive-risk.png
    ├── behavioral-analysis.png
    ├── network-relations.png
    ├── actionable-intelligence.png
    └── simulation-lab.png
```

Then they can be embedded in this README with standard GitHub Markdown.

---

# 🛠️ Technology Stack

## Frontend

| Technology | Purpose |
|---|---|
| React 18 | Component-based SPA |
| Vite | Development/build tooling |
| Tailwind CSS | Responsive UI styling |
| Recharts | Security metrics and charts |
| Framer Motion | Page transitions |
| Axios | REST API communication |
| React Context + Hooks | Application state |
| Radix UI | Accessible UI primitives |

## Backend

| Technology | Purpose |
|---|---|
| Python 3.11 | Backend runtime |
| FastAPI | REST API and WebSocket backend |
| Pydantic v2 | Request/response validation |
| SQLAlchemy 2.0 | ORM |
| SQLite 3.x | Relational persistence |
| JWT | Authentication tokens |
| Argon2id | Password hashing |
| SlowAPI | Rate limiting |
| WebSocket | Real-time event delivery |

## Security / Intelligence

- Zero Trust Architecture
- Identity-centric access control
- Behavioral baselines
- Weighted risk scoring
- Anomaly scoring
- Adaptive policy enforcement
- RBAC
- CSRF protection
- HSTS
- Content Security Policy
- MITRE ATT&CK mapping
- Controlled attack simulation
- Immutable audit logging

---

# 🔌 API Architecture

The platform exposes REST endpoints organized around authentication, dashboard analytics, sessions and simulation.

The documented implementation contains **27 RESTful API endpoints**.

### Authentication examples

```text
POST /auth/register
POST /auth/login
POST /auth/step-up
POST /auth/refresh
POST /auth/logout
GET  /auth/me
```

### Dashboard examples

```text
GET /dashboard/overview
GET /dashboard/logs
GET /dashboard/risk-analytics
GET /dashboard/threat-intel
GET /dashboard/system-health
```

The backend also provides a WebSocket channel for real-time dashboard event delivery.

For interactive API exploration, FastAPI provides generated OpenAPI documentation when the backend is running.

---

# 📈 Validation & Results

The final project validation included authentication testing, risk-engine testing, security validation and performance testing.

## Functional Validation

The documented test suite covered:

- Valid authentication
- Invalid password handling
- Account lockout
- Expired JWT handling
- CSRF validation
- New-location step-up authentication
- High-risk administrative access
- Phishing-signal risk increase
- Known-user risk evaluation
- New-device detection
- New-location detection
- New-IP detection
- Critical-risk escalation
- Risk-score clamping
- Anomaly-based risk promotion

**Result: 15/15 defined test cases passed.**

## Performance Results

| Metric | Result |
|---|---:|
| Average API latency | **28 ms** |
| Peak latency | **67 ms** |
| Concurrent-session test | **50 sessions** |
| CPU utilization under peak load | **35%** |
| Memory utilization | **38%** |
| System uptime during validation | **99.9%** |

## Security Validation

The documented security validation covered:

| Test | Result |
|---|---|
| SQL Injection | 0/100 successful injection attempts |
| XSS | CSP blocked tested script-injection attempts |
| CSRF | Invalid state-changing requests rejected with HTTP 403 |
| JWT manipulation | Modified tokens rejected |
| Brute-force protection | Rate limiting and lockout triggered correctly |

> These figures are results from the project's controlled academic validation environment and should not be interpreted as a guarantee of security in an unrestricted production environment.

---

# 📊 Demonstration Metrics

The Simulation Lab validation reported:

- **98% detection rate**
- **2.1 seconds average detection time**
- **0 successful breaches**
- **94% automated response effectiveness**
- **No data exfiltration in the simulated scenario**
- **A+ simulated security-posture result**

These results describe the project's controlled simulation environment.

---

# ⚙️ Installation

## Prerequisites

Install:

- Python 3.11+
- Node.js / npm
- Git

Optional:

- Docker
- Docker Compose

---

## 1. Clone the repository

```bash
git clone https://github.com/<YOUR-USERNAME>/<YOUR-REPOSITORY>.git
cd <YOUR-REPOSITORY>
```

---

## 2. Backend Setup

```bash
cd backend

python -m venv .venv
```

### Windows

```bash
.venv\Scripts\activate
```

### Linux / macOS

```bash
source .venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Start the backend:

```bash
uvicorn app.main:app --reload
```

The API will normally be available at:

```text
http://127.0.0.1:8000
```

FastAPI's interactive documentation is available at:

```text
http://127.0.0.1:8000/docs
```

---

## 3. Frontend Setup

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Vite will display the local development URL in the terminal.

---

# 🐳 Docker

If Docker configuration is included in the repository, the application can be started using the project's Compose configuration:

```bash
docker compose up --build
```

For production deployment, replace development configuration and secrets with environment-specific secure values.

---

# 🔑 Environment Configuration

Do not commit secrets to GitHub.

Typical configuration categories include:

```text
SECRET_KEY
JWT configuration
DATABASE URL
CORS origins
environment mode
security configuration
```

Use a local `.env` file where appropriate and keep it excluded through `.gitignore`.

Example:

```text
.env
.venv/
__pycache__/
node_modules/
*.db
*.sqlite
```

---

# 📁 Recommended Repository Structure

```text
CyberWatch-Analytics/
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── context/
│   │   ├── hooks/
│   │   ├── pages/
│   │   ├── store/
│   │   └── utils/
│   ├── package.json
│   └── vite.config.*
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   └── main.py
│   ├── requirements.txt
│   └── ...
│
├── docs/
│   ├── screenshots/
│   ├── API.md
│   └── architecture/
│
├── tests/
│
├── docker-compose.yml
├── README.md
└── .gitignore
```

> Adjust the structure above if your actual repository uses different filenames. The architecture described here follows the final project documentation rather than inventing additional modules.

---

# 🧪 Testing Strategy

The project follows three complementary testing levels.

### Unit Testing

Individual service functions are tested independently using mocked database fixtures.

### Integration Testing

FastAPI components and API boundaries are tested using the framework's test client.

### End-to-End Testing

Complete workflows are validated from frontend request through backend processing and database persistence.

### Security Testing

Security validation focuses on:

- SQL injection resistance
- XSS prevention
- CSRF protection
- JWT manipulation resistance
- Brute-force protection
- Session security

---

# 📚 Design Principles

CyberWatch Analytics is based on the following security principles:

### 1. Never Trust by Location

A request is not considered safe simply because it originates from an internal network.

### 2. Verify Explicitly

Identity and context are evaluated before access is granted.

### 3. Use Least Privilege

RBAC restricts operations according to the user's assigned role.

### 4. Assume Breach

The architecture treats authenticated sessions as potentially compromised and continuously evaluates their risk.

### 5. Make Risk Dynamic

Access decisions can change when the security context changes.

### 6. Maintain Forensic Visibility

Security-relevant activity is recorded for investigation and audit.

---

# 🌐 Real-World Mapping

The project demonstrates concepts that map naturally to enterprise security architectures.

```text
CyberWatch Component              Enterprise Equivalent
────────────────────────────────────────────────────────────
JWT Authentication        →       Identity / Access Layer
Behavior Baseline         →       UEBA / Behavioral Analytics
Risk Engine               →       Risk-Based Access Control
Policy Engine             →       Conditional Access
Session Monitoring        →       Continuous Verification
Audit Log                 →       SIEM Event Stream
MITRE Mapping             →       Threat Intelligence Context
Simulation Lab            →       Purple-Team / SOC Training
SOC Dashboard             →       Security Operations Console
```

The project intentionally keeps these components understandable and independently extensible.

---

# 🚧 Current Limitations

CyberWatch Analytics is a **functional academic proof-of-concept**, not a finished enterprise security product.

Current limitations include:

1. **Synthetic telemetry**  
   The validation environment uses generated/simulated security signals rather than live enterprise network telemetry.

2. **Rule-based anomaly/risk logic**  
   The documented implementation uses weighted/rule-based scoring rather than a trained machine-learning model.

3. **Single-node simulation state**  
   Simulation state is maintained in memory and is therefore not designed for distributed multi-node execution.

4. **SQLite persistence**  
   SQLite is appropriate for the prototype but would normally be replaced with a production-grade distributed database architecture for larger deployments.

5. **Limited enterprise integrations**  
   Native integrations with production SIEM, EDR, enterprise IAM and SOAR platforms are future work.

6. **Simplified MFA**  
   Step-up authentication is demonstrated within the project workflow rather than representing a complete enterprise MFA ecosystem.

These limitations are intentional and are important when interpreting the project results.

---

# 🚀 Future Scope

The architecture is designed to be extended toward a production-oriented Zero Trust platform.

### Machine Learning

- Isolation Forest
- LSTM-based behavioral models
- UEBA pipelines
- Online anomaly detection
- Model explainability

### Enterprise SIEM

Potential integrations:

- Splunk
- Microsoft Sentinel
- Elastic Stack

### Identity Providers

Potential integrations:

- Microsoft Entra ID
- Okta
- Google Workspace
- OAuth 2.0 / OpenID Connect

### Threat Intelligence

Potential integrations:

- MISP
- AlienVault OTX
- Commercial threat-intelligence feeds

### Distributed Architecture

Potential evolution:

```text
SQLite
   ↓
PostgreSQL

In-memory events
   ↓
Redis / Kafka

Single server
   ↓
Docker
   ↓
Kubernetes

Local audit pipeline
   ↓
SIEM + SOAR
```

### Additional Enterprise Capabilities

- WebAuthn / FIDO2
- Real MFA providers
- EDR telemetry
- Real-time network telemetry
- Multi-tenancy
- Automated SOAR playbooks
- Production observability
- Horizontal scaling
- Policy-as-code

---

# 📖 Academic Context

**Project Title:**  
AI-Based Identity-Centric Zero Trust Access Control Platform

**Platform:**  
CyberWatch Analytics

**Project ID:**  
1016691

**Academic Context:**  
8th Semester Bachelor of Engineering — Computer Science and Engineering

**Academic Year:**  
2025–26

The project was developed to demonstrate practical implementation of Zero Trust principles, identity-centric security, behavioral analytics, adaptive access control, threat mapping and SOC-oriented security operations.

---

# 📄 Documentation

Recommended repository documentation:

| File / Resource | Purpose |
|---|---|
| `README.md` | Project overview, architecture and setup |
| `docs/API.md` | API endpoint documentation |
| `docs/screenshots/` | Dashboard and interface screenshots |
| Final academic report | Detailed methodology, implementation, testing and results |

---

# ⚠️ Responsible Use

CyberWatch Analytics is intended for:

- Academic research
- Cybersecurity education
- Zero Trust experimentation
- SOC analyst training
- Defensive security engineering
- Controlled attack simulation
- Authorized security testing

The Simulation Lab must only be used against systems and environments that you own or are explicitly authorized to test.

---

# 👨‍💻 Author

**Kamanasish Dutta**

Computer Science & Engineering

Gujarat Technological University

### Project

**CyberWatch Analytics**  
**AI-Based Identity-Centric Zero Trust Access Control Platform**

**Project ID:** 1016691  
**Academic Year:** 2025–26

---

# ⭐ Why This Project Matters

Most authentication systems answer:

> **“Did this user authenticate successfully?”**

CyberWatch Analytics is designed around a more security-relevant question:

> **“Should this request continue to be trusted right now?”**

That distinction represents the core idea of identity-centric Zero Trust:

**Identity → Context → Behavior → Risk → Policy → Continuous Verification**

---

## 🔐 CyberWatch Analytics

**Verify explicitly. Evaluate continuously. Enforce adaptively.**

