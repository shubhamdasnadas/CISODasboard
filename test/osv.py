"""
OSV (Open Source Vulnerabilities) tester.

Docs: https://google.github.io/osv.dev/get-started/
Auth: none required.

Looks up known vulnerabilities for a sample package (real, no-key call).
Sample package is 'axios', a real dependency of this project's own
backend/package.json -- this mirrors a "scan our own dependencies" widget
on the CISO Dashboard.
"""

import requests

from _common import print_header, print_result, print_error, print_footer

URL = "https://api.osv.dev/v1/query"


def main():
    print_header("OSV Vulnerability Library", URL)
    payload = {
        "package": {"name": "axios", "ecosystem": "npm"},
        "version": "1.7.2",  # matches backend/package.json's pinned range
    }
    try:
        resp = requests.post(URL, json=payload, timeout=10)
        print_result(resp)
    except requests.RequestException as exc:
        print_error(exc)
    print_footer()


if __name__ == "__main__":
    main()
