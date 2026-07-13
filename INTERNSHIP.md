# OSINT Tools — Score ≥ 6

Compiled from relevance scoring across all reviewed categories (Advisories/Threat Feeds, Malicious File Analysis, AI Tools, OSINT Automation, Encoding/Decoding, Classifieds, Blockchain, Disinformation, Dark Web, Mobile OSINT, Language Translation, Archives, Compliance & Risk, IP & MAC Address, Cloud Infrastructure, Domains).

| Tool | Score | Why |
|---|---|---|
| AlienVault OTX | 8 | Free, well-documented DirectConnect API — IOC/domain/IP in, community "pulses" out. Closest match to the `news.js` cache-and-poll shape of any tool reviewed. |
| Shodan | 8 | Excellent documented API, IP/port/service in, banners/open ports/vulnerabilities out. The clearest "is our infrastructure exposed" source across every file. |
| Censys | 8 | Industry-standard API, same tier as Shodan — host/cert/service search. |
| Grey Noise | 7 | Well-documented API distinguishing targeted attacks from internet background noise (benign scanners) hitting your IPs. |
| Google Safe Browsing API | 7 | Free, official Google API — URL/domain in, safe/unsafe classification out. Extremely reliable, zero cost. |
| Pulsedive | 7 | Free public API — IOC/IP/URL/domain in, enrichment + risk score out. |
| OpenPhish feed | 7 | Real-time confirmed-phishing-URL feed; free (delayed) tier plus commercial real-time API. |
| IBM X-Force Exchange | 7 | Public REST API with a free tier — IOC/domain/malware sample in, threat analysis out. |
| NVD (NIST) | 7 | Real public REST API (NVD API 2.0), JSON in/out, CVE ID/keyword in, CVSS/affected products out. |
| OSV Vulnerability Library | 7 | Public JSON API at api.osv.dev — package/ecosystem in, vuln list out. No key required. |
| Vulert | 7 | Purpose-built for dependency-manifest vulnerability matching via a documented API. |
| OpenSanctions | 6 | Public API aggregating 329 sources — entity name in, sanctions/PEP status out. |
| MISP | 6 | Full REST API for IOC sharing/correlation — self-hosted infrastructure rather than a call to a third-party endpoint. |
| Maltiverse | 6 | Public API (free tier w/ registration) — IOC in, threat score/context out. |
| Mitre ATT&CK | 6 | Public STIX/TAXII feed + downloadable JSON dataset — technique ID in, adversary TTP description/mitigations out. |
| PhishTank | 6 | Documented public API (free key) — submit/check a URL, get verified phishing status back. |
| PhishStats | 6 | Public API (phishstats.info/api) — domain/IP/keyword in, campaign/threat profile out. |
| VirusTotal | 6 | Well-documented public REST API (VT API v3) — hash/file/URL/domain/IP in, multi-engine verdict + reputation out. Enrichment tool, not a primary findings source. |
| IntelligenceX | 6 | Documented public API — email/domain/IP/hash in, matching pastes/leaks/darknet/stealer-log intel out. |
| Onyphe | 6 | Real documented API — IP/domain/CVE in, services/vulnerabilities/certificates out. |
| Netlas.io | 6 | Real API, 50 free requests/day — IP/domain/ASN in, ports/services/certs/DNS/WHOIS out. |
| urlscan.io | 6 | Excellent free/paid API — URL/domain in, screenshot/DNS/IP/certificates/cookies out. |
| BinaryEdge | 6 | Commercial internet-wide scanning API, same class as Shodan/Censys. |
| Spyse | 6 | IP/domain/email/org in, subdomains/services/vulnerabilities/breaches out — verify current operational status before relying on it (service has changed ownership/branding). |
| Shadowserver Foundation | 6 | Nonprofit that proactively sends free daily reports to registered organizations about their own exposed/compromised assets — purpose-built for this use case. |
| crt.sh | 6 | The de facto standard free CT-log search tool, used constantly in real subdomain-enumeration pipelines. |
