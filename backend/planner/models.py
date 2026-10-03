import uuid
from datetime import time

from django.conf import settings
from django.db import models
from django.utils import timezone


class Institution(models.Model):
    name = models.CharField(max_length=200)
    slug = models.SlugField(unique=True)
    kind = models.CharField(
        max_length=20,
        choices=[("school", "Schule"), ("university", "Hochschule")],
        default="university",
    )
    timezone = models.CharField(max_length=80, default="Europe/Berlin")
    license_until = models.DateField(null=True, blank=True)
    revision = models.PositiveIntegerField(default=0)
    unit_minutes = models.PositiveIntegerField(default=45)
    exam_max_per_day = models.PositiveIntegerField(default=1)
    exam_gap_hours = models.PositiveIntegerField(default=24)

    def __str__(self):
        return self.name

    def clean(self):
        from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

        from django.core.exceptions import ValidationError

        try:
            ZoneInfo(self.timezone)
        except ZoneInfoNotFoundError:
            raise ValidationError(
                {"timezone": "Gültige IANA-Zeitzone angeben."}
            ) from None
        if (
            not self.unit_minutes
            or self.unit_minutes > 240
            or not self.exam_max_per_day
        ):
            raise ValidationError(
                "Unterrichtseinheit und maximale Prüfungszahl müssen positiv sein."
            )


class Membership(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    institution = models.ForeignKey(Institution, on_delete=models.CASCADE)
    role = models.CharField(
        max_length=20,
        choices=[("admin", "Verwaltung"), ("planner", "Planungsverantwortlich")],
        default="planner",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "institution"], name="unique_membership"
            )
        ]


class TenantModel(models.Model):
    institution = models.ForeignKey(Institution, on_delete=models.CASCADE)
    code = models.CharField(max_length=80)
    name = models.CharField(max_length=200)

    class Meta:
        abstract = True
        constraints = [
            models.UniqueConstraint(
                fields=["institution", "code"], name="%(class)s_tenant_code"
            )
        ]

    def __str__(self):
        return self.name


class Area(TenantModel):
    pass


class Program(TenantModel):
    duration_semesters = models.PositiveIntegerField(default=6)
    total_credits = models.DecimalField(max_digits=6, decimal_places=1, default=180)


class StudyVersion(TenantModel):
    program = models.ForeignKey(Program, on_delete=models.PROTECT)
    version = models.CharField(max_length=80)
    duration_semesters = models.PositiveIntegerField(default=6)
    total_credits = models.DecimalField(max_digits=6, decimal_places=1, default=180)
    status = models.CharField(
        max_length=12,
        choices=[("draft", "Entwurf"), ("approved", "Freigegeben")],
        default="draft",
    )


class Module(TenantModel):
    difficulty = models.PositiveIntegerField(
        choices=[(1, "Leicht"), (2, "Mittel"), (3, "Anspruchsvoll")], default=2
    )
    study_version = models.ForeignKey(
        StudyVersion, on_delete=models.PROTECT, related_name="modules"
    )
    parent = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.PROTECT, related_name="children"
    )
    credits = models.DecimalField(max_digits=6, decimal_places=1, default=0)
    prerequisites = models.ManyToManyField("self", symmetrical=False, blank=True)


class TeachingUnit(TenantModel):
    group_mode = models.CharField(
        max_length=12,
        choices=[("combined", "Gruppen gemeinsam"), ("per_group", "Je Gruppe separat")],
        default="combined",
    )
    module = models.ForeignKey(
        Module, on_delete=models.PROTECT, related_name="teaching_units"
    )
    semester = models.PositiveIntegerField(default=1)
    format = models.CharField(
        max_length=20,
        choices=[
            ("lecture", "Vorlesung"),
            ("seminar", "Seminar"),
            ("exercise", "Übung"),
            ("lab", "Labor"),
            ("project", "Projekt"),
        ],
        default="lecture",
    )
    target_mode = models.CharField(
        max_length=10,
        choices=[("weekly", "Pro Woche"), ("total", "Gesamtumfang")],
        default="weekly",
    )
    target_units = models.PositiveIntegerField(default=2)
    duration_minutes = models.PositiveIntegerField(default=90)
    block_days = models.PositiveIntegerField(default=1)
    week_pattern = models.CharField(
        max_length=10,
        choices=[("all", "Jede Woche"), ("A", "A-Woche"), ("B", "B-Woche")],
        default="all",
    )
    elective = models.BooleanField(default=False)
    equipment = models.JSONField(default=list, blank=True)
    teachers = models.ManyToManyField(
        "Person", blank=True, related_name="study_teaching_units"
    )


class Cohort(TenantModel):
    program = models.ForeignKey(Program, on_delete=models.PROTECT)
    study_version = models.ForeignKey(
        StudyVersion, null=True, blank=True, on_delete=models.PROTECT
    )
    entry_year = models.PositiveIntegerField(null=True, blank=True)
    study_schedule = models.JSONField(default=dict, blank=True)
    semester_credit_limit = models.DecimalField(
        max_digits=6, decimal_places=1, default=0
    )
    semester_weekly_limit = models.PositiveIntegerField(default=0)
    semester_difficulty_limit = models.PositiveIntegerField(default=0)


class Group(TenantModel):
    cohort = models.ForeignKey(Cohort, on_delete=models.PROTECT)
    size = models.PositiveIntegerField(default=0)


class Person(TenantModel):
    kind = models.CharField(
        max_length=20,
        choices=[("learner", "Lernende"), ("teacher", "Lehrende")],
        default="learner",
    )
    groups = models.ManyToManyField(Group, blank=True, related_name="people")
    availability = models.JSONField(default=dict, blank=True)


def default_weekdays():
    return [0, 1, 2, 3, 4]


class Period(TenantModel):
    start = models.DateField()
    end = models.DateField()
    excluded_dates = models.JSONField(default=list, blank=True)
    day_start = models.TimeField(default=time(8))
    day_end = models.TimeField(default=time(18))
    slot_minutes = models.PositiveIntegerField(default=30)
    weekdays = models.JSONField(default=default_weekdays, blank=True)


class Building(TenantModel):
    longitude = models.FloatField(default=13.388)
    latitude = models.FloatField(default=52.517)
    geometry = models.JSONField(default=dict, blank=True)


class Floor(TenantModel):
    building = models.ForeignKey(Building, on_delete=models.PROTECT)
    level = models.IntegerField(default=0)
    background = models.FileField(upload_to="floorplans/", blank=True)


class Room(TenantModel):
    floor = models.ForeignKey(Floor, on_delete=models.PROTECT)
    capacity = models.PositiveIntegerField(default=30)
    equipment = models.JSONField(default=list, blank=True)
    polygon = models.JSONField(default=list, blank=True)


class Curriculum(TenantModel):
    program = models.ForeignKey(Program, on_delete=models.PROTECT)
    items = models.JSONField(default=list, blank=True)


class Plan(TenantModel):
    period = models.ForeignKey(Period, on_delete=models.PROTECT)
    area = models.ForeignKey(Area, on_delete=models.PROTECT)
    cohort = models.ForeignKey(Cohort, null=True, blank=True, on_delete=models.PROTECT)
    semester = models.PositiveIntegerField(default=1)


class Course(TenantModel):
    study_group = models.ForeignKey(
        Group,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="study_deliveries",
    )
    plan = models.ForeignKey(Plan, on_delete=models.CASCADE)
    teaching_unit = models.ForeignKey(
        TeachingUnit, null=True, blank=True, on_delete=models.PROTECT
    )
    groups = models.ManyToManyField(Group, blank=True)
    learners = models.ManyToManyField(
        Person, blank=True, related_name="enrolled_courses"
    )
    teachers = models.ManyToManyField(
        Person, blank=True, related_name="teaching_courses"
    )
    elective = models.BooleanField(default=False)
    target_mode = models.CharField(
        max_length=10,
        choices=[("weekly", "Pro Woche"), ("total", "Gesamtumfang")],
        default="weekly",
    )
    target_units = models.PositiveIntegerField(default=2)
    duration_minutes = models.PositiveIntegerField(default=90)
    block_days = models.PositiveIntegerField(default=1)
    week_pattern = models.CharField(
        max_length=10,
        choices=[("all", "Jede Woche"), ("A", "A-Woche"), ("B", "B-Woche")],
        default="all",
    )
    equipment = models.JSONField(default=list, blank=True)
    color = models.CharField(max_length=20, default="blue")
    # Explicit per-occurrence teacher IDs. Empty means the full teaching team.
    teacher_assignments = models.JSONField(default=list, blank=True)

    class Meta(TenantModel.Meta):
        constraints = TenantModel.Meta.constraints + [
            models.UniqueConstraint(
                fields=["plan", "teaching_unit"],
                condition=models.Q(study_group__isnull=True),
                name="course_study_combined_unique",
            ),
            models.UniqueConstraint(
                fields=["plan", "teaching_unit", "study_group"],
                name="course_study_group_unique",
            ),
        ]


class Exam(TenantModel):
    plan = models.ForeignKey(Plan, on_delete=models.CASCADE)
    course = models.ForeignKey(Course, on_delete=models.PROTECT, null=True, blank=True)
    learners = models.ManyToManyField(Person, blank=True, related_name="exams")
    supervisors = models.ManyToManyField(
        Person, blank=True, related_name="supervised_exams"
    )
    duration_minutes = models.PositiveIntegerField(default=120)
    window_start = models.DateField()
    window_end = models.DateField()
    resit = models.BooleanField(default=False)
    equipment = models.JSONField(default=list, blank=True)


class Session(models.Model):
    institution = models.ForeignKey(Institution, on_delete=models.CASCADE)
    plan = models.ForeignKey(Plan, on_delete=models.CASCADE, related_name="sessions")
    course = models.ForeignKey(Course, null=True, blank=True, on_delete=models.PROTECT)
    exam = models.ForeignKey(Exam, null=True, blank=True, on_delete=models.PROTECT)
    name = models.CharField(max_length=200, blank=True)
    start = models.DateTimeField()
    end = models.DateTimeField()
    rooms = models.ManyToManyField(Room)
    teachers = models.ManyToManyField(Person, blank=True)
    locked = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(end__gt=models.F("start")),
                name="session_positive_duration",
            )
        ]


class RoomBlock(TenantModel):
    rooms = models.ManyToManyField(Room)
    start = models.DateTimeField()
    end = models.DateTimeField()
    repeat_weekly = models.BooleanField(default=False)
    repeat_until = models.DateField(null=True, blank=True)


class Publication(models.Model):
    institution = models.ForeignKey(Institution, on_delete=models.CASCADE)
    plan = models.ForeignKey(Plan, on_delete=models.CASCADE)
    number = models.PositiveIntegerField()
    created = models.DateTimeField(default=timezone.now)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL
    )
    snapshot = models.JSONField(default=list)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["plan", "number"], name="publication_number"
            )
        ]


class Display(TenantModel):
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    plans = models.ManyToManyField(Plan, blank=True)
    view_mode = models.CharField(
        max_length=10,
        choices=[("week", "Woche"), ("today", "Heute"), ("tomorrow", "Morgen")],
        default="week",
    )
    show_teachers = models.BooleanField(default=False)
    auto_scroll = models.BooleanField(default=True)
    scroll_seconds = models.PositiveIntegerField(default=20)
    active = models.BooleanField(default=True)


class Job(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    institution = models.ForeignKey(Institution, on_delete=models.CASCADE)
    plan = models.ForeignKey(Plan, on_delete=models.CASCADE)
    revision = models.PositiveIntegerField()
    kind = models.CharField(max_length=20, default="teaching")
    status = models.CharField(max_length=30, default="queued")
    message = models.TextField(blank=True)
    result = models.JSONField(default=list)
    cancel_requested = models.BooleanField(default=False)
    created = models.DateTimeField(default=timezone.now)


class Audit(models.Model):
    institution = models.ForeignKey(Institution, on_delete=models.CASCADE)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL
    )
    action = models.CharField(max_length=200)
    created = models.DateTimeField(default=timezone.now)


class ImportBatch(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    institution = models.ForeignKey(Institution, on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    resource = models.CharField(max_length=40)
    rows = models.JSONField(default=list)
    revision = models.PositiveIntegerField()
    created = models.DateTimeField(default=timezone.now)
    committed = models.BooleanField(default=False)
