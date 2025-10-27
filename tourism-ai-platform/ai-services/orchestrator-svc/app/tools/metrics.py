from __future__ import annotations

from typing import Dict

from prometheus_client import Histogram

_HISTOGRAMS: Dict[str, Histogram] = {}


def integration_histogram() -> Histogram:
    histogram = _HISTOGRAMS.get("integration_request_duration_seconds")
    if histogram is None:
        histogram = Histogram(
            "integration_request_duration_seconds",
            "Integration request duration in seconds",
            labelnames=("provider", "status"),
            buckets=(0.1, 0.3, 0.5, 1, 2, 5, 10),
        )
        _HISTOGRAMS["integration_request_duration_seconds"] = histogram
    return histogram
