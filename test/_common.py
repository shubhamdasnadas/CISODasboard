"""Shared helper for the OSINT tool tester scripts in this directory.

Every tester script imports `run()` from here so they all report results
the same way: HTTP status, a truncated preview of the response body, and
any request exception, all printed to the console.
"""

import json


def print_header(tool_name: str, endpoint: str) -> None:
    print("=" * 70)
    print(f"Tool:     {tool_name}")
    print(f"Endpoint: {endpoint}")
    print("=" * 70)


def print_result(response, max_chars: int = 1500) -> None:
    print(f"Status code: {response.status_code}")
    try:
        body = json.dumps(response.json(), indent=2)
    except ValueError:
        body = response.text
    if len(body) > max_chars:
        body = body[:max_chars] + f"\n... [truncated, {len(body)} chars total]"
    print("Response body:")
    print(body)


def print_error(exc: Exception) -> None:
    print(f"Request failed: {type(exc).__name__}: {exc}")


def print_footer() -> None:
    print("-" * 70)
    print()
