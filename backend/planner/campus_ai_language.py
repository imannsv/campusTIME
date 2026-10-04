"""Conservative tool-guide matching. Never generates executable UI actions."""

import json
import re
from functools import lru_cache
from pathlib import Path

from django.conf import settings


@lru_cache(maxsize=1)
def language():
    return json.loads(
        (Path(settings.BASE_DIR).parent / "shared/campus-ai-language.json").read_text(
            encoding="utf-8"
        )
    )


def normalize(value):
    text = value.strip().casefold()
    for source, target in (("ä", "ae"), ("ö", "oe"), ("ü", "ue")):
        text = text.replace(source, target)
    text = re.sub(r"[.!?…👋🙂😊👍🙏\ufe0f\s]+$", "", text)
    return re.sub(r"\s+", " ", text.replace(",", " ")).strip()


def question_text(value):
    text = normalize(value)
    text = re.sub(r"^(?:(?:hi|hallo|hey|moin)(?: freddy)?|freddy)\s+", "", text)
    return re.sub(r"\s+(?:bitte|freddy)$", "", text).strip()


def core(value):
    tokens = re.findall(r"[a-z0-9]+", question_text(value))
    rules = language()
    return sorted(
        rules["synonyms"].get(token, token)
        for token in tokens
        if token not in rules["stopwords"]
    )


def one_typo(a, b):
    if a == b:
        return True
    if min(len(a), len(b)) < 5 or abs(len(a) - len(b)) > 1:
        return False
    if len(a) == len(b):
        return sum(left != right for left, right in zip(a, b, strict=True)) == 1
    short, long = (a, b) if len(a) < len(b) else (b, a)
    return any(long[:index] + long[index + 1 :] == short for index in range(len(long)))


def match_faq(question, entries):
    text = question_text(question)
    exact = next(
        (
            item
            for item in entries
            if any(question_text(phrase) == text for phrase in item["phrases"])
        ),
        None,
    )
    if exact:
        return exact
    # Additional conditions need an individual answer; never swallow negation.
    if any(
        token in language()["qualifiers"] for token in re.findall(r"[a-z0-9]+", text)
    ):
        return None
    if not re.match(
        r"^(wie|wo|was|warum|wieso|welche\w*|kann\w*|koenn\w*|muss|soll|darf|sind|ist|gibt|erklaer\w*)\b",
        text,
    ):
        return None
    tokens = core(text)
    if len(tokens) < 2:
        return None
    matches = []
    for item in entries:
        for phrase in item["phrases"]:
            candidate = core(phrase)
            if (
                len(tokens) == len(candidate)
                and sum(a != b for a, b in zip(tokens, candidate, strict=True)) <= 1
                and all(one_typo(a, b) for a, b in zip(tokens, candidate, strict=True))
            ):
                matches.append(item)
                break
    return matches[0] if len(matches) == 1 else None


def is_followup(question):
    return question_text(question) in {
        question_text(item) for item in language()["followups"]
    }


def resolve_faq(question, history, entries):
    direct = match_faq(question, entries)
    if direct or not is_followup(question):
        return direct
    for message in reversed(history or []):
        if message.get("role") != "user" or is_followup(message["content"]):
            continue
        # Stop at the latest topic, including an unknown one, rather than reuse an old topic.
        return match_faq(message["content"], entries)
    return None
