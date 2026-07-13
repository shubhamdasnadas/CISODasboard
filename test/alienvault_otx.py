"""
AlienVault OTX (Open Threat Exchange) tester.

Docs: https://otx.alienvault.com/api
Auth: header 'X-OTX-API-KEY: <your key>'
Free account -> https://otx.alienvault.com/

Looks up threat intel pulses for a sample indicator (IP address).
"""

import requests

from _common import print_header, print_result, print_error, print_footer

API_KEY = "YOUR_OTX_API_KEY"
INDICATOR = "8.8.8.8"  # sample IP to look up
URL = f"https://otx.alienvault.com/api/v1/indicators/IPv4/{INDICATOR}/general"


def main():
    print_header("AlienVault OTX", URL)
    headers = {"X-OTX-API-KEY": API_KEY}
    try:
        resp = requests.get(URL, headers=headers, timeout=10)
        print_result(resp)
    except requests.RequestException as exc:
        print_error(exc)
    print_footer()


if __name__ == "__main__":
    main()
