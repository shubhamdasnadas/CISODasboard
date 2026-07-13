"""
Censys tester.

Docs: https://search.censys.io/api
Auth: HTTP Basic auth using API ID + API Secret
Get credentials -> https://search.censys.io/account/api

Searches for hosts matching a sample query.
"""

import requests

from _common import print_header, print_result, print_error, print_footer

API_ID = "YOUR_CENSYS_API_ID"
API_SECRET = "YOUR_CENSYS_API_SECRET"
QUERY = "services.service_name: HTTP"  # sample search query
URL = "https://search.censys.io/api/v2/hosts/search"


def main():
    print_header("Censys", URL)
    try:
        resp = requests.get(
            URL,
            params={"q": QUERY, "per_page": 5},
            auth=(API_ID, API_SECRET),
            timeout=10,
        )
        print_result(resp)
    except requests.RequestException as exc:
        print_error(exc)
    print_footer()


if __name__ == "__main__":
    main()
