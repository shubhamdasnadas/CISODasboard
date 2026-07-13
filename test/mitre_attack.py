"""
MITRE ATT&CK tester.

Docs: https://github.com/mitre-attack/attack-stix-data
Auth: none required -- public STIX 2.1 JSON dataset on GitHub.

Downloads the Enterprise ATT&CK STIX bundle and prints info about a
sample technique (real, no-key call).
"""

import requests

from _common import print_header, print_error, print_footer

URL = (
    "https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/"
    "enterprise-attack/enterprise-attack.json"
)
SAMPLE_TECHNIQUE_ID = "T1566"  # Phishing


def main():
    print_header("MITRE ATT&CK (STIX dataset)", URL)
    try:
        resp = requests.get(URL, timeout=30)
        print(f"Status code: {resp.status_code}")
        data = resp.json()
        objects = data.get("objects", [])
        print(f"Total STIX objects in bundle: {len(objects)}")

        for obj in objects:
            if obj.get("type") != "attack-pattern":
                continue
            ext_refs = obj.get("external_references", [])
            for ref in ext_refs:
                if ref.get("external_id") == SAMPLE_TECHNIQUE_ID:
                    print(f"\nFound technique {SAMPLE_TECHNIQUE_ID}:")
                    print(f"  Name: {obj.get('name')}")
                    print(f"  Description: {obj.get('description', '')[:500]}...")
                    break
    except requests.RequestException as exc:
        print_error(exc)
    print_footer()


if __name__ == "__main__":
    main()
