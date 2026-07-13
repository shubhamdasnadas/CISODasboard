"""
PhishStats tester.

Docs: https://phishstats.info/
Auth: none required -- public API.

Looks up recent phishing entries matching a sample keyword (real,
no-key call). On the dashboard this is the brand-impersonation check:
search for phishing URLs referencing your own company/product name,
not a generic third-party brand.
"""

import requests

from _common import print_header, print_result, print_error, print_footer

KEYWORD = "tesla"  # replace with your org's brand/domain to monitor for impersonation
URL = "https://api.phishstats.info/api/phishing"


def main():
    print_header("PhishStats", URL)
    try:
        resp = requests.get(
            URL, params={"_where": f"(url,like,~{KEYWORD}~)", "_size": 5}, timeout=10
        )
        print_result(resp)
    except requests.RequestException as exc:
        print_error(exc)
    print_footer()


if __name__ == "__main__":
    main()
