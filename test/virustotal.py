"""
VirusTotal tester.

Docs: https://docs.virustotal.com/reference/overview
Auth: header 'x-apikey: <your key>'
Get a key -> https://www.virustotal.com/gui/join-us

Looks up multi-engine verdict info for a sample domain.
"""

import requests

from _common import print_header, print_result, print_error, print_footer

API_KEY = "45a143713480b19174562ec1d38dc34496097ab05e885fafb9a8539d9bf0028b"
DOMAIN = "youtube.com"  # sample domain to look up
URL = f"https://www.virustotal.com/api/v3/domains/{DOMAIN}"


def main():
    print_header("VirusTotal", URL)
    headers = {"x-apikey": API_KEY}
    try:
        resp = requests.get(URL, headers=headers, timeout=10)
        print_result(resp)
    except requests.RequestException as exc:
        print_error(exc)
    print_footer()


if __name__ == "__main__":
    main()
