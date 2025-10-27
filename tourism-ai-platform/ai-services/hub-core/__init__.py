"""Compatibility package that re-exports :mod:`ai_services.hub_core`.

The Synchron AI Hub is implemented in ``ai_services.hub_core``. This alias
allows existing tooling that references ``hub-core`` on disk to function while
keeping a valid Python package name available for imports.
"""

from ai_services.hub_core.context_manager import ContextManager
from ai_services.hub_core.hub_router import HubRouter
from ai_services.hub_core.metrics_collector import MetricsCollector
from ai_services.hub_core.registry_client import RegistryClient

__all__ = [
    "ContextManager",
    "HubRouter",
    "MetricsCollector",
    "RegistryClient",
]
