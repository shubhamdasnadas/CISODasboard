"""
OpenSanctions tester.

Docs: https://www.opensanctions.org/docs/api/
Auth: header 'Authorization: ApiKey <your key>' for the hosted API
Get a key -> https://www.opensanctions.org/api/

Searches for a sample entity name against sanctions/PEP lists.
"""

import requests

from _common import print_header, print_result, print_error, print_footer

API_KEY = "YOUR_OPENSANCTIONS_API_KEY"
ENTITY_NAME = "Vladimir Putin"  # sample well-known sanctioned entity
URL = "https://api.opensanctions.org/search/default"


def main():
    print_header("OpenSanctions", URL)
    headers = {"Authorization": f"ApiKey {API_KEY}"}
    try:
        resp = requests.get(
            URL, params={"q": ENTITY_NAME}, headers=headers, timeout=10
        )
        print_result(resp)
    except requests.RequestException as exc:
        print_error(exc)
    print_footer()


if __name__ == "__main__":
    main()
