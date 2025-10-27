from __future__ import annotations

import asyncio
import logging
from time import perf_counter

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from opentelemetry import trace
from .metrics import integration_histogram

logger = logging.getLogger(__name__)
tracer = trace.get_tracer("ai-orchestrator.s3")

S3_HISTOGRAM = integration_histogram()


class S3Tool:
    provider_name = "s3"

    def __init__(self, endpoint: str, access_key: str, secret_key: str, bucket: str):
        self.bucket = bucket
        self._client = boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
        )

    async def upload(self, key: str, data: bytes, *, content_type: str = "application/octet-stream") -> str:
        return await asyncio.get_running_loop().run_in_executor(
            None, self._upload_sync, key, data, content_type
        )

    def _upload_sync(self, key: str, data: bytes, content_type: str) -> str:
        with tracer.start_as_current_span("s3.upload") as span:
            span.set_attribute("integration_call", self.provider_name)
            span.set_attribute("s3.key", key)
            start_time = perf_counter()
            try:
                self._client.put_object(Bucket=self.bucket, Key=key, Body=data, ContentType=content_type)
                duration = perf_counter() - start_time
                S3_HISTOGRAM.labels(provider=self.provider_name, status="200").observe(duration)
                return f"s3://{self.bucket}/{key}"
            except (BotoCoreError, ClientError) as exc:
                duration = perf_counter() - start_time
                S3_HISTOGRAM.labels(provider=self.provider_name, status="error").observe(duration)
                span.record_exception(exc)
                logger.error("Failed to upload %s: %s", key, exc)
                raise

    async def generate_presigned_url(self, key: str, expires: int = 3600) -> str:
        return await asyncio.get_running_loop().run_in_executor(
            None, self._generate_url_sync, key, expires
        )

    def _generate_url_sync(self, key: str, expires: int) -> str:
        with tracer.start_as_current_span("s3.presign") as span:
            span.set_attribute("integration_call", self.provider_name)
            span.set_attribute("s3.key", key)
            start_time = perf_counter()
            try:
                url = self._client.generate_presigned_url(
                    "get_object",
                    Params={"Bucket": self.bucket, "Key": key},
                    ExpiresIn=expires,
                )
                duration = perf_counter() - start_time
                S3_HISTOGRAM.labels(provider=self.provider_name, status="200").observe(duration)
                return url
            except (BotoCoreError, ClientError) as exc:
                duration = perf_counter() - start_time
                S3_HISTOGRAM.labels(provider=self.provider_name, status="error").observe(duration)
                span.record_exception(exc)
                logger.error("Failed to presign %s: %s", key, exc)
                raise
