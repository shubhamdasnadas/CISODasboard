"""
Onyphe tester.

Docs: https://www.onyphe.io/docs/apis
Auth: header 'Authorization: apikey <your key>'
Get a key -> https://www.onyphe.io/

Looks up summary info for a sample IP address.
"""

import requests

from _common import print_header, print_result, print_error, print_footer

API_KEY = "YOUR_ONYPHE_API_KEY"
IP = "8.8.8.8"  # sample IP to look up
URL = f"https://www.onyphe.io/api/v2/summary/ip/{IP}"


def main():
    print_header("Onyphe", URL)
    headers = {"Authorization": f"apikey {API_KEY}"}
    try:
        resp = requests.get(URL, headers=headers, timeout=10)
        print_result(resp)
    except requests.RequestException as exc:
        print_error(exc)
    print_footer()


if __name__ == "__main__":
    main()
