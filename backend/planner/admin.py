from django.contrib import admin
from django.db import transaction
from django.db.models import F

from . import models


class ReadOnlyAdmin(admin.ModelAdmin):
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


class InstitutionAdmin(admin.ModelAdmin):
    readonly_fields = ["revision"]
    list_display = ["name", "slug", "kind", "license_until"]

    def save_model(self, request, obj, form, change):
        with transaction.atomic():
            if change:
                models.Institution.objects.select_for_update().get(pk=obj.pk)
            super().save_model(request, obj, form, change)
            models.Institution.objects.filter(pk=obj.pk).update(
                revision=F("revision") + 1
            )
            models.Audit.objects.create(
                institution=obj,
                user=request.user,
                action="Betrieb: Einrichtungseinstellungen geändert",
            )


for name in [
    "Institution",
    "Membership",
    "Area",
    "Program",
    "StudyVersion",
    "Module",
    "TeachingUnit",
    "Cohort",
    "Group",
    "Person",
    "Period",
    "Building",
    "Floor",
    "Room",
    "Curriculum",
    "Plan",
    "Course",
    "Assessment",
    "Exam",
    "RoomBlock",
    "Display",
]:
    admin.site.register(
        getattr(models, name),
        InstitutionAdmin
        if name == "Institution"
        else admin.ModelAdmin
        if name == "Membership"
        else ReadOnlyAdmin,
    )
admin.site.site_header = "Campuszeit · Betrieb"
