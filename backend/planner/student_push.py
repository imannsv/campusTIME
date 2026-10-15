"""Durable, session-scoped APNs delivery; no message contents on the lock screen."""

import time
from datetime import timedelta
from functools import lru_cache
from pathlib import Path

import httpx
import jwt
from django.conf import settings
from django.db.models import F, Q
from django.utils import timezone

from . import models as m


def push_configured():
    return (
        settings.APNS_ENABLED
        and all(
            (
                settings.APNS_TEAM_ID,
                settings.APNS_KEY_ID,
                settings.APNS_KEY_PATH,
                settings.APNS_TOPIC,
            )
        )
        and settings.APNS_ENVIRONMENT in ("sandbox", "production")
    )


def audience(notice):
    scope = Q(
        access__institution_id=notice.institution_id, access__must_change_password=False
    )
    if notice.group_id:
        scope &= (
            Q(access__group_id=notice.group_id)
            | Q(access__cohort_id=notice.group.cohort_id)
            | Q(
                access__person__kind="learner",
                access__person__institution_id=notice.institution_id,
                access__person__groups__id=notice.group_id,
            )
        )
    elif notice.cohort_id:
        scope &= (
            Q(access__cohort_id=notice.cohort_id)
            | Q(access__group__cohort_id=notice.cohort_id)
            | Q(
                access__person__kind="learner",
                access__person__institution_id=notice.institution_id,
                access__person__groups__cohort_id=notice.cohort_id,
            )
        )
    return scope


def queue_notice_push(notice):
    if not settings.APNS_ENABLED or not notice.active:
        return
    devices = m.StudentDeviceSession.objects.filter(
        audience(notice),
        access__active=True,
        expires__gt=timezone.now(),
        push_token__isnull=False,
    ).distinct()
    m.StudentPushDelivery.objects.bulk_create(
        [
            m.StudentPushDelivery(
                notice=notice, device=device, binding=device.push_binding
            )
            for device in devices
        ],
        ignore_conflicts=True,
    )


@lru_cache(maxsize=4)
def provider_token(team, key_id, key_path, window):
    return jwt.encode(
        {"iss": team, "iat": int(time.time())},
        Path(key_path).read_bytes(),
        algorithm="ES256",
        headers={"kid": key_id},
    )


def send_apns(client, delivery):
    token = provider_token(
        settings.APNS_TEAM_ID,
        settings.APNS_KEY_ID,
        settings.APNS_KEY_PATH,
        int(time.time()) // 1200,
    )
    host = (
        "api.sandbox.push.apple.com"
        if settings.APNS_ENVIRONMENT == "sandbox"
        else "api.push.apple.com"
    )
    response = client.post(
        f"https://{host}/3/device/{delivery.device.push_token}",
        headers={
            "authorization": "bearer " + token,
            "apns-topic": settings.APNS_TOPIC,
            "apns-push-type": "alert",
            "apns-priority": "10",
            "apns-expiration": str(
                int((delivery.notice.created + timedelta(hours=24)).timestamp())
            ),
            "apns-id": str(delivery.id),
            "apns-collapse-id": str(delivery.id),
        },
        json={
            "aps": {
                "alert": {
                    "title": "CampusZeit",
                    "body": "Eine neue Mitteilung deiner Einrichtung ist verfügbar.",
                },
                "sound": "default",
            },
            "notice_id": delivery.notice_id,
            "binding": str(delivery.binding),
        },
    )
    if response.status_code == 200:
        return 200, ""
    # Never store/log the response body, device token or authorization header.
    try:
        reason = response.json().get("reason", "APNsError")
    except (ValueError, AttributeError):
        reason = "APNsError"
    allowed = {
        "BadDeviceToken",
        "DeviceTokenNotForTopic",
        "Unregistered",
        "ExpiredProviderToken",
        "InvalidProviderToken",
        "Forbidden",
        "TooManyRequests",
        "InternalServerError",
        "ServiceUnavailable",
        "Shutdown",
        "BadTopic",
        "TopicDisallowed",
    }
    return response.status_code, reason if isinstance(
        reason, str
    ) and reason in allowed else "APNsError"


def deliver_pending_pushes():
    if not settings.APNS_ENABLED:
        return 0
    now = timezone.now()
    m.StudentPushDelivery.objects.filter(finished__lt=now - timedelta(days=30)).delete()
    count = 0
    ids = list(
        m.StudentPushDelivery.objects.filter(
            finished__isnull=True, next_attempt__lte=now
        )
        .order_by("next_attempt")
        .values_list("id", flat=True)[:100]
    )
    with httpx.Client(http2=True, timeout=10, trust_env=False) as client:
        for pk in ids:
            claimed = m.StudentPushDelivery.objects.filter(
                pk=pk, finished__isnull=True, next_attempt__lte=now
            ).update(
                next_attempt=timezone.now() + timedelta(minutes=2),
                attempts=F("attempts") + 1,
            )
            if not claimed:
                continue
            delivery = (
                m.StudentPushDelivery.objects.select_related(
                    "notice__group", "device__access"
                )
                .filter(pk=pk)
                .first()
            )
            if delivery is None:
                continue
            device, notice = delivery.device, delivery.notice
            valid = (
                notice.active
                and device.access.active
                and device.expires > timezone.now()
                and device.push_token
                and device.push_binding == delivery.binding
                and notice.created > timezone.now() - timedelta(hours=24)
                and m.StudentDeviceSession.objects.filter(
                    audience(notice), pk=device.pk
                ).exists()
            )
            if not valid:
                m.StudentPushDelivery.objects.filter(pk=pk).update(
                    finished=timezone.now(), result="suppressed"
                )
                continue
            try:
                status, reason = send_apns(client, delivery)
            except (httpx.HTTPError, OSError, ValueError, jwt.PyJWTError):
                status, reason = 503, "TransportOrConfigurationError"
            retry = status in (401, 403, 429) or status >= 500
            if status == 410 or reason in ("BadDeviceToken", "DeviceTokenNotForTopic"):
                m.StudentDeviceSession.objects.filter(
                    pk=device.pk,
                    push_binding=delivery.binding,
                    push_token=device.push_token,
                ).update(push_token=None)
            m.StudentPushDelivery.objects.filter(pk=pk).update(
                result="accepted" if status == 200 else reason,
                finished=None if retry and delivery.attempts < 8 else timezone.now(),
                next_attempt=timezone.now()
                + timedelta(seconds=min(60 * 2**delivery.attempts, 3600)),
            )
            count += 1
    return count
