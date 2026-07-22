"""
Pulsedive tester.

Docs: https://pulsedive.com/api/
Auth: query param 'key=<your key>' (free tier available)
Get a key -> https://pulsedive.com/account/

Looks up enrichment/risk info for a sample indicator.
"""

import requests

from _common import print_header, print_result, print_error, print_footer

API_KEY = "YOUR_PULSEDIVE_API_KEY"
INDICATOR = "8.8.8.8"  # sample indicator to look up
URL = "https://pulsedive.com/api/info.php"


def main():
    print_header("Pulsedive", URL)
    try:
        resp = requests.get(
            URL, params={"indicator": INDICATOR, "key": API_KEY}, timeout=10
        )
        print_result(resp)
    except requests.RequestException as exc:
        print_error(exc)
    print_footer()


if __name__ == "__main__":
    main()
