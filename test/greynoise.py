"""
GreyNoise tester (Community API).

Docs: https://docs.greynoise.io/reference/get_v3-community-ip
Auth: header 'key: <your key>' (Community tier has a generous free allowance)
Get a key -> https://viz.greynoise.io/signup

Checks whether a sample IP is known internet background noise.
"""

import requests

from _common import print_header, print_result, print_error, print_footer

API_KEY = "YOUR_GREYNOISE_API_KEY"
IP = "8.8.8.8"  # sample IP to check
URL = f"https://api.greynoise.io/v3/community/{IP}"


def main():
    print_header("GreyNoise", URL)
    headers = {"key": API_KEY, "Accept": "application/json"}
    try:
        resp = requests.get(URL, headers=headers, timeout=10)
        print_result(resp)
    except requests.RequestException as exc:
        print_error(exc)
    print_footer()


if __name__ == "__main__":
    main()
