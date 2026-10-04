from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.decorators import api_view, throttle_classes
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle

from . import campus_ai
from . import models as m
from .views import tenant


class ChatThrottle(SimpleRateThrottle):
    rate = "12/min"
    scope = "campus-ai"

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": request.user.pk}


class Selection(serializers.Serializer):
    plan = serializers.IntegerField(min_value=1, required=False, allow_null=True)
    cohort = serializers.IntegerField(min_value=1, required=False, allow_null=True)


class ChatMessage(serializers.Serializer):
    role = serializers.ChoiceField(choices=["user", "assistant"])
    content = serializers.CharField(max_length=2000)


class ChatInput(Selection):
    question = serializers.CharField(max_length=2000)
    history = ChatMessage(many=True, required=False, max_length=6)
    use_model = serializers.BooleanField(default=False)


def selected_context(request, values):
    institution = tenant(request)
    plan = (
        get_object_or_404(
            m.Plan.objects.select_related("period", "cohort__study_version"),
            institution=institution,
            id=values["plan"],
        )
        if values.get("plan")
        else None
    )
    cohort = (
        get_object_or_404(
            m.Cohort.objects.select_related("study_version"),
            institution=institution,
            id=values["cohort"],
        )
        if values.get("cohort")
        else None
    )
    if plan and cohort and plan.cohort_id != cohort.id:
        raise serializers.ValidationError(
            "Jahrgang muss zum ausgewählten Semesterplan gehören."
        )
    return campus_ai.context_for(institution, plan, cohort)


@api_view(["GET"])
def status(request):
    tenant(request)
    return Response(campus_ai.model_status())


@api_view(["GET"])
def context(request):
    selection = Selection(data=request.query_params)
    selection.is_valid(raise_exception=True)
    return Response(selected_context(request, selection.validated_data))


@api_view(["POST"])
@throttle_classes([ChatThrottle])
def chat(request):
    payload = ChatInput(data=request.data)
    payload.is_valid(raise_exception=True)
    values = payload.validated_data
    if sum(len(item["content"]) for item in values.get("history", [])) > 6000:
        raise serializers.ValidationError(
            "Chatverlauf ist zu lang. Bitte einen neuen Chat beginnen."
        )
    return Response(
        campus_ai.reply(
            values["question"],
            selected_context(request, values),
            values.get("history"),
            values["use_model"],
        )
    )
