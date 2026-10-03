from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from planner import models as m
from planner.study import structure_report


class Command(BaseCommand):
    help = "Add a fictional six-semester versioned study structure without changing existing plans."

    @transaction.atomic
    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("Beispieldaten nur im Entwicklungsmodus anlegen.")
        institution = m.Institution.objects.get(slug="demo")
        if m.StudyVersion.objects.filter(
            institution=institution, code="STUDY-WI-2027"
        ).exists():
            self.stdout.write("Studienstruktur-Beispiel bereits vorhanden.")
            return
        program = m.Program.objects.get(institution=institution, code="BWI")
        version = m.StudyVersion.objects.create(
            institution=institution,
            program=program,
            code="STUDY-WI-2027",
            name="Wirtschaftsinformatik · Beispiel 2027",
            version="2027",
            duration_semesters=6,
            total_credits=180,
        )
        names = [
            [
                "Programmierung",
                "Mathematik I",
                "BWL Grundlagen",
                "Wissenschaftliches Arbeiten",
                "Rechnungswesen",
                "Informationssysteme",
            ],
            [
                "Datenbanken",
                "Mathematik II",
                "Statistik",
                "Organisation",
                "Softwaretechnik",
                "Netzwerke",
            ],
            [
                "Algorithmen",
                "Controlling",
                "Webentwicklung",
                "Projektmanagement",
                "Datenanalyse",
                "IT-Recht",
            ],
            [
                "IT-Sicherheit",
                "ERP-Systeme",
                "Verteilte Systeme",
                "Prozessmanagement",
                "Wahlpflicht I",
                "Teamprojekt",
            ],
            [
                "Cloudsysteme",
                "IT-Management",
                "Wahlpflicht II",
                "Praxisprojekt",
                "Forschungsmethoden",
                "Architekturen",
            ],
            [
                "Abschlussprojekt I",
                "Abschlussprojekt II",
                "Abschlussseminar",
                "Wahlpflicht III",
                "Digitalstrategie",
                "Vertiefungsprojekt",
            ],
        ]
        root = m.Module.objects.create(
            institution=institution,
            study_version=version,
            code="STUDY-INF-GRUND",
            name="Grundlagen Informatik",
            credits=10,
        )
        programming = None
        teachers = list(
            m.Person.objects.filter(institution=institution, kind="teacher").order_by(
                "id"
            )
        )
        for semester, subjects in enumerate(names, 1):
            for index, name in enumerate(subjects):
                module = m.Module.objects.create(
                    institution=institution,
                    study_version=version,
                    code=f"STUDY-M-{semester}-{index}",
                    name=name,
                    credits=5,
                    parent=root if index == 0 and semester <= 2 else None,
                )
                if semester == 1 and index == 0:
                    programming = module
                if semester == 2 and index == 0:
                    module.prerequisites.set([programming])
                unit = m.TeachingUnit.objects.create(
                    institution=institution,
                    module=module,
                    code=f"STUDY-L-{semester}-{index}",
                    name=name,
                    semester=semester,
                    target_units=2,
                    duration_minutes=90,
                    elective="Wahlpflicht" in name,
                    equipment=["Beamer"],
                )
                if teachers:
                    unit.teachers.set([teachers[(semester + index) % len(teachers)]])
        report = structure_report(version)
        if report["errors"]:
            raise CommandError(str(report["errors"]))
        version.status = "approved"
        version.save()
        cohort = m.Cohort.objects.create(
            institution=institution,
            program=program,
            study_version=version,
            entry_year=2027,
            code="STUDY-JG27",
            name="dWI27 · Studienstruktur-Beispiel",
        )
        for index in [1, 2]:
            m.Group.objects.create(
                institution=institution,
                cohort=cohort,
                code=f"STUDY-JG27-A{index}",
                name=f"dWI27 A{index}",
                size=20,
            )
        self.stdout.write(
            "Fiktive Studienstruktur angelegt: 6 Semester, 180 CP, 37 Module, 36 Lehrveranstaltungen, Jahrgang dWI27."
        )
