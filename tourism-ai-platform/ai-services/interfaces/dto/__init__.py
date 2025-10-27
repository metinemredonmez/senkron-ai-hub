"""Compatibility layer forwarding to :mod:`ai_services.interfaces.dto`."""

from ai_services.interfaces.dto.channel_message_dto import ChannelMessageDTO
from ai_services.interfaces.dto.postop_dto import PostOpDTO
from ai_services.interfaces.dto.preop_dto import PreOpDTO
from ai_services.interfaces.dto.security_dto import SecurityEventDTO

__all__ = [
    "ChannelMessageDTO",
    "PostOpDTO",
    "PreOpDTO",
    "SecurityEventDTO",
]
