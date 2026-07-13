"""
BinaryEdge tester.

Docs: https://docs.binaryedge.io/api-v2/
Auth: header 'X-Key: <your key>'
Get a key -> https://app.binaryedge.io/

Looks up scan results for a sample IP address.
"""

import requests

from _common import print_header, print_result, print_error, print_footer

API_KEY = "YOUR_BINARYEDGE_API_KEY"
IP = "8.8.8.8"  # sample IP to look up
URL = f"https://api.binaryedge.io/v2/query/ip/{IP}"


def main():
    print_header("BinaryEdge", URL)
    headers = {"X-Key": API_KEY}
    try:
        resp = requests.get(URL, headers=headers, timeout=10)
        print_result(resp)
    except requests.RequestException as exc:
        print_error(exc)
    print_footer()


if __name__ == "__main__":
    main()
