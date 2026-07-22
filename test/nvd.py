"""
NVD (NIST National Vulnerability Database) tester.

Docs: https://nvd.nist.gov/developers/vulnerabilities
Auth: none required, but an API key raises the rate limit considerably.
Get a key (optional) -> https://nvd.nist.gov/developers/request-an-api-key

Looks up a well-known CVE by ID. Works with no key (real, no-key call).
"""

import requests

from _common import print_header, print_result, print_error, print_footer

API_KEY = "47059219-fa56-44d6-b27d-751712db1e96"  # optional; leave blank/placeholder to call unauthenticated
CVE_ID = "CVE-2021-44228"  # Log4Shell, sample lookup
URL = "https://services.nvd.nist.gov/rest/json/cves/2.0"


def main():
    print_header("NVD (NIST)", URL)
    headers = {}
    if API_KEY and API_KEY != "YOUR_NVD_API_KEY":
        headers["apiKey"] = API_KEY
    try:
        resp = requests.get(URL, params={"cveId": CVE_ID}, headers=headers, timeout=10)
        print_result(resp)
    except requests.RequestException as exc:
        print_error(exc)
    print_footer()


if __name__ == "__main__":
    main()
