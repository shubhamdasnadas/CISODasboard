"""
Shodan tester.

Docs: https://developer.shodan.io/api
Auth: query param 'key=<your key>'
Get a key -> https://account.shodan.io/

Looks up host information for a sample IP address.
"""

import requests

from _common import print_header, print_result, print_error, print_footer

API_KEY = "YOUR_SHODAN_API_KEY"
IP = "8.8.8.8"  # sample IP to look up
URL = f"https://api.shodan.io/shodan/host/{IP}"


def main():
    print_header("Shodan", URL)
    try:
        resp = requests.get(URL, params={"key": API_KEY}, timeout=10)
        print_result(resp)
    except requests.RequestException as exc:
        print_error(exc)
    print_footer()


if __name__ == "__main__":
    main()
