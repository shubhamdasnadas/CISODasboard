# OSINT Tool Testers — Setup

Standalone Python scripts that exercise each OSINT tool's API in isolation.
Nothing here touches the dashboard code — this is just for evaluating each
tool before deciding what to integrate.

Each script is independent, imports the shared `_common.py` console-printer,
and can be run directly. Scripts that need a key have a placeholder
constant near the top (e.g. `API_KEY = "YOUR_SHODAN_API_KEY"`) — replace it
with your real key before running. A handful of tools need no key at all
and will return real data out of the box.

## 1. Install dependencies

```bash
cd test
pip3 install requests
```

(Only third-party dependency across all scripts is `requests`.)

## 2. Run a script

```bash
python3 <script_name>.py
```

Each script prints: the endpoint hit, HTTP status code, and a (truncated)
JSON response body — or a request error if the call failed (e.g. bad/missing
key, network issue).

## 3. Tools requiring no API key (run as-is)

| Script | Tool |
|---|---|
| `osv.py` | OSV Vulnerability Library |
| `crtsh.py` | crt.sh |
| `mitre_attack.py` | MITRE ATT&CK (STIX dataset on GitHub) |
| `phishstats.py` | PhishStats |
| `openphish.py` | OpenPhish (free delayed feed) |
| `nvd.py` | NVD / NIST (key optional — raises rate limit, not required) |
| `urlscan.py` | urlscan.io (search endpoint only; submitting new scans needs a key) |

## 4. Tools requiring an API key

For each, open the script, replace the placeholder constant(s) near the
top with your real credentials, then run it.

Self-serve signup (free account, key issued instantly/automatically):

| Script | Tool | Placeholder constant(s) | Get a key |
|---|---|---|---|
| `alienvault_otx.py` | AlienVault OTX | `API_KEY` | https://otx.alienvault.com/ |
| `shodan.py` | Shodan | `API_KEY` | https://account.shodan.io/ |
| `censys.py` | Censys | `API_ID`, `API_SECRET` | https://search.censys.io/account/api |
| `greynoise.py` | GreyNoise | `API_KEY` | https://viz.greynoise.io/signup |
| `pulsedive.py` | Pulsedive | `API_KEY` | https://pulsedive.com/account/ |
| `maltiverse.py` | Maltiverse | `API_TOKEN` | https://maltiverse.com/ |
| `phishtank.py` | PhishTank | `API_KEY` (app_key) | https://www.phishtank.com/register.php |
| `virustotal.py` | VirusTotal | `API_KEY` | https://www.virustotal.com/gui/join-us |
| `intelligencex.py` | IntelligenceX | `API_KEY` | https://intelx.io/ |
| `onyphe.py` | Onyphe | `API_KEY` | https://www.onyphe.io/ |
| `netlas.py` | Netlas.io | `API_KEY` | https://app.netlas.io/ (50 free requests/day) |
| `binaryedge.py` | BinaryEdge | `API_KEY` | https://app.binaryedge.io/ (free trial) |
| `opensanctions.py` | OpenSanctions | `API_KEY` | https://www.opensanctions.org/api/ |

Note: some of these also offer paid upgrade tiers on top of the free
self-serve signup. Verify current status on each provider's site.

## 5. Notes

- All sample lookups (IPs, domains, CVE IDs, package names, etc.) are
  hardcoded to well-known, safe values (e.g. `8.8.8.8`, `example.com`,
  `CVE-2021-44228`) so you can run a script immediately after adding a key,
  with no other setup.
- `_common.py` is a shared helper (not a standalone tool) — it formats and
  prints the HTTP status/response for every script. Don't run it directly.
- A 401/403 response with a placeholder key still means the script and
  request shape are correct — it just confirms the key wasn't supplied.
- These scripts are for one-off manual evaluation only — no retry logic,
  caching, or error recovery, since they're not meant to run unattended.

## 6. All tools (script index)

- `alienvault_otx.py` — AlienVault OTX
<!-- - `shodan.py` — Shodan PAID --> 
- `censys.py` — Censys
- `greynoise.py` — GreyNoise
- `pulsedive.py` — Pulsedive
- `openphish.py` — OpenPhish feed
- `nvd.py` — NVD (NIST)
- `osv.py` — OSV Vulnerability Library
- `opensanctions.py` — OpenSanctions
- `maltiverse.py` — Maltiverse
- `mitre_attack.py` — MITRE ATT&CK
- `phishtank.py` — PhishTank
- `phishstats.py` — PhishStats
- `virustotal.py` — VirusTotal
- `intelligencex.py` — IntelligenceX
- `onyphe.py` — Onyphe
- `netlas.py` — Netlas.io
- `urlscan.py` — urlscan.io
- `binaryedge.py` — BinaryEdge
- `crtsh.py` — crt.sh
