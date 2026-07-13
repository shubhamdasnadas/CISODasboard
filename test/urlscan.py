"""
urlscan.io tester.

Docs: https://urlscan.io/docs/api/
Auth: header 'API-Key: <your key>' required for submitting scans;
the search endpoint works without a key (real, no-key call).
Get a key -> https://urlscan.io/user/signup

Searches existing public scans for a sample domain.
"""

import requests

from _common import print_header, print_result, print_error, print_footer

API_KEY = "019f5ac9-b97f-76dc-b50f-1b24c71a857f"  # only needed for submitting new scans
DOMAIN = "youtube.com"  # sample domain to search
URL = "https://urlscan.io/api/v1/search/"


def main():
    print_header("urlscan.io (search)", URL)
    try:
        resp = requests.get(URL, params={"q": f"domain:{DOMAIN}"}, timeout=10)
        print_result(resp)
    except requests.RequestException as exc:
        print_error(exc)
    print_footer()


if __name__ == "__main__":
    main()
