from django.contrib import admin
from django.urls import include, path, re_path
from django.views.generic import TemplateView
from planner import campus_ai_api, views
from planner.serializers import RESOURCES
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
for resource in RESOURCES:
    view = type(
        resource.title() + "ViewSet", (views.ResourceViewSet,), {"resource": resource}
    )
    router.register(resource, view, basename=resource)
urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/me/", views.auth_state),
    path("api/auth/login/", views.sign_in),
    path("api/auth/logout/", views.sign_out),
    path("api/bootstrap/", views.bootstrap),
    path("api/health/", views.health),
    path("api/preferences/", views.preferences),
    path("api/campusai/status/", campus_ai_api.status),
    path("api/campusai/context/", campus_ai_api.context),
    path("api/campusai/chat/", campus_ai_api.chat),
    path("api/plans/<int:pk>/<str:operation>/", views.plan_action),
    path("api/studyversions/<int:pk>/<str:operation>/", views.study_action),
    path("api/cohorts/<int:pk>/progression/", views.cohort_progression),
    path("api/jobs/<uuid:pk>/", views.job_detail),
    path("api/jobs/", views.jobs),
    path("api/public/<uuid:token>/", views.public_display),
    path("api/public/<uuid:token>/overview/", views.public_overview),
    path("api/rooms/<int:pk>/occupancy/", views.room_occupancy),
    path("api/imports/<str:resource>/", views.imports),
    path("api/", include(router.urls)),
    re_path(
        r"^(?!api/|admin/|static/).*$", TemplateView.as_view(template_name="index.html")
    ),
]
