"""
Netlas.io tester.

Docs: https://netlas.io/api
Auth: header 'X-API-Key: <your key>' (free tier: 50 requests/day)
Get a key -> https://app.netlas.io/

Looks up host info for a sample IP address.
"""

import requests

from _common import print_header, print_result, print_error, print_footer

API_KEY = "YOUR_NETLAS_API_KEY"
IP = "8.8.8.8"  # sample IP to look up
URL = "https://app.netlas.io/api/host/"


def main():
    print_header("Netlas.io", URL)
    headers = {"X-API-Key": API_KEY}
    try:
        resp = requests.get(URL, params={"q": IP}, headers=headers, timeout=10)
        print_result(resp)
    except requests.RequestException as exc:
        print_error(exc)
    print_footer()


if __name__ == "__main__":
    main()
