"""
Maltiverse tester.

Docs: https://app.maltiverse.com/api/... (docs linked from the app dashboard)
Auth: Bearer token, header 'Authorization: Bearer <your token>'
Get a token -> https://maltiverse.com/

Looks up threat score/context for a sample IP address.
"""

import requests

from _common import print_header, print_result, print_error, print_footer

API_TOKEN = "YOUR_MALTIVERSE_API_TOKEN"
IP = "8.8.8.8"  # sample IP to look up
URL = f"https://api.maltiverse.com/ip/{IP}"


def main():
    print_header("Maltiverse", URL)
    headers = {"Authorization": f"Bearer {API_TOKEN}"}
    try:
        resp = requests.get(URL, headers=headers, timeout=10)
        print_result(resp)
    except requests.RequestException as exc:
        print_error(exc)
    print_footer()


if __name__ == "__main__":
    main()
