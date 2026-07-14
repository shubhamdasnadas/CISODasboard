"""
crt.sh tester.

Docs: https://crt.sh/ (unofficial but stable JSON output via ?output=json)
Auth: none required -- free public certificate transparency log search.

Looks up certificates issued for a sample domain (real, no-key call).
"""

import requests

from _common import print_header, print_result, print_error, print_footer

DOMAIN = "youtube.com"  # sample domain to search
URL = "https://crt.sh/"


def main():
    print_header("crt.sh", URL)
    try:
        resp = requests.get(URL, params={"q": DOMAIN, "output": "json"}, timeout=15)
        print_result(resp)
    except requests.RequestException as exc:
        print_error(exc)
    print_footer()


if __name__ == "__main__":
    main()
