from dataclasses import dataclass


@dataclass(frozen=True)
class MitreTechnique:
    technique_id: str
    technique_name: str
    tactic: str
    explanation: str


MITRE_TECHNIQUES: dict[str, MitreTechnique] = {
    "T1078": MitreTechnique(
        technique_id="T1078",
        technique_name="Valid Accounts",
        tactic="Initial Access / Persistence",
        explanation="Adversaries may use stolen or abused valid credentials to access systems.",
    ),
    "T1021": MitreTechnique(
        technique_id="T1021",
        technique_name="Remote Services",
        tactic="Lateral Movement",
        explanation="Adversaries can move laterally by leveraging remote service access patterns.",
    ),
    "T1046": MitreTechnique(
        technique_id="T1046",
        technique_name="Network Service Discovery",
        tactic="Discovery",
        explanation="Rapid or unusual network interaction patterns can indicate service discovery.",
    ),
    "T1071": MitreTechnique(
        technique_id="T1071",
        technique_name="Application Layer Protocol",
        tactic="Command and Control",
        explanation="Unexpected protocol behavior can signal command-and-control over app protocols.",
    ),
    "T1110": MitreTechnique(
        technique_id="T1110",
        technique_name="Brute Force",
        tactic="Credential Access",
        explanation="Repeated authentication failures can indicate brute-force activity.",
    ),
    "T1566": MitreTechnique(
        technique_id="T1566",
        technique_name="Phishing",
        tactic="Initial Access",
        explanation="Social engineering signals can indicate phishing attempts in identity workflows.",
    ),
}


ANOMALY_TO_TECHNIQUES: dict[str, list[str]] = {
    "new_device": ["T1078"],
    "unfamiliar_location": ["T1021", "T1078"],
    "new_ip": ["T1046"],
    "abnormal_access_frequency": ["T1046", "T1071"],
    "protocol_anomaly": ["T1071"],
    "brute_force_pattern": ["T1110"],
    "phishing_indicator": ["T1566"],
}


def map_anomalies_to_mitre(anomalies: list[str]) -> list[dict]:
    ids: list[str] = []
    for anomaly in anomalies:
        ids.extend(ANOMALY_TO_TECHNIQUES.get(anomaly, []))

    mapped: list[dict] = []
    for technique_id in sorted(set(ids)):
        technique = MITRE_TECHNIQUES.get(technique_id)
        if technique:
            mapped.append(
                {
                    "technique_id": technique.technique_id,
                    "technique_name": technique.technique_name,
                    "tactic": technique.tactic,
                    "explanation": technique.explanation,
                }
            )
    return mapped
