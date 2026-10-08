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
    page = serializers.ChoiceField(
        choices=[
            "setup",
            "schedule",
            "data",
            "exams",
            "map",
            "students",
            "displays",
            "settings",
        ],
        required=False,
    )
    step = serializers.IntegerField(min_value=0, max_value=5, required=False)
    resource = serializers.ChoiceField(
        choices=[
            "",
            "areas",
            "programs",
            "studyversions",
            "modules",
            "teachingunits",
            "cohorts",
            "groups",
            "people",
            "periods",
            "buildings",
            "floors",
            "rooms",
            "curricula",
            "plans",
            "courses",
            "exams",
            "blocks",
            "displays",
            "assessments",
        ],
        required=False,
    )
    study_version = serializers.IntegerField(
        min_value=1, required=False, allow_null=True
    )
    view_cohort = serializers.IntegerField(min_value=1, required=False, allow_null=True)
    building = serializers.IntegerField(min_value=1, required=False, allow_null=True)
    floor = serializers.IntegerField(min_value=1, required=False, allow_null=True)
    week = serializers.DateField(required=False, allow_null=True)
    session_id = serializers.IntegerField(min_value=1, required=False, allow_null=True)
    group_filter = serializers.CharField(
        max_length=200, required=False, allow_blank=True
    )
    room_filter = serializers.CharField(
        max_length=200, required=False, allow_blank=True
    )


class ChatMessage(serializers.Serializer):
    role = serializers.ChoiceField(choices=["user", "assistant"])
    content = serializers.CharField(max_length=6000)


class ChatInput(Selection):
    question = serializers.CharField(max_length=2000)
    history = ChatMessage(many=True, required=False, max_length=12)
    use_model = serializers.BooleanField(default=False)


def selected_context(request, values, *, social=False):
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
    if values.get("session_id"):
        session = get_object_or_404(
            m.Session, institution=institution, id=values["session_id"]
        )
        if not plan or session.plan_id != plan.id:
            raise serializers.ValidationError(
                "Termin muss zum ausgewählten Semesterplan gehören."
            )
    for field, model in (
        ("study_version", m.StudyVersion),
        ("view_cohort", m.Cohort),
        ("building", m.Building),
        ("floor", m.Floor),
    ):
        if values.get(field):
            obj = get_object_or_404(model, institution=institution, id=values[field])
            if (
                field == "floor"
                and values.get("building")
                and obj.building_id != values["building"]
            ):
                raise serializers.ValidationError(
                    "Stockwerk muss zum ausgewählten Bereich gehören."
                )
    # Still validate tenant ownership above; greetings need no planning queries.
    if social:
        return {"revision": institution.revision}
    return campus_ai.context_for(institution, plan, cohort, values)


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
    if sum(len(item["content"]) for item in values.get("history", [])) > 12000:
        raise serializers.ValidationError(
            "Chatverlauf ist zu lang. Bitte einen neuen Chat beginnen."
        )
    return Response(
        campus_ai.reply(
            values["question"],
            selected_context(
                request, values, social=bool(campus_ai.social_reply(values["question"]))
            ),
            values.get("history"),
            values["use_model"],
        )
    )
