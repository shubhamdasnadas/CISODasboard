"""
PhishTank tester.

Docs: https://www.phishtank.com/developer_info.php
Auth: form field 'app_key=<your key>' (free registration)
Get a key -> https://www.phishtank.com/register.php

Checks a sample URL against PhishTank's verified phishing database.
"""

import requests

from _common import print_header, print_result, print_error, print_footer

API_KEY = "YOUR_PHISHTANK_APP_KEY"
URL_TO_CHECK = "http://example.com/"  # sample URL to check
URL = "https://checkurl.phishtank.com/checkurl/"


def main():
    print_header("PhishTank", URL)
    headers = {"User-Agent": "phishtank/ciso-dashboard-tester"}
    data = {
        "url": URL_TO_CHECK,
        "format": "json",
        "app_key": API_KEY,
    }
    try:
        resp = requests.post(URL, data=data, headers=headers, timeout=10)
        print_result(resp)
    except requests.RequestException as exc:
        print_error(exc)
    print_footer()


if __name__ == "__main__":
    main()
